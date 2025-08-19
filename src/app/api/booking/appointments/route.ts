
import { NextResponse } from "next/server";
import { getAppointmentsForBusinessDb, createAppointmentDb } from "@/lib/db";
import { getSession } from "@/app/auth/actions";
import type { Appointment } from "@/lib/db-types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const businessId = Number(url.searchParams.get("businessId"));
    const date = String(url.searchParams.get("date")); // "yyyy-MM-dd"
    
    if (isNaN(businessId) || !date) {
        return NextResponse.json({ error: "Missing required query parameters: businessId and date" }, { status: 400 });
    }

    const appointments = await getAppointmentsForBusinessDb(businessId, date);
    return NextResponse.json({ appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ success:false, error:"Authentication required" }, { status:401 });
    }

    const body: Omit<Appointment, 'id' | 'status' | 'created_at' | 'customer_id'> = await req.json();
    
    // Basic validation
    if (!body.business_id || !body.service_id || !body.resource_id || !body.start_time || !body.end_time) {
        return NextResponse.json({ success: false, error: "Missing required fields for appointment" }, { status: 400 });
    }

    const appt = await createAppointmentDb({ ...body, customer_id: user.id });
    return NextResponse.json({ success:true, appointment: appt });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create appointment" }, { status: 500 });
  }
}
