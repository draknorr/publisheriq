/**
 * ReviewVelocity Cube - Review velocity metrics
 *
 * Pre-computed velocity stats from review_velocity_stats materialized view.
 * Used for discovery, trend detection, and sync scheduling insights.
 */

cube('ReviewVelocity', {
  sql: `SELECT * FROM review_velocity_stats`,

  joins: {
    Apps: {
      relationship: 'one_to_one',
      sql: `${CUBE}.appid = ${Apps}.appid`,
    },
  },

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    // Velocity metrics
    velocity7d: {
      sql: `velocity_7d`,
      type: 'number',
      description: 'Average reviews per day over last 7 days',
    },
    velocity30d: {
      sql: `velocity_30d`,
      type: 'number',
      description: 'Average reviews per day over last 30 days',
    },
    // Reviews added
    reviewsAdded7d: {
      sql: `reviews_added_7d`,
      type: 'number',
      description: 'Total reviews added in last 7 days',
    },
    reviewsAdded30d: {
      sql: `reviews_added_30d`,
      type: 'number',
      description: 'Total reviews added in last 30 days',
    },
    // Velocity tier
    velocityTier: {
      sql: `velocity_tier`,
      type: 'string',
      description: 'high (>=5/day), medium (1-5), low (0.1-1), dormant (<0.1)',
    },
    // Data freshness
    lastDeltaDate: {
      sql: `last_delta_date`,
      type: 'time',
      description: 'Most recent delta record date',
    },
    actualSyncCount: {
      sql: `actual_sync_count`,
      type: 'number',
      description: 'Number of actual API syncs in the period',
    },
    // Velocity trend (7d vs 30d)
    velocityTrend: {
      sql: `CASE
        WHEN velocity_30d > 0 AND velocity_7d > velocity_30d * 1.2 THEN 'accelerating'
        WHEN velocity_30d > 0 AND velocity_7d < velocity_30d * 0.8 THEN 'decelerating'
        ELSE 'stable'
      END`,
      type: 'string',
      description: 'Whether review rate is accelerating, stable, or decelerating',
    },
  },

  measures: {
    count: {
      type: 'count',
      description: 'Number of apps with velocity data',
    },
    // Velocity aggregates
    avgVelocity7d: {
      sql: `velocity_7d`,
      type: 'avg',
    },
    avgVelocity30d: {
      sql: `velocity_30d`,
      type: 'avg',
    },
    maxVelocity7d: {
      sql: `velocity_7d`,
      type: 'max',
    },
    // Reviews added
    sumReviewsAdded7d: {
      sql: `reviews_added_7d`,
      type: 'sum',
    },
    sumReviewsAdded30d: {
      sql: `reviews_added_30d`,
      type: 'sum',
    },
    // Tier counts
    highVelocityCount: {
      sql: `CASE WHEN velocity_tier = 'high' THEN 1 ELSE 0 END`,
      type: 'sum',
    },
    mediumVelocityCount: {
      sql: `CASE WHEN velocity_tier = 'medium' THEN 1 ELSE 0 END`,
      type: 'sum',
    },
    lowVelocityCount: {
      sql: `CASE WHEN velocity_tier = 'low' THEN 1 ELSE 0 END`,
      type: 'sum',
    },
    dormantCount: {
      sql: `CASE WHEN velocity_tier = 'dormant' THEN 1 ELSE 0 END`,
      type: 'sum',
    },
  },

  segments: {
    // Velocity tiers
    highVelocity: {
      sql: `${CUBE}.velocity_tier = 'high'`,
    },
    mediumVelocity: {
      sql: `${CUBE}.velocity_tier = 'medium'`,
    },
    lowVelocity: {
      sql: `${CUBE}.velocity_tier = 'low'`,
    },
    dormant: {
      sql: `${CUBE}.velocity_tier = 'dormant'`,
    },
    // Active games (any recent reviews)
    active: {
      sql: `${CUBE}.velocity_7d > 0`,
    },
    // Trending games (accelerating velocity)
    accelerating: {
      sql: `${CUBE}.velocity_30d > 0 AND ${CUBE}.velocity_7d > ${CUBE}.velocity_30d * 1.2`,
    },
    // Declining games (decelerating velocity)
    decelerating: {
      sql: `${CUBE}.velocity_30d > 0 AND ${CUBE}.velocity_7d < ${CUBE}.velocity_30d * 0.8`,
    },
  },

  preAggregations: {
    // Cache velocity stats for fast lookups
    velocitySnapshot: {
      dimensions: [appid, velocity7d, velocity30d, velocityTier, reviewsAdded7d],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Tier distribution
    tierDistribution: {
      measures: [count, highVelocityCount, mediumVelocityCount, lowVelocityCount, dormantCount],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});
