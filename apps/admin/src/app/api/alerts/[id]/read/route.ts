import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/alerts/[id]/read - Mark alert as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAuthOrThrow();

    const { id } = await params;

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', result.user.id);

    if (error) {
      console.error('Error marking alert as read:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Alert mark read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
