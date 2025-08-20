
import { NextResponse } from "next/server";
import { getAppointmentsForBusinessDb, createAppointmentDb, getBusinessServiceByIdDb } from "@/lib/db";
import { getSession } from "@/app/auth/actions";
import type { Appointment } from "@/lib/db-types";
import { addMinutes, setHours, setMinutes } from "date-fns";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

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
    const service = await getBusinessServiceByIdDb(body.service_id);
    if (!service || service.user_id !== body.business_id) {
        return NextResponse.json({ success: false, error: "Invalid service selected." }, { status: 400 });
    }

    // The date and time are combined into a single string that represents the UTC time of the event.
    // Appending 'Z' tells the Date constructor to parse this as UTC, not local time.
    // E.g., '2024-08-15' and '14:30' become '2024-08-15T14:30:00Z'.
    // toISOString() then correctly formats it for storage.
    const utcDateTimeString = `${body.date}T${body.time}:00Z`;
    const startTime = new Date(utcDateTimeString);
    const endTime = addMinutes(startTime, service.duration_minutes);

    const availableSlots = await getAvailableSlotsDb(body.business_id, body.service_id, body.date);
    if (!availableSlots.includes(body.time)) {
        return NextResponse.json({ success: false, error: "The selected time slot is no longer available." }, { status: 409 }); // 409 Conflict
    }

    const resource = await findFirstAvailableResourceDb(body.business_id, startTime, endTime);
    if (!resource) {
        return NextResponse.json({ success: false, error: "No available resources for this time slot." }, { status: 409 });
    }

    const appt = await createAppointmentDb({ 
        customer_id: user.id,
        business_id: body.business_id,
        service_id: body.service_id,
        resource_id: resource.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
     });

    return NextResponse.json({ success:true, appointment: appt });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create appointment" }, { status: 500 });
  }
}

// These functions would need to be added to db.ts
async function getAvailableSlotsDb(businessId: number, serviceId: number, date: string): Promise<string[]> {
    // This is a placeholder for the real logic which you should have in db.ts
    // For now, let's just return a few slots to test the flow
    // In a real implementation, you'd call your `getAvailableSlotsDb` from `db.ts`
    const { getAvailableSlotsDb: getSlots } = await import('@/lib/db');
    return getSlots(businessId, serviceId, date);
}

async function findFirstAvailableResourceDb(businessId: number, startTime: Date, endTime: Date): Promise<{id: number} | null> {
     const { findFirstAvailableResourceDb: findResource } = await import('@/lib/db');
    return findResource(businessId, startTime, endTime);
}
