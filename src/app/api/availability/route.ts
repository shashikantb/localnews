

// This file is no longer used and can be deleted.
// The availability logic is now in /api/booking/availability/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json({
    error: 'This endpoint is deprecated. Please use /api/booking/availability.'
  }, { status: 410 });
}

