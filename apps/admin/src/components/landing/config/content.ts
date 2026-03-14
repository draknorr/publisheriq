// All landing page copy and data - edit here, not in components

export const BANNER_PHRASES = [
  { action: 'Spot', object: 'breakout hits' },
  { action: 'Benchmark', object: 'competitors' },
  { action: 'Predict', object: 'trends' },
  { action: 'Ask', object: 'anything' },
] as const;

export const CHAT_PROMPTS = [
  'How is Balatro performing?',
  'Compare it to similar roguelike releases this year',
  "What's driving the sentiment shift in the last 30 days?",
  'Find me other games with this momentum pattern that I should watch',
] as const;

// ============ VIZ CARD DATA ============
export const CHART_DATA = [35, 42, 38, 55, 72, 68, 85, 92, 88, 95];

export const COMPARISON_DATA = [
  { name: 'Balatro', value: 95, color: '#00ffa3' },
  { name: 'Slay the Spire', value: 78, color: '#00b4ff' },
  { name: 'Inscryption', value: 72, color: '#a855f7' },
  { name: 'Hades', value: 88, color: '#00ffa3' },
];

export const SENTIMENT_DATA = [
  { day: 1, pos: 72 },
  { day: 5, pos: 68 },
  { day: 10, pos: 75 },
  { day: 15, pos: 82 },
  { day: 20, pos: 78 },
  { day: 25, pos: 85 },
  { day: 30, pos: 91 },
];

export const SENTIMENT_TAGS = ['gameplay', 'music', 'addictive'];

export const MOMENTUM_GAMES = ['Vampire Survivors', 'Cult of the Lamb', 'Dome Keeper'];

// ============ FEATURES ============
export const FEATURES = [
  {
    icon: 'MessageSquareText' as const,
    title: 'AI Chat Interface',
    description: 'Ask questions in plain English. Get instant answers backed by real data from Steam, Twitch, YouTube, and Epic — build and share insights in seconds.',
    accent: '#00ffa3',
  },
  {
    icon: 'BarChart3' as const,
    title: 'Real-Time Analytics',
    description: 'Track player counts, revenue estimates, review sentiment, and social metrics across 200K+ games from Steam, Twitch, YouTube, and Epic.',
    accent: '#00b4ff',
  },
  {
    icon: 'GitCompareArrows' as const,
    title: 'Competitive Intelligence',
    description: 'Compare games head-to-head, benchmark against genre averages, and spot market opportunities before competitors.',
    accent: '#a855f7',
  },
  {
    icon: 'TrendingUp' as const,
    title: 'Trend Detection',
    description: 'Automated alerts for breakout titles, sentiment shifts, and emerging genres. Never miss the next big thing.',
    accent: '#00ffa3',
  },
] as const;

// ============ STATS ============
export const STATS = [
  { value: '200K+', label: 'Games Tracked' },
  { value: '15M+', label: 'Data Points Daily' },
  { value: '500K+', label: 'Metric Updates / Day' },
  { value: '27', label: 'Data Dimensions' },
] as const;

// ============ FOOTER ============
export const FOOTER_LINKS = {
  author: { name: 'Ryan', url: 'https://www.ryanbohmann.com' },
} as const;
