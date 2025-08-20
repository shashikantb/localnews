
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { zonedTimeToUtc } from 'date-fns-tz';

// This is a simplified connection setup. In your actual app, you'd reuse the db connection logic from @/lib/db.ts
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});


type BookingRow = { start_time: string; end_time: string; resource_id: number };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const businessId = Number(searchParams.get('businessId'));
    const date = searchParams.get('date'); // '2025-08-20'
    const tz = searchParams.get('tz') || 'UTC';
    
    if (!businessId || !date) {
      return NextResponse.json({ error: 'businessId and date are required' }, { status: 400 });
    }

    // day window in UTC for DB query
    const dayStartTz = `${date} 00:00:00`;
    const dayEndTz   = `${date} 23:59:59`;
    const dayStartUtc = zonedTimeToUtc(dayStartTz, tz);
    const dayEndUtc   = zonedTimeToUtc(dayEndTz, tz);

    // get all confirmed bookings overlapping that day
    const q = `
      SELECT start_time, end_time, resource_id
      FROM appointments
      WHERE business_id = $1
        AND status IN ('confirmed')
        AND start_time < $3 AND end_time > $2
    `;
    const params: any[] = [businessId, dayStartUtc, dayEndUtc];
    
    const { rows } = await pool.query<BookingRow>(q, params);

    return NextResponse.json({
      busy: rows.map(r => ({
        startUtc: new Date(r.start_time).toISOString(),
        endUtc:   new Date(r.end_time).toISOString(),
        resourceId: r.resource_id,
      })),
    });
  } catch (error: any) {
    console.error('[API/availability] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch availability' }, { status: 500 });
  }
}
