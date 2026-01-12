'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, TopHeader } from '@/components/layout';
import { SidebarProvider } from '@/contexts';
import { GlobalSearchProvider, GlobalSearch } from '@/components/search';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChat = pathname === '/chat';

  return (
    <SidebarProvider>
      <GlobalSearchProvider>
        <div className="flex">
          <Sidebar />
          <div className="flex-1 min-w-0 min-h-screen-safe md:ml-64 flex flex-col">
            {/* Sticky top header with search */}
            <TopHeader />
            {/* Main content area */}
            <main className="flex-1">
              {isChat ? (
                // Full remaining height for chat page (subtract 3.5rem header)
                <div className="h-[calc(100dvh-3.5rem)]">{children}</div>
              ) : (
                // Standard padding for other pages
                <div className="p-4 md:p-6 lg:p-8 overflow-x-hidden">{children}</div>
              )}
            </main>
          </div>
        </div>
        <GlobalSearch />
      </GlobalSearchProvider>
    </SidebarProvider>
  );
}
