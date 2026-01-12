import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Note: user_pins table and get_user_pins_with_metrics RPC are created by migration 20260112000001_add_personalization.sql
// The eslint-disable comments below are temporary - types will be available after applying the migration and running:
// pnpm --filter database generate
// See: docs/architecture/personalized-dashboard.md#type-safety-notes

// GET /api/pins - List user's pins with current metrics
export async function GET() {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_user_pins_with_metrics', {
      p_user_id: result.user.id,
    });

    if (error) {
      console.error('Error fetching pins:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Pins GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/pins - Create a new pin
export async function POST(request: NextRequest) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, displayName } = body as {
      entityType: string;
      entityId: number;
      displayName: string;
    };

    // Validate required fields
    if (!entityType || entityId === undefined || !displayName) {
      return NextResponse.json(
        { error: 'entityType, entityId, and displayName are required' },
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
      .insert({
        user_id: result.user.id,
        entity_type: entityType as 'game' | 'publisher' | 'developer',
        entity_id: entityId,
        display_name: displayName,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (already pinned)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already pinned' }, { status: 409 });
      }
      console.error('Error creating pin:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Pins POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
