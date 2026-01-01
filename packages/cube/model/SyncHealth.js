/**
 * SyncHealth Cube - Operational dashboard metrics
 *
 * Provides sync job monitoring, queue status, and health metrics
 * for the admin dashboard.
 */

cube('SyncJobs', {
  sql: `SELECT * FROM sync_jobs`,

  dimensions: {
    id: {
      sql: `id`,
      type: 'string',
      primaryKey: true,
    },
    jobType: {
      sql: `job_type`,
      type: 'string',
    },
    status: {
      sql: `status`,
      type: 'string',
    },
    startedAt: {
      sql: `started_at`,
      type: 'time',
    },
    completedAt: {
      sql: `completed_at`,
      type: 'time',
    },
    itemsProcessed: {
      sql: `items_processed`,
      type: 'number',
    },
    itemsSucceeded: {
      sql: `items_succeeded`,
      type: 'number',
    },
    itemsFailed: {
      sql: `items_failed`,
      type: 'number',
    },
    durationSeconds: {
      sql: `EXTRACT(EPOCH FROM (completed_at - started_at))`,
      type: 'number',
    },
    successRate: {
      sql: `CASE WHEN items_processed > 0 THEN ROUND(items_succeeded * 100.0 / items_processed, 1) ELSE NULL END`,
      type: 'number',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    completedCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.status = 'completed'` }],
    },
    failedCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.status = 'failed'` }],
    },
    runningCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.status = 'running'` }],
    },
    totalProcessed: {
      sql: `items_processed`,
      type: 'sum',
    },
    totalSucceeded: {
      sql: `items_succeeded`,
      type: 'sum',
    },
    totalFailed: {
      sql: `items_failed`,
      type: 'sum',
    },
    avgDuration: {
      sql: `EXTRACT(EPOCH FROM (completed_at - started_at))`,
      type: 'avg',
    },
    avgSuccessRate: {
      sql: `CASE WHEN items_processed > 0 THEN items_succeeded * 100.0 / items_processed ELSE NULL END`,
      type: 'avg',
    },
  },

  segments: {
    last24Hours: {
      sql: `${CUBE}.started_at >= NOW() - INTERVAL '24 hours'`,
    },
    last7Days: {
      sql: `${CUBE}.started_at >= NOW() - INTERVAL '7 days'`,
    },
    completed: {
      sql: `${CUBE}.status = 'completed'`,
    },
    failed: {
      sql: `${CUBE}.status = 'failed'`,
    },
  },

  preAggregations: {
    // Job stats for dashboard (last 24h)
    recentJobStats: {
      measures: [count, completedCount, failedCount, totalProcessed, totalSucceeded, totalFailed, avgSuccessRate],
      dimensions: [jobType, status],
      timeDimension: startedAt,
      granularity: 'hour',
      partitionGranularity: 'day',
      refreshKey: {
        every: '15 minutes',
      },
      buildRangeStart: {
        sql: `SELECT NOW() - INTERVAL '7 days'`,
      },
      buildRangeEnd: {
        sql: `SELECT NOW()`,
      },
    },
    // Daily job summary
    dailyJobSummary: {
      measures: [count, completedCount, failedCount, avgSuccessRate, avgDuration],
      dimensions: [jobType],
      timeDimension: startedAt,
      granularity: 'day',
      refreshKey: {
        every: '1 hour',
      },
    },
  },
});

/**
 * SyncStatus Cube - Per-app sync state
 */
cube('SyncStatus', {
  sql: `SELECT * FROM sync_status`,

  dimensions: {
    appid: {
      sql: `appid`,
      type: 'number',
      primaryKey: true,
    },
    isSyncable: {
      sql: `is_syncable`,
      type: 'boolean',
    },
    priorityScore: {
      sql: `priority_score`,
      type: 'number',
    },
    refreshTier: {
      sql: `refresh_tier`,
      type: 'string',
    },
    consecutiveErrors: {
      sql: `consecutive_errors`,
      type: 'number',
    },
    lastErrorSource: {
      sql: `last_error_source`,
      type: 'string',
    },
    lastErrorAt: {
      sql: `last_error_at`,
      type: 'time',
    },
    nextSyncAfter: {
      sql: `next_sync_after`,
      type: 'time',
    },
    // Last sync timestamps
    lastSteamspySync: {
      sql: `last_steamspy_sync`,
      type: 'time',
    },
    lastStorefrontSync: {
      sql: `last_storefront_sync`,
      type: 'time',
    },
    lastReviewsSync: {
      sql: `last_reviews_sync`,
      type: 'time',
    },
    lastPicsSync: {
      sql: `last_pics_sync`,
      type: 'time',
    },
    lastEmbeddingSync: {
      sql: `last_embedding_sync`,
      type: 'time',
    },
    // Derived fields
    isOverdue: {
      sql: `next_sync_after < NOW()`,
      type: 'boolean',
    },
    hasErrors: {
      sql: `consecutive_errors > 0`,
      type: 'boolean',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    syncableCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.is_syncable = true` }],
    },
    overdueCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.next_sync_after < NOW() AND ${CUBE}.is_syncable = true` }],
    },
    errorCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.consecutive_errors > 0` }],
    },
    avgPriorityScore: {
      sql: `priority_score`,
      type: 'avg',
    },
    // Source completion counts
    hasSteamspyCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.last_steamspy_sync IS NOT NULL` }],
    },
    hasStorefrontCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.last_storefront_sync IS NOT NULL` }],
    },
    hasReviewsCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.last_reviews_sync IS NOT NULL` }],
    },
    hasPicsCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.last_pics_sync IS NOT NULL` }],
    },
    hasEmbeddingCount: {
      type: 'count',
      filters: [{ sql: `${CUBE}.last_embedding_sync IS NOT NULL` }],
    },
  },

  segments: {
    syncable: {
      sql: `${CUBE}.is_syncable = true`,
    },
    overdue: {
      sql: `${CUBE}.next_sync_after < NOW() AND ${CUBE}.is_syncable = true`,
    },
    withErrors: {
      sql: `${CUBE}.consecutive_errors > 0`,
    },
    active: {
      sql: `${CUBE}.refresh_tier = 'active'`,
    },
    moderate: {
      sql: `${CUBE}.refresh_tier = 'moderate'`,
    },
    dormant: {
      sql: `${CUBE}.refresh_tier = 'dormant'`,
    },
  },

  preAggregations: {
    // Overall health stats
    healthStats: {
      measures: [count, syncableCount, overdueCount, errorCount, avgPriorityScore],
      refreshKey: {
        every: '15 minutes',
      },
    },
    // Source completion stats
    sourceCompletion: {
      measures: [syncableCount, hasSteamspyCount, hasStorefrontCount, hasReviewsCount, hasPicsCount, hasEmbeddingCount],
      refreshKey: {
        every: '1 hour',
      },
    },
    // Breakdown by refresh tier
    tierBreakdown: {
      measures: [count, overdueCount, errorCount],
      dimensions: [refreshTier],
      refreshKey: {
        every: '15 minutes',
      },
    },
    // Queue status (overdue by time bucket)
    queueStatus: {
      measures: [overdueCount],
      dimensions: [refreshTier],
      refreshKey: {
        every: '5 minutes',
      },
    },
  },
});

/**
 * PICS Sync State - Global PICS sync tracking
 */
cube('PicsSyncState', {
  sql: `SELECT * FROM pics_sync_state WHERE id = 1`,

  dimensions: {
    id: {
      sql: `id`,
      type: 'number',
      primaryKey: true,
    },
    lastChangeNumber: {
      sql: `last_change_number`,
      type: 'number',
    },
    lastSyncAt: {
      sql: `last_sync_at`,
      type: 'time',
    },
    appsProcessed: {
      sql: `apps_processed`,
      type: 'number',
    },
    packagesProcessed: {
      sql: `packages_processed`,
      type: 'number',
    },
  },

  measures: {
    latestChangeNumber: {
      sql: `last_change_number`,
      type: 'max',
    },
  },
});
