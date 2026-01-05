'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout';
import { SidebarProvider } from '@/contexts';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChat = pathname === '/chat';

  return (
    <SidebarProvider>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-screen-safe md:ml-64">
          {isChat ? (
            // Full height, no padding for chat page
            <div className="h-screen-safe">{children}</div>
          ) : (
            // Standard padding for other pages, overflow-x-hidden prevents horizontal scroll
            <div className="p-4 md:p-6 lg:p-8 overflow-x-hidden">{children}</div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
