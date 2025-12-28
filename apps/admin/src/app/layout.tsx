import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout';
import './globals.css';

export const metadata: Metadata = {
  title: 'PublisherIQ Admin',
  description: 'Steam data acquisition admin dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">
        <div className="flex">
          <Sidebar />
          <main className="ml-64 flex-1 min-h-screen">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
