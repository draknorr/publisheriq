import { PageHeader } from '@/components/layout';
import { ChatContainer } from '@/components/chat';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: initialQuery } = await searchParams;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <PageHeader
        title="Chat"
        description="Ask questions about Steam games, publishers, and trends in natural language"
      />
      <ChatContainer initialQuery={initialQuery} />
    </div>
  );
}
