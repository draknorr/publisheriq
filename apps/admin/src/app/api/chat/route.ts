import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'route_retired',
      message: 'This chat endpoint has been retired. Use /api/chat/stream instead.',
    },
    { status: 410 }
  );
}
