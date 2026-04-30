-- ============================================================================
-- 002_phase4_orders_razorpay.sql
-- ============================================================================
-- Adds Razorpay tracking columns and payment_status to orders table for
-- Phase 4 (customer checkout). Already applied to production via Supabase
-- SQL editor — this file exists for version control.
--
-- Indexes:
-- - razorpay_order_id (unique partial) for verify/webhook lookups
-- - customer_id for order history queries
-- - payment_status (partial on pending/failed) for webhook handler
-- ============================================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id   text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature  text,
  ADD COLUMN IF NOT EXISTS payment_status      text DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON public.orders (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON public.orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status)
  WHERE payment_status IN ('pending', 'failed');

COMMIT;
