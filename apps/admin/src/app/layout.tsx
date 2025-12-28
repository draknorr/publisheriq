import type { Metadata, Viewport } from 'next';
import { Sidebar } from '@/components/layout';
import { SidebarProvider } from '@/contexts';
import './globals.css';

export const metadata: Metadata = {
  title: 'PublisherIQ Admin',
  description: 'Steam data acquisition admin dashboard',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">
        <SidebarProvider>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 min-h-screen md:ml-64">
              <div className="p-4 md:p-6 lg:p-8">{children}</div>
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
