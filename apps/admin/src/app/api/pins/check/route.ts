import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Note: user_pins table is created by migration 20260112000001_add_personalization.sql
// Types will be available after running: pnpm --filter database generate

// GET /api/pins/check?entityType=game&entityId=123 - Check if entity is pinned
export async function GET(request: NextRequest) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    // Validate required params
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    // Validate entityType enum
    if (!['game', 'publisher', 'developer'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be game, publisher, or developer' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_pins')
      .select('id')
      .eq('user_id', result.user.id)
      .eq('entity_type', entityType)
      .eq('entity_id', Number(entityId))
      .maybeSingle();

    if (error) {
      console.error('Error checking pin:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      pinned: !!data,
      pinId: data?.id ?? null,
    });
  } catch (error) {
    console.error('Pins check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
