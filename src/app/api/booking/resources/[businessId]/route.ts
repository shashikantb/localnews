
import { NextResponse } from "next/server";
import { getBusinessResourcesDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const businessId = Number(params.businessId);
    if (isNaN(businessId)) {
      return NextResponse.json({ error: "Invalid business ID" }, { status: 400 });
    }
    const resources = await getBusinessResourcesDb(businessId);
    return NextResponse.json({ resources });
  } catch (error) {
    console.error(`Error fetching resources for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}
