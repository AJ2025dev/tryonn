import { headers } from "next/headers";

export async function getMerchantId(): Promise<number> {
  const headersList = await headers();
  const fromHeader = headersList.get("x-merchant-id");
  if (fromHeader) return Number(fromHeader);
  return Number(process.env.NEXT_PUBLIC_DEFAULT_MERCHANT_ID || "1");
}
