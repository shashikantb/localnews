
import { NextResponse } from "next/server";
import { createAppointmentDb, getBusinessServiceByIdDb, getUserByIdDb, findFirstAvailableResourceDb, getAppointmentsForBusinessDb, getBusinessResourcesDb } from "@/lib/db";
import { getSession } from "@/app/auth/actions";
import { addMinutes, isBefore } from "date-fns";


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

// Helper to check for overlaps
const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

// Helper to check if a slot is valid
function isSlotAvailable(
  slotStartUtc: Date,
  slotEndUtc: Date,
  busySlots: {start_time: string, end_time: string}[],
  totalResources: number,
): boolean {
    const conflictingAppointments = busySlots.filter(b =>
      overlaps(slotStartUtc, slotEndUtc, new Date(b.start_time), new Date(b.end_time))
    ).length;
    
    return conflictingAppointments < totalResources;
}

// Helper function to reliably convert local time in a given timezone to a UTC Date object
// This replaces the faulty zonedTimeToUtc import.
function convertToUtc(date: string, time: string, timeZone: string): Date {
  const dtString = `${date}T${time}:00`;
  
  // Create a temporary date object to get the timezone offset string.
  // This is a robust way to handle various timezones including those with 30-min offsets.
  const tempDate = new Date();
  const timeZoneOffset = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(tempDate).find(part => part.type === 'timeZoneName')?.value;

  // e.g., "GMT+5:30" or "GMT-4"
  const offsetString = timeZoneOffset ? timeZoneOffset.replace('GMT', '') : '+00:00';
  
  const isoStringWithOffset = `${dtString}${offsetString}`;
  return new Date(isoStringWithOffset);
}


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
    
    if (!body.business_id || !body.service_id || !body.date || !body.time) {
        return NextResponse.json({ success: false, error: "Missing required fields for appointment" }, { status: 400 });
    }

    // Server-side validation
    const [service, business, resources, existingAppointments] = await Promise.all([
        getBusinessServiceByIdDb(body.service_id),
        getUserByIdDb(body.business_id),
        getBusinessResourcesDb(body.business_id),
        getAppointmentsForBusinessDb(body.business_id, body.date),
    ]);

    if (!service || service.user_id !== body.business_id) {
        return NextResponse.json({ success: false, error: "Invalid service selected." }, { status: 400 });
    }

    if (!business || !business.timezone) {
        return NextResponse.json({ success: false, error: "Business timezone is not set. Cannot book appointment." }, { status: 400 });
    }
    
    const businessTimeZone = business.timezone;
    const totalResources = resources.length > 0 ? resources.length : 1;
    
    // Correctly convert the selected local time in the business's timezone to a UTC Date object.
    const slotStartUtc = convertToUtc(body.date, body.time, businessTimeZone);

    if (isBefore(new Date(), slotStartUtc)) {
        return NextResponse.json({ success: false, error: "Cannot book an appointment in the past." }, { status: 409 });
    }
    
    const slotEndUtc = addMinutes(slotStartUtc, service.duration_minutes);

    // Re-verify availability on the server to prevent race conditions
    const isStillAvailable = isSlotAvailable(slotStartUtc, slotEndUtc, existingAppointments, totalResources);
    if (!isStillAvailable) {
        return NextResponse.json({ success: false, error: "The selected time slot is no longer available." }, { status: 409 }); // 409 Conflict
    }

    const resource = await findFirstAvailableResourceDb(body.business_id, slotStartUtc, slotEndUtc);
    if (!resource) {
        return NextResponse.json({ success: false, error: "No available resources for this time slot." }, { status: 409 });
    }

    const appt = await createAppointmentDb({ 
        customer_id: sessionUser.id,
        business_id: body.business_id,
        service_id: body.service_id,
        resource_id: resource.id,
        start_time: slotStartUtc.toISOString(),
        end_time: slotEndUtc.toISOString(),
        timezone: businessTimeZone,
     });

    return NextResponse.json({ success:true, appointment: appt });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create appointment" }, { status: 500 });
  }
}
