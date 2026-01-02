import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { ChatLogsTable } from './ChatLogsTable';

export const dynamic = 'force-dynamic';

export interface ChatQueryLog {
  id: string;
  query_text: string;
  tool_names: string[];
  tool_count: number;
  iteration_count: number;
  response_length: number;
  timing_llm_ms: number | null;
  timing_tools_ms: number | null;
  timing_total_ms: number | null;
  created_at: string;
}

async function getChatLogs(search?: string): Promise<ChatQueryLog[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();

  // Type assertion needed until database types are regenerated after migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('chat_query_logs') as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (search) {
    query = query.ilike('query_text', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch chat logs:', error);
    return [];
  }

  return (data ?? []) as ChatQueryLog[];
}

export default async function ChatLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const logs = await getChatLogs(search);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Chat Query Logs</h1>
        <p className="mt-2 text-gray-400">
          Recent chat queries with timing and tool usage analytics (7-day retention)
        </p>
      </div>

      <ChatLogsTable logs={logs} initialSearch={search} />
    </div>
  );
}
