
// This file is no longer used and can be deleted.
// The new availability logic is handled by /api/booking/availability/route.ts
// and the client-side booking-dialog.tsx.
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    error: 'This endpoint is deprecated. Please use /api/booking/availability.'
  }, { status: 410 });
}
