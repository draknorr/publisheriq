import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { ChangeFeedPageClient } from './ChangeFeedPageClient';

export const metadata: Metadata = {
  title: 'Change Feed | PublisherIQ',
  description: 'Track Steam storefront, media, PICS, and news changes in a dense feed.',
};

export const dynamic = 'force-dynamic';

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

  return (
    <ChangeFeedPageClient
      initialTab={params.tab}
      initialPreset={params.preset}
      initialRange={params.range}
      initialAppTypes={params.appTypes}
      initialSource={params.source}
      initialSearch={params.search}
    />
  );
}
