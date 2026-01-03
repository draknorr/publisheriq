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
        <main className="flex-1 min-h-screen md:ml-64">
          {isChat ? (
            // Full height, no padding for chat page
            <div className="h-screen">{children}</div>
          ) : (
            // Standard padding for other pages
            <div className="p-4 md:p-6 lg:p-8">{children}</div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
