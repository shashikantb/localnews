
import { NextResponse } from "next/server";
import { getBusinessServicesDb } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const businessId = Number(params.businessId);
    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }
    const services = await getBusinessServicesDb(businessId);
    return NextResponse.json({ services });
  } catch (error) {
    console.error(`Error fetching services for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}
