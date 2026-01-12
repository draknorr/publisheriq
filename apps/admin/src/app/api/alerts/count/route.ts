import { NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/alerts/count - Get unread alert count
export async function GET() {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from('user_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', result.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching alert count:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    console.error('Alert count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
