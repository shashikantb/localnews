

import { NextResponse } from "next/server";
import { createAppointmentDb, getBusinessServiceByIdDb, getUserByIdDb, findFirstAvailableResourceDb, getAvailableSlotsDb } from "@/lib/db";
import { getSession } from "@/app/auth/actions";
import type { Appointment } from "@/lib/db-types";
import { addMinutes } from "date-fns";
import { toDate } from 'date-fns-tz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

export async function POST(req: Request) {
  try {
    const { user: sessionUser } = await getSession();
    if (!sessionUser) {
      return NextResponse.json({ success:false, error:"Authentication required" }, { status:401 });
    }

    const body: {
        business_id: number;
        service_id: number;
        date: string; // "yyyy-MM-dd"
        time: string; // "HH:mm"
    } = await req.json();
    
    // Basic validation
    if (!body.business_id || !body.service_id || !body.date || !body.time) {
        return NextResponse.json({ success: false, error: "Missing required fields for appointment" }, { status: 400 });
    }

    // Server-side validation
    const [service, business] = await Promise.all([
        getBusinessServiceByIdDb(body.service_id),
        getUserByIdDb(body.business_id),
    ]);

    if (!service || service.user_id !== body.business_id) {
        return NextResponse.json({ success: false, error: "Invalid service selected." }, { status: 400 });
    }

    if (!business || !business.timezone) {
        return NextResponse.json({ success: false, error: "Business timezone is not set. Cannot book appointment." }, { status: 400 });
    }
    
    const businessTimeZone = business.timezone;

    const localDateTimeString = `${body.date}T${body.time}:00`;
    // Use toDate to correctly interpret the local time in the business's timezone
    const startTimeInUtc = toDate(localDateTimeString, { timeZone: businessTimeZone });
    const endTimeInUtc = addMinutes(startTimeInUtc, service.duration_minutes);
    
    // Re-verify availability on the server to prevent race conditions
    const availableSlots = await getAvailableSlotsDb(body.business_id, body.service_id, body.date);
    if (!availableSlots.includes(body.time)) {
        return NextResponse.json({ success: false, error: "The selected time slot is no longer available." }, { status: 409 }); // 409 Conflict
    }

    const resource = await findFirstAvailableResourceDb(body.business_id, startTimeInUtc, endTimeInUtc);
    if (!resource) {
        return NextResponse.json({ success: false, error: "No available resources for this time slot." }, { status: 409 });
    }

    const appt = await createAppointmentDb({ 
        customer_id: sessionUser.id,
        business_id: body.business_id,
        service_id: body.service_id,
        resource_id: resource.id,
        start_time: startTimeInUtc.toISOString(),
        end_time: endTimeInUtc.toISOString(),
        timezone: businessTimeZone,
     });

    return NextResponse.json({ success:true, appointment: appt });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create appointment" }, { status: 500 });
  }
}
