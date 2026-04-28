import { requireMerchant } from "@/lib/supabase-server";
import ProductFormClient from "./ProductFormClient";

export const dynamic = "force-dynamic";

export default async function ProductFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { merchantId } = await requireMerchant();
  const { id } = await params;

  return <ProductFormClient merchantId={merchantId} paramId={id} />;
}
