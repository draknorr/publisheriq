/**
 * Methodology tooltips for all metrics on the Games page
 * Provides users with context on how each metric is calculated and what it means
 */

export const methodology = {
  // Core metrics
  ccu_peak: 'Highest concurrent players in the last 24 hours from Steam API.',

  reviews:
    'Total Steam reviews with positive percentage badge. Higher percentages indicate better reception.',

  owners:
    'Estimated from SteamSpy data combined with review-to-owner ratios. Confidence: approximately 20%.',

  total_reviews: 'Total number of Steam reviews (positive + negative).',

  review_score:
    'Percentage of positive reviews. Calculated as (positive reviews / total reviews) * 100.',

  positive_percentage:
    'Percentage of positive reviews. Same as review score shown in badges.',

  price: 'Current Steam price. Shows discount percentage if on sale.',

  discount: 'Current Steam discount percentage. Only shown when game is on sale.',

  playtime:
    'Average playtime across all owners (forever) in hours. Based on Steam API data.',

  avg_playtime_forever:
    'Average playtime across all players since release. Based on Steam API data.',

  avg_playtime_2weeks:
    'Average playtime in the last 2 weeks. Indicates current engagement level.',

  sparkline:
    '7-day CCU trend visualization. Green indicates growth, red indicates decline.',

  // Growth metrics
  ccu_growth_7d:
    'Percentage change comparing average CCU of last 7 days to prior 7 days. Pre-computed hourly.',

  ccu_growth_30d:
    'Percentage change comparing average CCU of last 30 days to prior 30 days.',

  // Insight metrics
  momentum_score:
    'Combined trajectory signal: (CCU Growth 7d + Review Velocity Acceleration) / 2. Positive values indicate both player count and review activity are trending up.',

  sentiment_delta:
    'Change in positive review percentage: recent period vs prior period. Positive = improving perception, negative = declining (potential review bomb).',

  velocity_7d: 'Average new reviews per day over the last 7 days.',

  velocity_30d: 'Average new reviews per day over the last 30 days.',

  velocity_acceleration:
    'Velocity 7d minus Velocity 30d. Positive = review rate increasing, negative = review rate slowing.',

  active_player_pct:
    'Peak CCU divided by estimated owners. Shows what percentage of owners are actively playing now.',

  review_rate:
    'Reviews per 1,000 owners. Higher values indicate a more engaged or vocal community.',

  value_score:
    'Average playtime (hours) divided by price (dollars). Higher = more entertainment per dollar. Free games excluded.',

  vs_publisher_avg:
    "This game's review score minus publisher's average review score across all their games. Positive = outperforming publisher average.",

  // Timeline metrics
  days_live: 'Days since Steam release.',

  hype_duration:
    'Days between Steam page creation and release. Longer periods suggest more pre-release marketing.',

  release_date: 'Initial Steam release date.',

  // Activity tiers
  ccu_tier:
    'Activity tier based on CCU polling frequency. Tier 1 (Hot) = top 500 by CCU (hourly polling), Tier 2 (Active) = top 1000 new releases (2-hour polling), Tier 3 (Quiet) = all others (3x daily).',

  velocity_tier:
    'Review activity tier. High (5+ reviews/day), Medium (1-5), Low (0.1-1), Dormant (<0.1).',

  // Platform
  steam_deck:
    'Steam Deck compatibility status. Verified = fully supported, Playable = works with some caveats.',

  controller_support:
    'Controller support level. Full = complete controller support, Partial = some controller functionality.',

  platforms:
    'Available platforms: Windows, macOS, and/or Linux (SteamOS).',

  // Relationship
  publisher: 'Game publisher as listed on Steam.',

  developer: 'Game developer as listed on Steam.',

  publisher_game_count:
    "Total number of games from this publisher on Steam. Indie (<5), Mid (5-20), Major (20+).",
} as const;

/**
 * Get methodology text for a metric key
 */
export function getMethodology(key: keyof typeof methodology): string {
  return methodology[key] || '';
}
