
import { NextResponse } from "next/server";
import { getBusinessHoursDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { businessId: string }}) {
  try {
    const hours = await getBusinessHoursDb(Number(params.businessId));
    return NextResponse.json({ hours });
  } catch (error) {
    console.error(`Error fetching hours for business ${params.businessId}:`, error);
    return NextResponse.json({ error: "Failed to fetch hours" }, { status: 500 });
  }
}
