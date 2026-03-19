/**
 * Chat-only cubes for richer game lookup and DLC relationship answers.
 *
 * These are additive semantic surfaces used by the chat interface so we can
 * improve lookup/discovery answer quality without changing existing page
 * contracts or RPC behavior.
 */

cube('GameCatalog', {
  sql: `
    SELECT
      a.appid,
      a.name,
      a.type,
      a.is_free,
      a.current_price_cents,
      a.current_discount_percent,
      a.release_date,
      a.release_state,
      a.is_released,
      a.parent_appid,
      a.platforms,
      a.controller_support,
      afd.publisher_id,
      afd.publisher_name,
      afd.developer_id,
      afd.developer_name,
      afd.steam_deck_category,
      ldm.metric_date,
      ldm.total_reviews,
      ldm.positive_percentage,
      ldm.owners_midpoint,
      ldm.ccu_peak,
      a.pics_review_percentage
    FROM apps a
    LEFT JOIN app_filter_data afd ON afd.appid = a.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
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
    type: {
      sql: `type`,
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
    releaseState: {
      sql: `release_state`,
      type: 'string',
    },
    isReleased: {
      sql: `is_released`,
      type: 'boolean',
    },
    parentAppid: {
      sql: `parent_appid`,
      type: 'number',
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
    publisherId: {
      sql: `publisher_id`,
      type: 'number',
    },
    publisherName: {
      sql: `publisher_name`,
      type: 'string',
    },
    developerId: {
      sql: `developer_id`,
      type: 'number',
    },
    developerName: {
      sql: `developer_name`,
      type: 'string',
    },
    metricDate: {
      sql: `metric_date`,
      type: 'time',
    },
    totalReviews: {
      sql: `total_reviews`,
      type: 'number',
    },
    positivePercentage: {
      sql: `positive_percentage`,
      type: 'number',
    },
    reviewPercentage: {
      sql: `COALESCE(positive_percentage, pics_review_percentage)`,
      type: 'number',
    },
    ownersMidpoint: {
      sql: `owners_midpoint`,
      type: 'number',
    },
    ccuPeak: {
      sql: `ccu_peak`,
      type: 'number',
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
      sql: `COALESCE(positive_percentage, pics_review_percentage)`,
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
    popular: {
      sql: `${CUBE}.total_reviews >= 1000`,
    },
    releasedThisYear: {
      sql: `EXTRACT(YEAR FROM ${CUBE}.release_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    },
    lastYear: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '1 year'`,
    },
    last6Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '6 months'`,
    },
    last3Months: {
      sql: `${CUBE}.release_date >= CURRENT_DATE - INTERVAL '3 months'`,
    },
    steamDeckVerified: {
      sql: `${CUBE}.steam_deck_category = 'verified'`,
    },
    steamDeckPlayable: {
      sql: `${CUBE}.steam_deck_category IN ('verified', 'playable')`,
    },
  },
});

cube('DlcRelations', {
  sql: `
    SELECT
      CONCAT(d.parent_appid, '-', d.dlc_appid) AS relation_id,
      d.parent_appid,
      parent.name AS parent_name,
      d.dlc_appid,
      child.name AS dlc_name,
      child.type AS dlc_type,
      child.release_date AS dlc_release_date,
      child.is_released AS dlc_is_released,
      child.release_state AS dlc_release_state,
      d.source,
      d.created_at,
      child.appid IS NOT NULL AS child_metadata_available
    FROM app_dlc d
    LEFT JOIN apps parent ON parent.appid = d.parent_appid
    LEFT JOIN apps child ON child.appid = d.dlc_appid
  `,

  dimensions: {
    relationId: {
      sql: `relation_id`,
      type: 'string',
      primaryKey: true,
    },
    parentAppid: {
      sql: `parent_appid`,
      type: 'number',
    },
    parentName: {
      sql: `parent_name`,
      type: 'string',
    },
    dlcAppid: {
      sql: `dlc_appid`,
      type: 'number',
    },
    dlcName: {
      sql: `dlc_name`,
      type: 'string',
    },
    dlcType: {
      sql: `dlc_type`,
      type: 'string',
    },
    dlcReleaseDate: {
      sql: `dlc_release_date`,
      type: 'time',
    },
    dlcIsReleased: {
      sql: `dlc_is_released`,
      type: 'boolean',
    },
    dlcReleaseState: {
      sql: `dlc_release_state`,
      type: 'string',
    },
    source: {
      sql: `source`,
      type: 'string',
    },
    createdAt: {
      sql: `created_at`,
      type: 'time',
    },
    childMetadataAvailable: {
      sql: `child_metadata_available`,
      type: 'boolean',
    },
  },

  measures: {
    count: {
      type: 'count',
    },
  },

  segments: {
    metadataAvailable: {
      sql: `${CUBE}.child_metadata_available = true`,
    },
    missingMetadata: {
      sql: `${CUBE}.child_metadata_available = false`,
    },
  },
});
