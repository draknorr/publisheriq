import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// DELETE /api/alerts/[id] - Dismiss (delete) an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', result.user.id);

    if (error) {
      console.error('Error deleting alert:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
