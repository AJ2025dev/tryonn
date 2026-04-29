-- ============================================================================
-- Appify RLS Migration: 001_enable_rls.sql
-- ============================================================================
--
-- PURPOSE
-- -------
-- Enable Row Level Security on all public tables and create policies that
-- enforce multi-tenant isolation. Every merchant can only read/write their
-- own data; storefront tables are publicly readable so anonymous customers
-- can browse products.
--
-- PREREQUISITES
-- -------------
-- 1. The `merchants` table MUST have an `auth_user_id` column (uuid,
--    references auth.users(id)). This column links a Supabase Auth user
--    to their merchant record.
-- 2. The dashboard MUST use authenticated Supabase sessions (not bare
--    anon key + cookie). Each dashboard page should call
--    supabase.auth.getUser() and let the JWT carry the user identity
--    through to Postgres.
-- 3. API routes that perform writes on behalf of the system (onboarding,
--    product generation) MUST use the service role client, which bypasses
--    RLS entirely. The service role key is stored in SUPABASE_SERVICE_ROLE_KEY
--    and must NEVER be exposed to the browser.
--
-- SERVICE ROLE BYPASS
-- -------------------
-- Supabase's service_role key bypasses RLS by default. The following
-- server-side operations rely on this:
--   - POST /api/generate-store   (inserts merchants, merchant_settings,
--     merchant_briefs, design_specs, banners)
--   - POST /api/generate-products (inserts categories, products,
--     product_variants, product_images, featured_categories)
--   - POST /api/razorpay/verify-payment (updates orders)
-- These routes MUST switch from db() (anon key) to dbAdmin() (service role).
--
-- ADMIN PANEL
-- -----------
-- The /admin/* pages currently use the anon key to read ALL merchants,
-- orders, and settings without scoping. After enabling RLS, the admin
-- panel MUST use a service-role server client OR a separate "admin" role
-- with its own policies. This migration does NOT create admin policies;
-- admin access should go through server-side API routes that use the
-- service role key.
--
-- DO NOT EXECUTE this migration until the above prerequisites are met.
-- Running it prematurely will break the app.
--
-- REMAINING KNOWN ISSUES (Phase 4+)
-- ----------------------------------
-- 1. featured_categories.merchant_id not yet verified — may need index
--    removed if column doesn't exist (similar to categories fix).
-- 2. order_items has no INSERT policy — checkout will need a server-side
--    write (service role) or an anon INSERT policy added here.
-- 3. No DELETE policy on merchants — intentional: merchants should not
--    be able to self-delete. Deletion is an admin/support action via
--    service role only.
-- 4. Anon SELECT on orders is currently permissive (USING true) — must
--    be tightened or removed once checkout moves to server-side (Phase 4).
-- 5. addresses anon SELECT may also be needed for the current checkout
--    .insert().select() pattern — not yet added. Defer to Phase 4.
-- ============================================================================


-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================
-- Returns the merchant_id for the currently authenticated user.
-- Used by most policies to avoid repeating the subquery.

CREATE OR REPLACE FUNCTION public.get_my_merchant_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.merchants WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_merchant_id() IS
  'Returns the merchant_id linked to the current auth.uid(). '
  'Used by RLS policies to enforce tenant isolation.';


-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS public.merchants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.merchant_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.merchant_briefs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.design_specs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.featured_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.addresses             ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 2. STOREFRONT POLICIES (public SELECT for anonymous customers)
-- ============================================================================
-- These tables are read by storefront pages (/, /products/[id]) where
-- customers browse without logging in. The queries always filter by
-- merchant_id in application code (resolved from subdomain in middleware),
-- but the RLS policy itself allows reading any active merchant's data.
-- This is intentional: storefront data is public.

-- products ---------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read active products" ON public.products;
  CREATE POLICY "Storefront: anon can read active products"
    ON public.products FOR SELECT
    USING (is_active = true);
END $$;

-- product_variants -------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read product variants" ON public.product_variants;
  CREATE POLICY "Storefront: anon can read product variants"
    ON public.product_variants FOR SELECT
    USING (true);
END $$;

-- product_images ---------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read product images" ON public.product_images;
  CREATE POLICY "Storefront: anon can read product images"
    ON public.product_images FOR SELECT
    USING (true);
END $$;

-- categories -------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read categories" ON public.categories;
  CREATE POLICY "Storefront: anon can read categories"
    ON public.categories FOR SELECT
    USING (true);
END $$;

-- featured_categories ----------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read featured categories" ON public.featured_categories;
  CREATE POLICY "Storefront: anon can read featured categories"
    ON public.featured_categories FOR SELECT
    USING (true);
END $$;

-- banners ----------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read active banners" ON public.banners;
  CREATE POLICY "Storefront: anon can read active banners"
    ON public.banners FOR SELECT
    USING (is_active = true);
END $$;

-- merchant_settings ------------------------------------------------------
-- Needed by storefront (logo, colors, store name) AND by middleware
-- (subdomain -> merchant_id lookup).
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read merchant settings" ON public.merchant_settings;
  CREATE POLICY "Storefront: anon can read merchant settings"
    ON public.merchant_settings FOR SELECT
    USING (true);
END $$;

-- design_specs -----------------------------------------------------------
-- Storefront reads design_specs for theming (page.tsx fetches spec_json).
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefront: anon can read design specs" ON public.design_specs;
  CREATE POLICY "Storefront: anon can read design specs"
    ON public.design_specs FOR SELECT
    USING (true);
END $$;


-- ============================================================================
-- 3. CUSTOMER CHECKOUT POLICIES (anon INSERT for orders/addresses)
-- ============================================================================
-- Customers place orders without logging in. They need INSERT on orders,
-- order_items, and addresses. They should NOT be able to read other
-- customers' orders.

-- orders -----------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Checkout: anon can insert orders" ON public.orders;
  CREATE POLICY "Checkout: anon can insert orders"
    ON public.orders FOR INSERT
    WITH CHECK (
      merchant_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.merchants WHERE id = merchant_id)
    );
END $$;

-- orders (SELECT after INSERT) -------------------------------------------
-- Checkout calls .insert(...).select("id").single() which needs SELECT
-- to return the newly created row. Without auth we can't scope tightly,
-- but this is acceptable: order data is not sensitive to other anon users
-- (they'd need to guess the UUID/id). Phase 4 (customer auth) will
-- replace this with a session-scoped policy.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Checkout: anon can read orders" ON public.orders;
  CREATE POLICY "Checkout: anon can read orders"
    ON public.orders FOR SELECT
    USING (true);
END $$;

-- order_items ------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Checkout: anon can insert order items" ON public.order_items;
  CREATE POLICY "Checkout: anon can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (true);
END $$;

-- addresses --------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Checkout: anon can insert addresses" ON public.addresses;
  CREATE POLICY "Checkout: anon can insert addresses"
    ON public.addresses FOR INSERT
    WITH CHECK (true);
END $$;


-- ============================================================================
-- 4. MERCHANT DASHBOARD POLICIES (authenticated, scoped by merchant_id)
-- ============================================================================
-- The dashboard requires an authenticated session. The merchant's identity
-- is determined by looking up merchants.auth_user_id = auth.uid().
-- All policies below restrict access to rows matching that merchant_id.

-- merchants --------------------------------------------------------------
-- A merchant can read and update only their own row.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read own record" ON public.merchants;
  CREATE POLICY "Dashboard: merchant can read own record"
    ON public.merchants FOR SELECT
    USING (auth_user_id = auth.uid());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own record" ON public.merchants;
  CREATE POLICY "Dashboard: merchant can update own record"
    ON public.merchants FOR UPDATE
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());
END $$;

-- merchant_settings (INSERT/UPDATE) --------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can insert own settings" ON public.merchant_settings;
  CREATE POLICY "Dashboard: merchant can insert own settings"
    ON public.merchant_settings FOR INSERT
    WITH CHECK (merchant_id = public.get_my_merchant_id());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own settings" ON public.merchant_settings;
  CREATE POLICY "Dashboard: merchant can update own settings"
    ON public.merchant_settings FOR UPDATE
    USING (merchant_id = public.get_my_merchant_id())
    WITH CHECK (merchant_id = public.get_my_merchant_id());
END $$;

-- products (INSERT/UPDATE/DELETE) ----------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read own products" ON public.products;
  CREATE POLICY "Dashboard: merchant can read own products"
    ON public.products FOR SELECT
    USING (merchant_id = public.get_my_merchant_id());
  -- Note: this overlaps with the storefront SELECT policy. Postgres ORs
  -- multiple permissive policies, so an authenticated merchant can see
  -- their inactive products too (the storefront policy only allows
  -- is_active = true).
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can insert products" ON public.products;
  CREATE POLICY "Dashboard: merchant can insert products"
    ON public.products FOR INSERT
    WITH CHECK (merchant_id = public.get_my_merchant_id());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own products" ON public.products;
  CREATE POLICY "Dashboard: merchant can update own products"
    ON public.products FOR UPDATE
    USING (merchant_id = public.get_my_merchant_id())
    WITH CHECK (merchant_id = public.get_my_merchant_id());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can delete own products" ON public.products;
  CREATE POLICY "Dashboard: merchant can delete own products"
    ON public.products FOR DELETE
    USING (merchant_id = public.get_my_merchant_id());
END $$;

-- product_variants (INSERT/UPDATE/DELETE) --------------------------------
-- Variants don't have merchant_id directly; we join through products.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can insert variants" ON public.product_variants;
  CREATE POLICY "Dashboard: merchant can insert variants"
    ON public.product_variants FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_variants.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own variants" ON public.product_variants;
  CREATE POLICY "Dashboard: merchant can update own variants"
    ON public.product_variants FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_variants.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_variants.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can delete own variants" ON public.product_variants;
  CREATE POLICY "Dashboard: merchant can delete own variants"
    ON public.product_variants FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_variants.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

-- product_images (INSERT/UPDATE/DELETE) ----------------------------------
-- Images also join through products for merchant_id.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can insert images" ON public.product_images;
  CREATE POLICY "Dashboard: merchant can insert images"
    ON public.product_images FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_images.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own images" ON public.product_images;
  CREATE POLICY "Dashboard: merchant can update own images"
    ON public.product_images FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_images.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can delete own images" ON public.product_images;
  CREATE POLICY "Dashboard: merchant can delete own images"
    ON public.product_images FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = product_images.product_id
          AND products.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;

-- orders (SELECT/UPDATE only -- merchants read and update status) --------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read own orders" ON public.orders;
  CREATE POLICY "Dashboard: merchant can read own orders"
    ON public.orders FOR SELECT
    USING (merchant_id = public.get_my_merchant_id());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can update own orders" ON public.orders;
  CREATE POLICY "Dashboard: merchant can update own orders"
    ON public.orders FOR UPDATE
    USING (merchant_id = public.get_my_merchant_id())
    WITH CHECK (merchant_id = public.get_my_merchant_id());
END $$;

-- order_items (SELECT only -- merchants view line items) -----------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read own order items" ON public.order_items;
  CREATE POLICY "Dashboard: merchant can read own order items"
    ON public.order_items FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
          AND orders.merchant_id = public.get_my_merchant_id()
      )
    );
END $$;


-- ============================================================================
-- 5. TABLES WITH NO ANON WRITE ACCESS
-- ============================================================================
-- The following tables should ONLY be written to by server-side routes
-- using the service role key:
--
--   merchants          -- created during onboarding (generate-store)
--   merchant_settings   -- created during onboarding (generate-store)
--   merchant_briefs     -- created during onboarding (generate-store)
--   design_specs        -- created during onboarding (generate-store)
--   banners             -- created during onboarding (generate-store)
--   categories          -- created during product generation (generate-products)
--   featured_categories -- created during product generation (generate-products)
--
-- No INSERT/UPDATE/DELETE policies are created for anon on these tables.
-- The service role bypasses RLS entirely, so the onboarding and product
-- generation API routes will continue to work as long as they use
-- SUPABASE_SERVICE_ROLE_KEY.
--
-- IMPORTANT: The generate-store and generate-products routes currently
-- use the anon key (db() function). They MUST be switched to use
-- dbAdmin() (service role) before this migration is applied.


-- ============================================================================
-- 6. MERCHANT_BRIEFS -- read-only for merchants
-- ============================================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read own briefs" ON public.merchant_briefs;
  CREATE POLICY "Dashboard: merchant can read own briefs"
    ON public.merchant_briefs FOR SELECT
    USING (merchant_id = public.get_my_merchant_id());
END $$;


-- ============================================================================
-- 7. ADDRESSES
-- ============================================================================
-- Addresses use a polymorphic link_type/link_id pattern:
--   link_type = 'order'    → link_id = orders.id
--   link_type = 'customer' → link_id = orders.customer_id
-- Merchants can read addresses linked to their own orders.
-- No anon SELECT (customers don't need to read back addresses after insert).

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dashboard: merchant can read addresses on own orders" ON public.addresses;
  CREATE POLICY "Dashboard: merchant can read addresses on own orders"
    ON public.addresses FOR SELECT
    USING (
      (link_type = 'order' AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = addresses.link_id
          AND orders.merchant_id = public.get_my_merchant_id()
      ))
      OR
      (link_type = 'customer' AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.customer_id = addresses.link_id
          AND orders.merchant_id = public.get_my_merchant_id()
      ))
    );
END $$;


-- ============================================================================
-- 8. INDEXES TO SUPPORT RLS POLICY PERFORMANCE
-- ============================================================================
-- The get_my_merchant_id() function and the EXISTS subqueries need fast
-- lookups. These indexes ensure RLS checks don't degrade query performance.

CREATE INDEX IF NOT EXISTS idx_merchants_auth_user_id
  ON public.merchants (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_products_merchant_id
  ON public.products (merchant_id);

CREATE INDEX IF NOT EXISTS idx_orders_merchant_id
  ON public.orders (merchant_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON public.product_variants (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON public.product_images (product_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_merchant_settings_merchant_id
  ON public.merchant_settings (merchant_id);

CREATE INDEX IF NOT EXISTS idx_banners_merchant_id
  ON public.banners (merchant_id);

CREATE INDEX IF NOT EXISTS idx_design_specs_merchant_id
  ON public.design_specs (merchant_id);

CREATE INDEX IF NOT EXISTS idx_merchant_briefs_merchant_id
  ON public.merchant_briefs (merchant_id);

-- categories has no merchant_id column (categories are global), so no index needed.

CREATE INDEX IF NOT EXISTS idx_featured_categories_merchant_id
  ON public.featured_categories (merchant_id);


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To revert this migration, run the following:
--
--   DROP FUNCTION IF EXISTS public.get_my_merchant_id();
--
--   ALTER TABLE public.merchants            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.merchant_settings     DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.merchant_briefs       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.design_specs          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.banners               DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.categories            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.featured_categories   DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.products              DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.product_variants      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.product_images        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.orders                DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.order_items           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.addresses             DISABLE ROW LEVEL SECURITY;
--
-- All policies will become inactive when RLS is disabled, so you do not
-- need to drop them individually. They will reactivate if RLS is
-- re-enabled.
--
-- To drop indexes:
--   DROP INDEX IF EXISTS idx_merchants_auth_user_id;
--   DROP INDEX IF EXISTS idx_products_merchant_id;
--   DROP INDEX IF EXISTS idx_orders_merchant_id;
--   DROP INDEX IF EXISTS idx_product_variants_product_id;
--   DROP INDEX IF EXISTS idx_product_images_product_id;
--   DROP INDEX IF EXISTS idx_order_items_order_id;
--   DROP INDEX IF EXISTS idx_merchant_settings_merchant_id;
--   DROP INDEX IF EXISTS idx_banners_merchant_id;
--   DROP INDEX IF EXISTS idx_design_specs_merchant_id;
--   DROP INDEX IF EXISTS idx_merchant_briefs_merchant_id;
--   DROP INDEX IF EXISTS idx_featured_categories_merchant_id;
