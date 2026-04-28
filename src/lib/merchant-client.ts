/**
 * @deprecated This function reads merchant_id from a client-side cookie,
 * which is spoofable. Dashboard pages now use server-side auth via
 * requireMerchant() in src/lib/supabase-server.ts.
 *
 * Only remaining consumers: src/app/admin/* pages (Phase 5 redesign)
 * and src/app/checkout/page.tsx (Phase 4 customer auth).
 *
 * Do NOT use in new code. Will be removed after Phase 5.
 */
export function getMerchantIdClient(): number {
  if (typeof window === "undefined") return 1;
  // Read from cookie set by middleware
  const match = document.cookie.match(/(?:^|; )merchant-id=(\d+)/);
  if (match) return Number(match[1]);
  // Fallback to meta tag (set by layout)
  const meta = document.querySelector('meta[name="merchant-id"]');
  if (meta) return Number(meta.getAttribute("content"));
  return 1;
}
