
import { NextResponse } from 'next/server';
import { getAvailableSlotsDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = Number(searchParams.get('businessId'));
    const serviceId = Number(searchParams.get('serviceId'));
    const date = searchParams.get('date');

    if (!businessId || !serviceId || !date) {
      return NextResponse.json({ error: 'Missing required query parameters: businessId, serviceId, date' }, { status: 400 });
    }

    const slots = await getAvailableSlotsDb(businessId, serviceId, date);

    return NextResponse.json({ slots });
  } catch (error: any) {
    console.error('[API/slots] Error fetching available slots:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch available slots' }, { status: 500 });
  }
}
