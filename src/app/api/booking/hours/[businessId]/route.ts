
import { NextResponse } from "next/server";
import { getBusinessHoursDb } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const businessId = Number(params.businessId);
    if(isNaN(businessId)) {
        return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }
    const hours = await getBusinessHoursDb(businessId);
    return NextResponse.json({ hours });
  } catch (error) {
    console.error(`Error fetching hours for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch hours" }, { status: 500 });
  }
}
