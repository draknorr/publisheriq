import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getUser } from '@/lib/supabase/server';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import type { ChangeFeedBurstsResponse, ChangeFeedNewsResponse } from './lib';
import {
  fetchChangeFeedBurstsResponse,
  fetchChangeFeedNewsResponse,
  parseChangeFeedBurstParams,
  parseChangeFeedNewsParams,
} from './lib';
import { ChangeFeedPageClient } from './ChangeFeedPageClient';

export const metadata: Metadata = {
  title: 'Change Feed | PublisherIQ',
  description: 'Track Steam storefront, media, PICS, and news changes in a dense feed.',
};

export const dynamic = 'force-dynamic';

function toUrlSearchParams(params: Record<string, string | undefined>): URLSearchParams {
  const urlSearchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      urlSearchParams.set(key, value);
    }
  });

  return urlSearchParams;
}

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    preset?: string;
    range?: string;
    appTypes?: string;
    source?: string;
    search?: string;
  }>;
}

export default async function ChangeFeedPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const params = await searchParams;
  const urlSearchParams = toUrlSearchParams(params);
  const activeTab = params.tab === 'news' ? 'news' : 'feed';
  let initialFeedResponse: ChangeFeedBurstsResponse | undefined;
  let initialNewsResponse: ChangeFeedNewsResponse | undefined;

  if (await getUser()) {
    try {
      if (activeTab === 'news') {
        initialNewsResponse = await fetchChangeFeedNewsResponse(
          parseChangeFeedNewsParams(urlSearchParams)
        );
      } else {
        initialFeedResponse = await fetchChangeFeedBurstsResponse(
          parseChangeFeedBurstParams(urlSearchParams)
        );
      }
    } catch (error) {
      console.error(`Failed to prefetch Change Feed ${activeTab} data:`, error);
    }
  }

  return (
    <ChangeFeedPageClient
      initialTab={params.tab}
      initialPreset={params.preset}
      initialRange={params.range}
      initialAppTypes={params.appTypes}
      initialSource={params.source}
      initialSearch={params.search}
      initialFeedResponse={initialFeedResponse}
      initialNewsResponse={initialNewsResponse}
    />
  );
}
