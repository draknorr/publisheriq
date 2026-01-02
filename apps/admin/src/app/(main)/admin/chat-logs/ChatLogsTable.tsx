'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/sync-queries';
import type { ChatQueryLog } from './page';

function formatMs(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatLogsTable({
  logs,
  initialSearch,
}: {
  logs: ChatQueryLog[];
  initialSearch?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch ?? '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    router.push(`/admin/chat-logs?${params.toString()}`);
  };

  const avgResponseTime =
    logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.timing_total_ms ?? 0), 0) / logs.length)
      : null;

  const avgToolCalls =
    logs.length > 0
      ? (logs.reduce((sum, l) => sum + l.tool_count, 0) / logs.length).toFixed(1)
      : '-';

  const queriesWithTools = logs.filter((l) => l.tool_count > 0).length;

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search queries..."
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
        >
          Search
        </button>
      </form>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Total Queries</p>
          <p className="text-2xl font-bold text-white">{logs.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Avg Response Time</p>
          <p className="text-2xl font-bold text-white">{formatMs(avgResponseTime)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Avg Tool Calls</p>
          <p className="text-2xl font-bold text-white">{avgToolCalls}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Queries with Tools</p>
          <p className="text-2xl font-bold text-white">{queriesWithTools}</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Query
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Tools
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Timing
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Response
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                When
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="max-w-md truncate text-sm text-white" title={log.query_text}>
                    {log.query_text}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {log.tool_names.map((tool) => (
                      <span
                        key={tool}
                        className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400"
                      >
                        {tool}
                      </span>
                    ))}
                    {log.tool_names.length === 0 && (
                      <span className="text-xs text-gray-500">None</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    <span className="text-white">{formatMs(log.timing_total_ms)}</span>
                    <div className="text-xs text-gray-500">
                      LLM: {formatMs(log.timing_llm_ms)} | Tools: {formatMs(log.timing_tools_ms)}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-300">{log.response_length} chars</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">
                    {formatRelativeTime(log.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-400">No chat logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
