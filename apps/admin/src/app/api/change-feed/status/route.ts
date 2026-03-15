import { NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';
import type { ChangeFeedStatus } from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

const CATCHING_UP_QUEUE_COUNT = 25000;
const DELAYED_QUEUE_COUNT = 100000;
const CATCHING_UP_QUEUE_AGE_HOURS = 6;
const DELAYED_QUEUE_AGE_HOURS = 24;
const CATCHING_UP_EVENT_AGE_HOURS = 3;
const DELAYED_EVENT_AGE_HOURS = 12;

function getHoursSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return (Date.now() - parsed) / (1000 * 60 * 60);
}

function determineState(
  queuedJobs: number,
  oldestQueuedAt: string | null,
  latestStorefrontEventAt: string | null,
  latestNewsEventAt: string | null
): ChangeFeedStatus {
  const reasons: string[] = [];
  const oldestQueuedHours = getHoursSince(oldestQueuedAt);
  const storefrontHours = getHoursSince(latestStorefrontEventAt);
  const newsHours = getHoursSince(latestNewsEventAt);

  if (queuedJobs > DELAYED_QUEUE_COUNT) {
    reasons.push('Queued storefront/news backlog is above 100,000 jobs.');
  } else if (queuedJobs > CATCHING_UP_QUEUE_COUNT) {
    reasons.push('Queued storefront/news backlog is above 25,000 jobs.');
  }

  if (oldestQueuedHours != null) {
    if (oldestQueuedHours > DELAYED_QUEUE_AGE_HOURS) {
      reasons.push('Oldest queued storefront/news capture is older than 24 hours.');
    } else if (oldestQueuedHours > CATCHING_UP_QUEUE_AGE_HOURS) {
      reasons.push('Oldest queued storefront/news capture is older than 6 hours.');
    }
  }

  if (storefrontHours == null) {
    reasons.push('No storefront change events have been captured yet.');
  } else if (storefrontHours > DELAYED_EVENT_AGE_HOURS) {
    reasons.push('Latest storefront change event is older than 12 hours.');
  } else if (storefrontHours > CATCHING_UP_EVENT_AGE_HOURS) {
    reasons.push('Latest storefront change event is older than 3 hours.');
  }

  if (newsHours == null) {
    reasons.push('No news change events have been captured yet.');
  } else if (newsHours > DELAYED_EVENT_AGE_HOURS) {
    reasons.push('Latest news change event is older than 12 hours.');
  } else if (newsHours > CATCHING_UP_EVENT_AGE_HOURS) {
    reasons.push('Latest news change event is older than 3 hours.');
  }

  let state: ChangeFeedStatus['state'] = 'healthy';
  const isDelayed =
    queuedJobs > DELAYED_QUEUE_COUNT ||
    (oldestQueuedHours != null && oldestQueuedHours > DELAYED_QUEUE_AGE_HOURS) ||
    storefrontHours == null ||
    newsHours == null ||
    (storefrontHours != null && storefrontHours > DELAYED_EVENT_AGE_HOURS) ||
    (newsHours != null && newsHours > DELAYED_EVENT_AGE_HOURS);

  if (isDelayed) {
    state = 'delayed';
  } else if (
    queuedJobs > CATCHING_UP_QUEUE_COUNT ||
    (oldestQueuedHours != null && oldestQueuedHours > CATCHING_UP_QUEUE_AGE_HOURS) ||
    (storefrontHours != null && storefrontHours > CATCHING_UP_EVENT_AGE_HOURS) ||
    (newsHours != null && newsHours > CATCHING_UP_EVENT_AGE_HOURS)
  ) {
    state = 'catching_up';
  }

  return {
    state,
    queuedJobs,
    oldestQueuedAt,
    latestStorefrontEventAt,
    latestNewsEventAt,
    reasons,
  };
}

export async function GET() {
  try {
    await requireAuthOrThrow();

    const supabase = await createServerClient();
    // Generated DB types will lag until the migration is applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [
      queuedJobsResult,
      oldestQueuedResult,
      latestStorefrontResult,
      latestNewsResult,
    ] = await Promise.all([
      db
        .from('app_capture_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'queued')
        .in('source', ['storefront', 'news']),
      db
        .from('app_capture_queue')
        .select('available_at')
        .eq('status', 'queued')
        .in('source', ['storefront', 'news'])
        .order('available_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('app_change_events')
        .select('occurred_at')
        .eq('source', 'storefront')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('app_change_events')
        .select('occurred_at')
        .eq('source', 'news')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const errors = [
      queuedJobsResult.error,
      oldestQueuedResult.error,
      latestStorefrontResult.error,
      latestNewsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Change Feed status query error:', errors);
      return NextResponse.json({ error: 'Failed to load Change Feed status' }, { status: 500 });
    }

    const status = determineState(
      queuedJobsResult.count ?? 0,
      oldestQueuedResult.data?.available_at ?? null,
      latestStorefrontResult.data?.occurred_at ?? null,
      latestNewsResult.data?.occurred_at ?? null
    );

    return NextResponse.json(status);
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Change Feed status GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
