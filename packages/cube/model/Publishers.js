/**
 * Publishers Cube - Publisher portfolio analytics
 *
 * Provides aggregated metrics for game publishers including
 * total games, estimated owners, CCU, and revenue estimates.
 */

cube('Publishers', {
  sql: `SELECT * FROM publishers`,

  joins: {
    AppPublishers: {
      relationship: 'one_to_many',
      sql: `${CUBE}.id = ${AppPublishers}.publisher_id`,
    },
    PublisherMetrics: {
      relationship: 'one_to_one',
      sql: `${CUBE}.id = ${PublisherMetrics}.publisher_id`,
    },
  },

  dimensions: {
    id: {
      sql: `id`,
      type: 'number',
      primaryKey: true,
    },
    name: {
      sql: `name`,
      type: 'string',
    },
    normalizedName: {
      sql: `normalized_name`,
      type: 'string',
      description: 'Lowercase name for lookups',
    },
    gameCount: {
      sql: `game_count`,
      type: 'number',
    },
    firstGameReleaseDate: {
      sql: `first_game_release_date`,
      type: 'time',
    },
    firstPageCreationDate: {
      sql: `first_page_creation_date`,
      type: 'time',
    },
  },

  measures: {
    count: {
      type: 'count',
      description: 'Total number of publishers',
    },
    totalGames: {
      sql: `game_count`,
      type: 'sum',
      description: 'Total games across all publishers',
    },
    avgGamesPerPublisher: {
      sql: `game_count`,
      type: 'avg',
    },
    publishersWithMultipleGames: {
      type: 'count',
      filters: [{ sql: `${CUBE}.game_count > 1` }],
    },
  },

  segments: {
    active: {
      sql: `${CUBE}.game_count > 0`,
    },
    prolific: {
      sql: `${CUBE}.game_count >= 10`,
    },
  },

  preAggregations: {
    // Publisher list with metrics (main list page)
    publisherList: {
      dimensions: [id, name, gameCount],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Publisher counts for dashboard
    publisherCounts: {
      measures: [count, totalGames, avgGamesPerPublisher],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});

/**
 * Publisher Metrics - Pre-computed aggregations from materialized view
 * This leverages the existing publisher_metrics materialized view
 */
cube('PublisherMetrics', {
  sql: `SELECT * FROM publisher_metrics`,

  dimensions: {
    publisherId: {
      sql: `publisher_id`,
      type: 'number',
      primaryKey: true,
    },
    publisherName: {
      sql: `publisher_name`,
      type: 'string',
    },
    gameCount: {
      sql: `game_count`,
      type: 'number',
    },
    totalOwners: {
      sql: `total_owners`,
      type: 'number',
      description: 'Estimated total owners across all games',
    },
    totalCcu: {
      sql: `total_ccu`,
      type: 'number',
      description: 'Total concurrent users',
    },
    avgReviewScore: {
      sql: `avg_review_score`,
      type: 'number',
    },
    totalReviews: {
      sql: `total_reviews`,
      type: 'number',
    },
    positiveReviews: {
      sql: `positive_reviews`,
      type: 'number',
    },
    revenueEstimateCents: {
      sql: `revenue_estimate_cents`,
      type: 'number',
    },
    revenueEstimateDollars: {
      sql: `ROUND(revenue_estimate_cents / 100.0, 2)`,
      type: 'number',
    },
    isTrending: {
      sql: `is_trending`,
      type: 'boolean',
    },
    uniqueDevelopers: {
      sql: `unique_developers`,
      type: 'number',
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
    sumOwners: {
      sql: `total_owners`,
      type: 'sum',
    },
    sumCcu: {
      sql: `total_ccu`,
      type: 'sum',
    },
    sumRevenue: {
      sql: `revenue_estimate_cents`,
      type: 'sum',
    },
    avgScore: {
      sql: `avg_review_score`,
      type: 'avg',
    },
    trendingCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.is_trending = true` }],
    },
  },

  segments: {
    trending: {
      sql: `${CUBE}.is_trending = true`,
    },
    highRevenue: {
      sql: `${CUBE}.revenue_estimate_cents > 100000000`, // > $1M
    },
    highOwners: {
      sql: `${CUBE}.total_owners > 100000`,
    },
  },

  preAggregations: {
    // Full metrics for list view (sorted by various fields)
    metricsListByOwners: {
      dimensions: [publisherId, publisherName, gameCount, totalOwners, totalCcu, avgReviewScore, revenueEstimateDollars, isTrending, estimatedWeeklyHours],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Aggregate stats for dashboard
    aggregateStats: {
      measures: [count, sumOwners, sumCcu, sumRevenue, avgScore, trendingCount],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});

/**
 * Publisher Year Metrics - Per-year aggregations for release year filtering
 * Use this cube when filtering publisher stats by release year
 */
cube('PublisherYearMetrics', {
  sql: `SELECT * FROM publisher_year_metrics`,

  dimensions: {
    publisherId: {
      sql: `publisher_id`,
      type: 'number',
      primaryKey: true,
    },
    publisherName: {
      sql: `publisher_name`,
      type: 'string',
    },
    releaseYear: {
      sql: `release_year`,
      type: 'number',
      description: 'Release year for filtering (e.g., 2025)',
    },
    gameCount: {
      sql: `game_count`,
      type: 'number',
      description: 'Number of games released in this year',
    },
    totalOwners: {
      sql: `total_owners`,
      type: 'number',
      description: 'Estimated owners for games released this year',
    },
    totalCcu: {
      sql: `total_ccu`,
      type: 'number',
      description: 'Total CCU for games released this year',
    },
    avgReviewScore: {
      sql: `avg_review_score`,
      type: 'number',
    },
    totalReviews: {
      sql: `total_reviews`,
      type: 'number',
    },
    revenueEstimateCents: {
      sql: `revenue_estimate_cents`,
      type: 'number',
    },
    revenueEstimateDollars: {
      sql: `ROUND(revenue_estimate_cents / 100.0, 2)`,
      type: 'number',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    sumGameCount: {
      sql: `game_count`,
      type: 'sum',
    },
    sumOwners: {
      sql: `total_owners`,
      type: 'sum',
    },
    sumCcu: {
      sql: `total_ccu`,
      type: 'sum',
    },
    sumRevenue: {
      sql: `revenue_estimate_cents`,
      type: 'sum',
    },
    avgScore: {
      sql: `avg_review_score`,
      type: 'avg',
    },
  },

  segments: {
    recent: {
      sql: `${CUBE}.release_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2`,
    },
  },
});

/**
 * Publisher Game Metrics - Per-game data for rolling period filtering
 * Use this cube for "past 12 months", "past 3 months" queries
 */
cube('PublisherGameMetrics', {
  sql: `SELECT * FROM publisher_game_metrics`,

  dimensions: {
    publisherId: {
      sql: `publisher_id`,
      type: 'number',
    },
    publisherName: {
      sql: `publisher_name`,
      type: 'string',
    },
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    gameName: {
      sql: `game_name`,
      type: 'string',
    },
    releaseDate: {
      sql: `release_date`,
      type: 'time',
      description: 'Release date for date-range filtering',
    },
    releaseYear: {
      sql: `release_year`,
      type: 'number',
    },
    owners: {
      sql: `owners`,
      type: 'number',
    },
    ccu: {
      sql: `ccu`,
      type: 'number',
    },
    totalReviews: {
      sql: `total_reviews`,
      type: 'number',
    },
    reviewScore: {
      sql: `review_score`,
      type: 'number',
    },
    revenueEstimateCents: {
      sql: `revenue_estimate_cents`,
      type: 'number',
    },
  },

  measures: {
    gameCount: {
      type: 'countDistinct',
      sql: `appid`,
    },
    sumOwners: {
      sql: `owners`,
      type: 'sum',
    },
    sumCcu: {
      sql: `ccu`,
      type: 'sum',
    },
    sumReviews: {
      sql: `total_reviews`,
      type: 'sum',
    },
    sumRevenue: {
      sql: `revenue_estimate_cents`,
      type: 'sum',
    },
    avgReviewScore: {
      sql: `review_score`,
      type: 'avg',
    },
    publisherCount: {
      type: 'countDistinct',
      sql: `publisher_id`,
    },
  },

  segments: {
    lastYear: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '1 year'`,
    },
    last6Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '6 months'`,
    },
    last3Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '3 months'`,
    },
    last30Days: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '30 days'`,
    },
  },
});
