/**
 * Methodology tooltip content for each metric column
 * Keys must match column IDs from companies-columns.ts
 */

export const methodologyContent: Record<string, string> = {
  // Engagement metrics
  hours: 'CCU × avg session length × 168 hours/week. Based on Steam API data.',
  owners: 'Estimated from SteamSpy data combined with review-to-owner ratios. Confidence: ±20%.',
  ccu: 'Highest concurrent players in last 24h, summed across all games.',

  // Content metrics
  games: 'Count of released, non-delisted games on Steam.',
  unique_developers: 'Number of unique developers this publisher has worked with.',

  // Review metrics
  reviews: 'All-time Steam reviews across all games.',
  avg_score: 'Positive reviews ÷ total reviews, weighted by recency.',
  review_velocity: 'Reviews per day over the last 7 days.',

  // Financial metrics
  revenue: 'Current Price x Estimated Owners. To-Be-Improved.',

  // Growth metrics
  growth_7d: '% change comparing average CCU of last 7 days to prior 7 days.',
  growth_30d: '% change comparing average CCU of last 30 days to prior 30 days.',
  trending: 'Games with >10% CCU change in positive (↑) or negative (↓) direction.',

  // Computed ratios
  revenue_per_game: 'Total estimated gross revenue ÷ game count. Higher = more successful titles on average.',
  owners_per_game: 'Total owners ÷ game count. Indicates average game reach.',
  reviews_per_1k_owners: 'Review rate per 1,000 owners. Higher = more engaged audience.',
};
