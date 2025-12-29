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
      <ChatContainer initialQuery={initialQuery} />
    </div>
  );
}
