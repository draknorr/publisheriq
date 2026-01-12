import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Note: user_pins table is created by migration 20260112000001_add_personalization.sql
// Types will be available after running: pnpm --filter database generate

// DELETE /api/pins/[id] - Remove a pin
export async function DELETE(
  _request: NextRequest,
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
      .from('user_pins')
      .delete()
      .eq('id', id)
      .eq('user_id', result.user.id);

    if (error) {
      console.error('Error deleting pin:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pins DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
