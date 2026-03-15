import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';
import type { ChangeBurstDetail, RawChangeBurstDetailRow } from '@/app/(main)/changes/lib';
import {
  isMissingChangeFeedRpcError,
  mapChangeBurstDetail,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ burstId: string }> }
) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { burstId } = await params;
    const decodedBurstId = decodeURIComponent(burstId);
    const supabase = await createServerClient();

    // Generated DB types will lag until the migration is applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_change_feed_burst_detail', {
      p_burst_id: decodedBurstId,
    });

    if (error) {
      if (isMissingChangeFeedRpcError(error, 'get_change_feed_burst_detail')) {
        return NextResponse.json(
          { error: 'Change Feed detail query surface is not available yet. Apply the pending migration first.' },
          { status: 503 }
        );
      }

      console.error('Change Feed burst detail RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawDetail = Array.isArray(data)
      ? ((data[0] ?? null) as RawChangeBurstDetailRow | null)
      : ((data ?? null) as RawChangeBurstDetailRow | null);

    if (!rawDetail) {
      return NextResponse.json({ error: 'Burst not found' }, { status: 404 });
    }

    const detail: ChangeBurstDetail = mapChangeBurstDetail(rawDetail);
    return NextResponse.json({ item: detail });
  } catch (error) {
    console.error('Change Feed burst detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
