import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'PublisherIQ Admin',
  description: 'Steam data acquisition admin dashboard',
};

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Sync Jobs' },
  { href: '/apps', label: 'Apps' },
  { href: '/publishers', label: 'Publishers' },
  { href: '/developers', label: 'Developers' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <div className="flex">
          {/* Sidebar */}
          <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-800 bg-gray-900">
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center border-b border-gray-800 px-6">
                <Link href="/" className="text-xl font-bold text-white">
                  PublisherIQ
                </Link>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-gray-800 p-4">
                <p className="text-xs text-gray-500">Steam Data Platform</p>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="ml-64 flex-1 min-h-screen">
            <div className="p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
