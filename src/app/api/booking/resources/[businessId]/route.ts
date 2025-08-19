
import { NextResponse } from "next/server";
import { getBusinessResourcesDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const resources = await getBusinessResourcesDb(Number(params.businessId));
    return NextResponse.json({ resources });
  } catch (error) {
    console.error(`Error fetching resources for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

    