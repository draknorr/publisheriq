/**
 * Discovery Cube - Optimized game discovery with filters
 *
 * Pre-joined view combining Apps, LatestMetrics, Trends, and metadata
 * for efficient game filtering and discovery queries.
 */

cube('Discovery', {
  sql: `
    SELECT
      a.appid,
      a.name,
      a.type,
      a.is_free,
      a.current_price_cents,
      a.current_discount_percent,
      a.release_date,
      a.last_content_update,
      a.platforms,
      a.controller_support,
      a.pics_review_score,
      a.pics_review_percentage,
      a.is_released,
      a.is_delisted,
      a.metacritic_score,
      -- Steam Deck
      asd.category as steam_deck_category,
      -- Latest metrics (from materialized view - much faster than LATERAL join)
      ldm.owners_min,
      ldm.owners_max,
      ldm.owners_midpoint,
      ldm.ccu_peak,
      ldm.total_reviews,
      ldm.positive_reviews,
      ldm.review_score,
      ldm.positive_percentage,
      ldm.estimated_weekly_hours,
      -- Trends
      at.trend_30d_direction,
      at.trend_30d_change_pct,
      at.review_velocity_7d,
      at.ccu_trend_7d_pct
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_trends at ON a.appid = at.appid
    LEFT JOIN latest_daily_metrics ldm ON a.appid = ldm.appid
    WHERE a.type = 'game'
      AND a.is_delisted = false
  `,

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
    isFree: {
      sql: `is_free`,
      type: 'boolean',
    },
    priceCents: {
      sql: `current_price_cents`,
      type: 'number',
    },
    priceDollars: {
      sql: `ROUND(current_price_cents / 100.0, 2)`,
      type: 'number',
    },
    discountPercent: {
      sql: `current_discount_percent`,
      type: 'number',
    },
    releaseDate: {
      sql: `release_date`,
      type: 'time',
    },
    releaseYear: {
      sql: `EXTRACT(YEAR FROM ${CUBE}.release_date)::INTEGER`,
      type: 'number',
    },
    lastContentUpdate: {
      sql: `last_content_update`,
      type: 'time',
    },
    platforms: {
      sql: `platforms`,
      type: 'string',
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
    },
    steamDeckCategory: {
      sql: `steam_deck_category`,
      type: 'string',
    },
    isSteamDeckVerified: {
      sql: `steam_deck_category = 'verified'`,
      type: 'boolean',
    },
    isSteamDeckPlayable: {
      sql: `steam_deck_category IN ('verified', 'playable')`,
      type: 'boolean',
    },
    // Metrics
    ownersMidpoint: {
      sql: `owners_midpoint`,
      type: 'number',
    },
    ccuPeak: {
      sql: `ccu_peak`,
      type: 'number',
    },
    totalReviews: {
      sql: `total_reviews`,
      type: 'number',
    },
    positivePercentage: {
      sql: `positive_percentage`,
      type: 'number',
    },
    reviewScore: {
      sql: `review_score`,
      type: 'number',
    },
    picsReviewPercentage: {
      sql: `pics_review_percentage`,
      type: 'number',
    },
    // Combined review percentage - falls back to PICS data when daily_metrics is missing
    reviewPercentage: {
      sql: `COALESCE(positive_percentage, pics_review_percentage)`,
      type: 'number',
    },
    metacriticScore: {
      sql: `metacritic_score`,
      type: 'number',
    },
    // Trends
    trend30dDirection: {
      sql: `trend_30d_direction`,
      type: 'string',
    },
    trend30dChangePct: {
      sql: `trend_30d_change_pct`,
      type: 'number',
    },
    reviewVelocity7d: {
      sql: `review_velocity_7d`,
      type: 'number',
    },
    ccuTrend7dPct: {
      sql: `ccu_trend_7d_pct`,
      type: 'number',
    },
    isTrendingUp: {
      sql: `trend_30d_direction = 'up'`,
      type: 'boolean',
    },
    estimatedWeeklyHours: {
      sql: `estimated_weekly_hours`,
      type: 'number',
      title: 'Estimated Weekly Played Hours',
      description: 'ESTIMATE based on 7-day CCU × avg playtime. Not actual Steam data.',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    avgPrice: {
      sql: `current_price_cents`,
      type: 'avg',
      filters: [{ sql: `${CUBE}.is_free = false` }],
    },
    avgReviewPercentage: {
      sql: `positive_percentage`,
      type: 'avg',
    },
    sumOwners: {
      sql: `owners_midpoint`,
      type: 'sum',
    },
    sumCcu: {
      sql: `ccu_peak`,
      type: 'sum',
    },
  },

  segments: {
    released: {
      sql: `${CUBE}.is_released = true`,
    },
    free: {
      sql: `${CUBE}.is_free = true`,
    },
    paid: {
      sql: `${CUBE}.is_free = false`,
    },
    onSale: {
      sql: `${CUBE}.current_discount_percent > 0`,
    },
    highlyRated: {
      sql: `COALESCE(${CUBE}.positive_percentage, ${CUBE}.pics_review_percentage) >= 80`,
    },
    veryPositive: {
      sql: `COALESCE(${CUBE}.positive_percentage, ${CUBE}.pics_review_percentage) >= 90`,
    },
    overwhelminglyPositive: {
      sql: `COALESCE(${CUBE}.positive_percentage, ${CUBE}.pics_review_percentage) >= 95`,
    },
    hasMetacritic: {
      sql: `${CUBE}.metacritic_score IS NOT NULL`,
    },
    highMetacritic: {
      sql: `${CUBE}.metacritic_score >= 75`,
    },
    steamDeckVerified: {
      sql: `${CUBE}.steam_deck_category = 'verified'`,
    },
    steamDeckPlayable: {
      sql: `${CUBE}.steam_deck_category IN ('verified', 'playable')`,
    },
    trending: {
      sql: `${CUBE}.trend_30d_direction = 'up'`,
    },
    popular: {
      sql: `${CUBE}.total_reviews >= 1000`,
    },
    indie: {
      sql: `${CUBE}.owners_midpoint < 100000`,
    },
    mainstream: {
      sql: `${CUBE}.owners_midpoint >= 100000`,
    },
    releasedThisYear: {
      sql: `EXTRACT(YEAR FROM ${CUBE}.release_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    },
    recentlyReleased: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '30 days'`,
    },
    recentlyUpdated: {
      sql: `${CUBE}.last_content_update >= CURRENT_DATE - INTERVAL '30 days'`,
    },
    // Rolling period segments
    lastYear: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '1 year'`,
    },
    last6Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '6 months'`,
    },
    last3Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '3 months'`,
    },
    // Tag-based segments
    vrGame: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%VR%')`,
    },
    roguelike: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%rogue%')`,
    },
    roguelite: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%rogue%')`,
    },
    multiplayer: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%multiplayer%')`,
    },
    singleplayer: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%single%player%')`,
    },
    coop: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND (st.name ILIKE '%co-op%' OR st.name ILIKE '%coop%'))`,
    },
    openWorld: {
      sql: `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = ${CUBE}.appid AND st.name ILIKE '%open world%')`,
    },
  },

  preAggregations: {
    // Discovery list with all key fields (main cache)
    discoveryList: {
      dimensions: [
        appid, name, isFree, priceDollars, platforms, steamDeckCategory,
        ownersMidpoint, ccuPeak, totalReviews, positivePercentage,
        trend30dDirection, trend30dChangePct, estimatedWeeklyHours
      ],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Count by filters (for filter UI counts)
    countsByFilters: {
      measures: [count],
      dimensions: [isFree, steamDeckCategory, trend30dDirection],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Free vs Paid breakdown
    pricingBreakdown: {
      measures: [count, avgPrice, avgReviewPercentage],
      dimensions: [isFree],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});

/**
 * Genres cube for filtering
 */
cube('Genres', {
  sql: `SELECT * FROM steam_genres`,

  dimensions: {
    genreId: {
      sql: `genre_id`,
      type: 'number',
      primaryKey: true,
    },
    name: {
      sql: `name`,
      type: 'string',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
  },
});

/**
 * AppGenres junction for genre filtering
 */
cube('AppGenres', {
  sql: `SELECT *, CONCAT(appid, '-', genre_id) as id FROM app_genres`,

  joins: {
    Apps: {
      relationship: 'many_to_one',
      sql: `${CUBE}.appid = ${Apps}.appid`,
    },
    Genres: {
      relationship: 'many_to_one',
      sql: `${CUBE}.genre_id = ${Genres}.genreId`,
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: 'string',
      primaryKey: true,
    },
    appid: {
      sql: `appid`,
      type: 'number',
    },
    genreId: {
      sql: `genre_id`,
      type: 'number',
    },
    isPrimary: {
      sql: `is_primary`,
      type: 'boolean',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
  },
});

/**
 * Tags cube for filtering
 */
cube('Tags', {
  sql: `SELECT * FROM steam_tags`,

  dimensions: {
    tagId: {
      sql: `tag_id`,
      type: 'number',
      primaryKey: true,
    },
    name: {
      sql: `name`,
      type: 'string',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
  },
});

/**
 * AppTags junction for tag filtering
 */
cube('AppTags', {
  sql: `SELECT *, CONCAT(appid, '-', tag_id) as id FROM app_steam_tags`,

  joins: {
    Apps: {
      relationship: 'many_to_one',
      sql: `${CUBE}.appid = ${Apps}.appid`,
    },
    Tags: {
      relationship: 'many_to_one',
      sql: `${CUBE}.tag_id = ${Tags}.tagId`,
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: 'string',
      primaryKey: true,
    },
    appid: {
      sql: `appid`,
      type: 'number',
    },
    tagId: {
      sql: `tag_id`,
      type: 'number',
    },
    rank: {
      sql: `rank`,
      type: 'number',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
  },
});
