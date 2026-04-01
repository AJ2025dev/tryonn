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
