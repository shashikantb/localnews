
import { NextResponse } from "next/server";
import { getBusinessServicesDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const services = await getBusinessServicesDb(Number(params.businessId));
    return NextResponse.json({ services });
  } catch (error) {
    console.error(`Error fetching services for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}
