import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout';
import { Card, CardTitle } from '@/components/ui';
import {
  Sparkles,
  Pin,
  Bell,
  Search,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Users,
  Layers,
  Zap,
  Shield,
  Activity,
  Gamepad2,
  Sun,
  Gauge,
  Clock,
  Tag,
} from 'lucide-react';

export const metadata: Metadata = {
  title: "What's New",
  description: 'See the latest features and improvements in PublisherIQ',
};

interface FeatureItem {
  title: string;
  description: string;
}

interface UpdateSection {
  icon: React.ReactNode;
  title: string;
  features: FeatureItem[];
}

function FeatureList({ features }: { features: FeatureItem[] }) {
  return (
    <div className="space-y-4">
      {features.map((feature, index) => (
        <div key={index}>
          <h4 className="text-body font-medium text-text-primary mb-1">
            {feature.title}
          </h4>
          <p className="text-body-sm text-text-secondary">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

function UpdateCard({ section }: { section: UpdateSection }) {
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10">
          {section.icon}
        </div>
        <CardTitle>{section.title}</CardTitle>
      </div>
      <FeatureList features={section.features} />
    </Card>
  );
}

const updates: UpdateSection[] = [
  {
    icon: <Sparkles className="h-5 w-5 text-accent-primary" />,
    title: 'Personalization & Discovery',
    features: [
      {
        title: 'Personalized Dashboard',
        description:
          'Pin your favorite games, publishers, and developers for quick access. Your pins appear on a dedicated "My Dashboard" tab in Insights, so you can track everything important to you in one place.',
      },
      {
        title: 'Smart Alerts',
        description:
          'Get notified when something important happens to games you follow. Alert types include player count spikes, review surges, price changes, new releases from publishers you follow, and major milestones. Customize which alerts you want and adjust sensitivity per game or globally.',
      },
      {
        title: 'Natural Language Search',
        description:
          'Describe what you\'re looking for in plain English. Try "cozy farming games with crafting" or "tactical roguelikes with deck building" - no need to know exact tags or categories.',
      },
      {
        title: 'Trending Discovery',
        description:
          'Find games gaining momentum right now. Discover "breaking out" games - hidden gems getting noticed. See which games have accelerating interest or track games with declining attention.',
      },
      {
        title: 'Smarter Chat Suggestions',
        description:
          'Get helpful autocomplete suggestions as you type. After each response, see related questions you might want to ask to keep exploring.',
      },
    ],
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-accent-cyan" />,
    title: 'Real-Time Player Tracking',
    features: [
      {
        title: 'Insights Dashboard',
        description:
          'A dedicated analytics page with visual charts. See player counts, reviews, and trends at a glance with mini sparkline charts. Switch between 24 hours, 7 days, or 30 days of data.',
      },
      {
        title: 'Live Player Counts',
        description:
          'See exact current player numbers for games. Track how player counts change over time with top games updated hourly.',
      },
      {
        title: 'Multiple Views',
        description:
          'Browse Top Games by current player counts, Newest releases sortable by date or growth, and Trending games that are growing fastest.',
      },
    ],
  },
  {
    icon: <Zap className="h-5 w-5 text-accent-yellow" />,
    title: 'Faster & Smarter',
    features: [
      {
        title: 'Faster Updates',
        description:
          'Game similarity search is dramatically faster. Platform updates happen more quickly across the board with better handling of games gaining sudden attention.',
      },
      {
        title: 'Improved Search Reliability',
        description:
          'More reliable results when searching. Smart spelling corrections find "co-op" even if you type "coop", and searches fall back to related categories when specific tags return nothing.',
      },
    ],
  },
  {
    icon: <Shield className="h-5 w-5 text-accent-green" />,
    title: 'Authentication & Activity Tracking',
    features: [
      {
        title: 'Secure Sign-In',
        description:
          'Sign in with just your email - no password needed. Receive a secure magic link to log in, and your activity and preferences are saved to your account.',
      },
      {
        title: 'Review Activity Tracking',
        description:
          'See which games are getting the most reviews right now. Track review velocity and discover games with increasing attention.',
      },
      {
        title: 'Better Game Search in Chat',
        description:
          'Ask about specific games by name and get more accurate results when searching for titles.',
      },
    ],
  },
  {
    icon: <Sun className="h-5 w-5 text-accent-orange" />,
    title: 'Fresh New Look',
    features: [
      {
        title: 'Light & Dark Mode',
        description:
          'Choose between light and dark themes. Automatically matches your system preference, and your choice is remembered.',
      },
      {
        title: 'Faster Page Loading',
        description:
          'Pages load noticeably faster. Less waiting, more discovering.',
      },
      {
        title: 'Playtime Estimates',
        description:
          'See estimated weekly and monthly hours played to understand player engagement at a glance.',
      },
      {
        title: 'Discount Discovery',
        description:
          'Ask about games on sale and find deals through chat.',
      },
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div>
      <PageHeader
        title="What's New"
        description="See what's been added to PublisherIQ"
      />

      <div className="max-w-3xl">
        {updates.map((section, index) => (
          <UpdateCard key={index} section={section} />
        ))}
      </div>
    </div>
  );
}
