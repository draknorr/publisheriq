import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'PublisherIQ - Gaming Industry Intelligence',
  description:
    'AI-powered gaming analytics platform. Track 200K+ Steam games, analyze player trends, and get instant answers with natural language queries.',
};

export default function Page() {
  return <LandingPage />;
}
