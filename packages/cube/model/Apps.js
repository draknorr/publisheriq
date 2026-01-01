/**
 * Apps Cube - Central entity for all Steam games/apps
 *
 * This is the primary cube that joins to Publishers, Developers,
 * and DailyMetrics for comprehensive game analytics.
 */

cube('Apps', {
  sql: `SELECT * FROM apps WHERE type = 'game'`,

  // Join to related cubes
  joins: {
    AppPublishers: {
      relationship: 'one_to_many',
      sql: `${CUBE}.appid = ${AppPublishers}.appid`,
    },
    AppDevelopers: {
      relationship: 'one_to_many',
      sql: `${CUBE}.appid = ${AppDevelopers}.appid`,
    },
    AppTrends: {
      relationship: 'one_to_one',
      sql: `${CUBE}.appid = ${AppTrends}.appid`,
    },
    AppSteamDeck: {
      relationship: 'one_to_one',
      sql: `${CUBE}.appid = ${AppSteamDeck}.appid`,
    },
  },

  // Dimensions - attributes for filtering and grouping
  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    name: {
      sql: `name`,
      type: 'string',
    },
    type: {
      sql: `type`,
      type: 'string',
    },
    isFree: {
      sql: `is_free`,
      type: 'boolean',
    },
    currentPriceCents: {
      sql: `current_price_cents`,
      type: 'number',
    },
    currentPriceDollars: {
      sql: `ROUND(current_price_cents / 100.0, 2)`,
      type: 'number',
    },
    releaseDate: {
      sql: `release_date`,
      type: 'time',
    },
    platforms: {
      sql: `platforms`,
      type: 'string',
      description: 'Comma-separated: windows,macos,linux',
    },
    hasWindows: {
      sql: `platforms LIKE '%windows%'`,
      type: 'boolean',
    },
    hasMac: {
      sql: `platforms LIKE '%macos%'`,
      type: 'boolean',
    },
    hasLinux: {
      sql: `platforms LIKE '%linux%'`,
      type: 'boolean',
    },
    controllerSupport: {
      sql: `controller_support`,
      type: 'string',
      description: 'full, partial, or null',
    },
    picsReviewScore: {
      sql: `pics_review_score`,
      type: 'number',
      description: 'Review score 1-9 from PICS',
    },
    picsReviewPercentage: {
      sql: `pics_review_percentage`,
      type: 'number',
      description: 'Positive review percentage 0-100',
    },
    isReleased: {
      sql: `is_released`,
      type: 'boolean',
    },
    isDelisted: {
      sql: `is_delisted`,
      type: 'boolean',
    },
    metacriticScore: {
      sql: `metacritic_score`,
      type: 'number',
    },
    createdAt: {
      sql: `created_at`,
      type: 'time',
    },
    updatedAt: {
      sql: `updated_at`,
      type: 'time',
    },
  },

  // Measures - aggregations
  measures: {
    count: {
      type: 'count',
      description: 'Total number of games',
    },
    freeCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.is_free = true` }],
      description: 'Number of free games',
    },
    paidCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.is_free = false` }],
      description: 'Number of paid games',
    },
    releasedCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.is_released = true` }],
      description: 'Number of released games',
    },
    avgPrice: {
      sql: `current_price_cents`,
      type: 'avg',
      filters: [{ sql: `${CUBE}.is_free = false AND ${CUBE}.current_price_cents > 0` }],
      description: 'Average price in cents for paid games',
    },
    avgPriceDollars: {
      sql: `ROUND(${avgPrice} / 100.0, 2)`,
      type: 'number',
      description: 'Average price in dollars',
    },
    avgReviewScore: {
      sql: `pics_review_score`,
      type: 'avg',
      filters: [{ sql: `${CUBE}.pics_review_score IS NOT NULL` }],
    },
    avgReviewPercentage: {
      sql: `pics_review_percentage`,
      type: 'avg',
      filters: [{ sql: `${CUBE}.pics_review_percentage IS NOT NULL` }],
    },
  },

  // Segments - pre-defined filters
  segments: {
    released: {
      sql: `${CUBE}.is_released = true AND ${CUBE}.is_delisted = false`,
    },
    free: {
      sql: `${CUBE}.is_free = true`,
    },
    paid: {
      sql: `${CUBE}.is_free = false`,
    },
    highlyRated: {
      sql: `${CUBE}.pics_review_percentage >= 80`,
    },
    steamDeckVerified: {
      sql: `EXISTS (SELECT 1 FROM app_steam_deck asd WHERE asd.appid = ${CUBE}.appid AND asd.category = 'verified')`,
    },
  },

  // Pre-aggregations for performance
  preAggregations: {
    // Main counts by various dimensions
    appCounts: {
      measures: [count, freeCount, paidCount, releasedCount, avgPrice, avgReviewPercentage],
      dimensions: [isFree, isReleased],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Apps by release date for timeline charts
    appsByReleaseDate: {
      measures: [count],
      timeDimension: releaseDate,
      granularity: 'month',
      refreshKey: {
        every: '24 hours',
      },
    },
  },
});

// Junction cube for App-Publisher relationship
cube('AppPublishers', {
  sql: `SELECT * FROM app_publishers`,

  joins: {
    Apps: {
      relationship: 'many_to_one',
      sql: `${CUBE}.appid = ${Apps}.appid`,
    },
    Publishers: {
      relationship: 'many_to_one',
      sql: `${CUBE}.publisher_id = ${Publishers}.id`,
    },
  },

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
    },
    publisherId: {
      sql: `publisher_id`,
      type: 'number',
    },
  },
});

// Junction cube for App-Developer relationship
cube('AppDevelopers', {
  sql: `SELECT * FROM app_developers`,

  joins: {
    Apps: {
      relationship: 'many_to_one',
      sql: `${CUBE}.appid = ${Apps}.appid`,
    },
    Developers: {
      relationship: 'many_to_one',
      sql: `${CUBE}.developer_id = ${Developers}.id`,
    },
  },

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
    },
    developerId: {
      sql: `developer_id`,
      type: 'number',
    },
  },
});

// App Trends cube
cube('AppTrends', {
  sql: `SELECT * FROM app_trends`,

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    trend30dDirection: {
      sql: `trend_30d_direction`,
      type: 'string',
    },
    trend30dChangePct: {
      sql: `trend_30d_change_pct`,
      type: 'number',
    },
    trend90dDirection: {
      sql: `trend_90d_direction`,
      type: 'string',
    },
    trend90dChangePct: {
      sql: `trend_90d_change_pct`,
      type: 'number',
    },
    currentPositiveRatio: {
      sql: `current_positive_ratio`,
      type: 'number',
    },
    reviewVelocity7d: {
      sql: `review_velocity_7d`,
      type: 'number',
    },
    reviewVelocity30d: {
      sql: `review_velocity_30d`,
      type: 'number',
    },
    ccuTrend7dPct: {
      sql: `ccu_trend_7d_pct`,
      type: 'number',
    },
  },

  measures: {
    avgTrend30d: {
      sql: `trend_30d_change_pct`,
      type: 'avg',
    },
    trendingUpCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.trend_30d_direction = 'up'` }],
    },
    trendingDownCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.trend_30d_direction = 'down'` }],
    },
  },
});

// Steam Deck compatibility cube
cube('AppSteamDeck', {
  sql: `SELECT * FROM app_steam_deck`,

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    category: {
      sql: `category`,
      type: 'string',
      description: 'unknown, unsupported, playable, verified',
    },
  },

  measures: {
    verifiedCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.category = 'verified'` }],
    },
    playableCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.category = 'playable'` }],
    },
    unsupportedCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.category = 'unsupported'` }],
    },
  },
});
