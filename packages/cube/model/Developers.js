/**
 * Developers Cube - Developer portfolio analytics
 *
 * Provides aggregated metrics for game developers including
 * total games, estimated owners, CCU, and revenue estimates.
 */

cube('Developers', {
  sql: `SELECT * FROM developers`,

  joins: {
    AppDevelopers: {
      relationship: 'one_to_many',
      sql: `${CUBE}.id = ${AppDevelopers}.developer_id`,
    },
    DeveloperMetrics: {
      relationship: 'one_to_one',
      sql: `${CUBE}.id = ${DeveloperMetrics}.developer_id`,
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
      description: 'Total number of developers',
    },
    totalGames: {
      sql: `game_count`,
      type: 'sum',
      description: 'Total games across all developers',
    },
    avgGamesPerDeveloper: {
      sql: `game_count`,
      type: 'avg',
    },
    developersWithMultipleGames: {
      type: 'count',
      filters: [{ sql: `${CUBE}.game_count > 1` }],
    },
  },

  segments: {
    active: {
      sql: `${CUBE}.game_count > 0`,
    },
    prolific: {
      sql: `${CUBE}.game_count >= 5`,
    },
  },

  preAggregations: {
    // Developer list with basic info
    developerList: {
      dimensions: [id, name, gameCount],
      refreshKey: {
        every: '6 hours',
      },
    },
    // Developer counts for dashboard
    developerCounts: {
      measures: [count, totalGames, avgGamesPerDeveloper],
      refreshKey: {
        every: '6 hours',
      },
    },
  },
});

/**
 * Developer Metrics - Pre-computed aggregations from materialized view
 * This leverages the existing developer_metrics materialized view
 */
cube('DeveloperMetrics', {
  sql: `SELECT * FROM developer_metrics`,

  dimensions: {
    developerId: {
      sql: `developer_id`,
      type: 'number',
      primaryKey: true,
    },
    developerName: {
      sql: `developer_name`,
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
      sql: `${CUBE}.revenue_estimate_cents > 10000000`, // > $100K
    },
    highOwners: {
      sql: `${CUBE}.total_owners > 50000`,
    },
  },

  preAggregations: {
    // Full metrics for list view
    metricsListByOwners: {
      dimensions: [developerId, developerName, gameCount, totalOwners, totalCcu, avgReviewScore, revenueEstimateDollars, isTrending],
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
