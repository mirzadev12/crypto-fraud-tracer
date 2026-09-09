import { labelWallet } from "@/lib/labels";

export async function GET() {
  const result = labelWallet(
  "TDEMOEXCHANGEHOTWALLET123456789"
);
  return Response.json({
    success: true,
    address: "TDEMOEXCHANGEHOTWALLET123456789",
    result,
  });
}