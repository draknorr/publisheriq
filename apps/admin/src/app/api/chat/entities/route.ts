import { NextRequest } from 'next/server';

import { handleChatEntityRequest } from './handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  return handleChatEntityRequest(request);
}
