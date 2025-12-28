'use client';

import { Sidebar } from '@/components/layout';
import { SidebarProvider } from '@/contexts';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-screen md:ml-64">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
