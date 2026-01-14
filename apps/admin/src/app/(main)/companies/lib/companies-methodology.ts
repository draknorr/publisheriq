/**
 * Methodology tooltip content for each metric column
 * Copied from spec Reference Data > Methodology Tooltip Content
 */

export const methodologyContent: Record<string, string> = {
  estimated_weekly_hours:
    'CCU × avg session length × 168 hours/week. Based on Steam API data.',
  game_count: 'Count of released, non-delisted games on Steam.',
  total_owners:
    'Estimated from SteamSpy data combined with review-to-owner ratios. Confidence: ±20%.',
  total_ccu: 'Highest concurrent players in last 24h, summed across all games.',
  revenue_estimate_cents:
    'Median price × estimated owners × regional adjustments. Confidence: ±30%. Does not include DLC or MTX.',
  ccu_growth_7d_percent:
    '% change comparing average CCU of last 7 days to prior 7 days.',
  ccu_growth_30d_percent:
    '% change comparing average CCU of last 30 days to prior 30 days.',
  avg_review_score: 'Positive reviews ÷ total reviews, weighted by recency.',
  total_reviews: 'All-time Steam reviews across all games.',
  review_velocity_7d: 'Number of new reviews received in the last 7 days.',
  games_trending_up: 'Games with >10% CCU change in positive direction.',
  games_trending_down: 'Games with >10% CCU change in negative direction.',
  revenue_per_game: 'Total estimated revenue ÷ game count.',
  owners_per_game: 'Total owners ÷ game count.',
  reviews_per_1k_owners:
    'Review rate per 1,000 owners. Higher = more engaged audience.',
};
