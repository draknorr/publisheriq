import { getSupabase } from '@/lib/supabase';
import type { App, AppsFilterParams, AggregateStats, CcuTier, VelocityTier } from './apps-types';

/**
 * Aggregate stats row shape from RPC
 * Typed here until database types are regenerated after migration
 */
interface AggregateStatsRow {
  total_games: number;
  avg_ccu: number | null;
  avg_score: number | null;
  avg_momentum: number | null;
  trending_up_count: number;
  trending_down_count: number;
  sentiment_improving_count: number;
  sentiment_declining_count: number;
  avg_value_score: number | null;
}

/**
 * Fetch apps from the database using the unified RPC
 * Note: Uses type assertion until database types are regenerated after migration
 */
export async function getApps(params: AppsFilterParams): Promise<App[]> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_apps_with_filters', {
    p_type: params.type,
    p_sort_field: params.sort,
    p_sort_order: params.order,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
    p_search: params.search,
    // Metric filters
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_min_playtime: params.minPlaytime,
    p_max_playtime: params.maxPlaytime,
    // Growth filters
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_min_growth_30d: params.minGrowth30d,
    p_max_growth_30d: params.maxGrowth30d,
    p_min_momentum: params.minMomentum,
    p_max_momentum: params.maxMomentum,
    // Sentiment filters
    p_min_sentiment_delta: params.minSentimentDelta,
    p_max_sentiment_delta: params.maxSentimentDelta,
    p_velocity_tier: params.velocityTier,
    // Engagement filters
    p_min_active_pct: params.minActivePct,
    p_min_review_rate: params.minReviewRate,
    p_min_value_score: params.minValueScore,
    // Content filters
    p_genres: params.genres,
    p_genre_mode: params.genreMode ?? 'any',
    p_tags: params.tags,
    p_tag_mode: params.tagMode ?? 'any',
    p_categories: params.categories,
    p_has_workshop: params.hasWorkshop,
    // Platform filters
    p_platforms: params.platforms,
    p_platform_mode: params.platformMode ?? 'any',
    p_steam_deck: params.steamDeck,
    p_controller: params.controller,
    // Release filters
    p_min_age: params.minAge,
    p_max_age: params.maxAge,
    p_release_year: params.releaseYear,
    p_early_access: params.earlyAccess,
    p_min_hype: params.minHype,
    p_max_hype: params.maxHype,
    // Relationship filters
    p_publisher_search: params.publisherSearch,
    p_developer_search: params.developerSearch,
    p_self_published: params.selfPublished,
    p_min_vs_publisher: params.minVsPublisher,
    p_publisher_size: params.publisherSize,
    // Activity filters
    p_ccu_tier: params.ccuTier,
  });

  if (error) {
    console.error('Error fetching apps:', error);
    throw new Error(`Failed to fetch apps: ${error.message}`);
  }

  return (data ?? []) as App[];
}

/**
 * Fetch aggregate statistics for filtered apps
 * Note: Uses type assertion until database types are regenerated after migration
 */
export async function getAggregateStats(
  params: AppsFilterParams
): Promise<AggregateStats> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_apps_aggregate_stats', {
    p_type: params.type,
    p_search: params.search,
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_genres: params.genres,
    p_tags: params.tags,
    p_categories: params.categories,
    p_steam_deck: params.steamDeck,
    p_ccu_tier: params.ccuTier,
  });

  if (error) {
    console.error('Error fetching aggregate stats:', error);
    return {
      total_games: 0,
      avg_ccu: null,
      avg_score: null,
      avg_momentum: null,
      trending_up_count: 0,
      trending_down_count: 0,
      sentiment_improving_count: 0,
      sentiment_declining_count: 0,
      avg_value_score: null,
    };
  }

  // RPC returns a single row
  const rows = (data ?? []) as AggregateStatsRow[];
  const row = rows[0];
  if (!row) {
    return {
      total_games: 0,
      avg_ccu: null,
      avg_score: null,
      avg_momentum: null,
      trending_up_count: 0,
      trending_down_count: 0,
      sentiment_improving_count: 0,
      sentiment_declining_count: 0,
      avg_value_score: null,
    };
  }
  return {
    total_games: Number(row.total_games) || 0,
    avg_ccu: row.avg_ccu ? Number(row.avg_ccu) : null,
    avg_score: row.avg_score ? Number(row.avg_score) : null,
    avg_momentum: row.avg_momentum ? Number(row.avg_momentum) : null,
    trending_up_count: Number(row.trending_up_count) || 0,
    trending_down_count: Number(row.trending_down_count) || 0,
    sentiment_improving_count: Number(row.sentiment_improving_count) || 0,
    sentiment_declining_count: Number(row.sentiment_declining_count) || 0,
    avg_value_score: row.avg_value_score ? Number(row.avg_value_score) : null,
  };
}

/**
 * Format large numbers compactly (e.g., 1.2M, 5.6K)
 */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format price in cents to USD string (e.g., $19.99)
 */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  if (cents === 0) return 'Free';
  const usd = cents / 100;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format percentage (e.g., 85%)
 */
export function formatPercentage(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

/**
 * Format playtime from minutes to hours
 */
export function formatPlaytime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return '—';
  const hours = minutes / 60;
  if (hours >= 100) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Get user-facing label for app type
 */
export function getAppTypeLabel(type: string): string {
  switch (type) {
    case 'game':
      return 'Game';
    case 'dlc':
      return 'DLC';
    case 'demo':
      return 'Demo';
    case 'mod':
      return 'Mod';
    case 'video':
      return 'Video';
    case 'hardware':
      return 'Hardware';
    case 'music':
      return 'Music';
    default:
      return type;
  }
}

/**
 * Fetch specific apps by their IDs for comparison mode
 * Preserves order of input IDs in output
 *
 * Note: Uses multiple queries because growth/velocity metrics come from
 * different tables (ccu_tier_assignments, review_velocity_stats) that
 * the Supabase client can't easily JOIN.
 */
export async function getAppsByIds(appids: number[]): Promise<App[]> {
  if (appids.length === 0) return [];

  const supabase = getSupabase();

  // Query 1: Apps with basic metrics from latest_daily_metrics
  // Note: average_playtime columns come from daily_metrics, not apps
  const { data: appsData, error: appsError } = await supabase
    .from('apps')
    .select(
      `
      appid,
      name,
      type,
      is_free,
      current_price_cents,
      current_discount_percent,
      release_date,
      release_state,
      platforms,
      controller_support,
      latest_daily_metrics!inner (
        ccu_peak,
        owners_min,
        owners_max,
        owners_midpoint,
        total_reviews,
        positive_reviews,
        review_score,
        positive_percentage,
        price_cents,
        metric_date
      )
    `
    )
    .in('appid', appids);

  if (appsError) {
    console.error('Error fetching apps by IDs:', appsError);
    throw new Error(`Failed to fetch apps by IDs: ${appsError.message}`);
  }

  if (!appsData || appsData.length === 0) return [];

  // Query 2: CCU tier assignments (growth metrics)
  const { data: ccuData } = await supabase
    .from('ccu_tier_assignments')
    .select('appid, ccu_growth_7d_percent, ccu_growth_30d_percent, ccu_tier')
    .in('appid', appids);

  const ccuMap = new Map<number, { growth7d: number | null; growth30d: number | null; tier: number | null }>();
  if (ccuData) {
    ccuData.forEach((row) => {
      ccuMap.set(row.appid, {
        growth7d: row.ccu_growth_7d_percent,
        growth30d: row.ccu_growth_30d_percent,
        tier: row.ccu_tier,
      });
    });
  }

  // Query 3: Review velocity stats
  const { data: velocityData } = await supabase
    .from('review_velocity_stats')
    .select('appid, velocity_7d, velocity_30d, velocity_tier')
    .in('appid', appids);

  const velocityMap = new Map<number, { v7d: number | null; v30d: number | null; tier: string | null }>();
  if (velocityData) {
    velocityData.forEach((row) => {
      velocityMap.set(row.appid, {
        v7d: row.velocity_7d,
        v30d: row.velocity_30d,
        tier: row.velocity_tier,
      });
    });
  }

  // Query 4: app_filter_data for publisher/developer/steam_deck info
  // This materialized view pre-computes data that requires junction table joins
  const { data: filterData } = await supabase
    .from('app_filter_data')
    .select('appid, publisher_id, publisher_name, publisher_game_count, developer_id, developer_name, steam_deck_category')
    .in('appid', appids);

  const filterDataMap = new Map<number, {
    publisher_id: number | null;
    publisher_name: string | null;
    publisher_game_count: number | null;
    developer_id: number | null;
    developer_name: string | null;
    steam_deck_category: string | null;
  }>();
  if (filterData) {
    filterData.forEach((row) => {
      filterDataMap.set(row.appid, {
        publisher_id: row.publisher_id,
        publisher_name: row.publisher_name,
        publisher_game_count: row.publisher_game_count,
        developer_id: row.developer_id,
        developer_name: row.developer_name,
        steam_deck_category: row.steam_deck_category,
      });
    });
  }

  // Query 5: Playtime from daily_metrics (latest record per app)
  // Using RPC would be better, but for now fetch raw and filter
  const { data: playtimeData } = await supabase
    .from('daily_metrics')
    .select('appid, average_playtime_forever, average_playtime_2weeks, metric_date')
    .in('appid', appids)
    .order('metric_date', { ascending: false });

  // Get latest playtime per app
  const playtimeMap = new Map<number, { forever: number | null; twoWeeks: number | null }>();
  if (playtimeData) {
    playtimeData.forEach((row) => {
      // Only set if not already present (we're ordered desc by date)
      if (!playtimeMap.has(row.appid)) {
        playtimeMap.set(row.appid, {
          forever: row.average_playtime_forever,
          twoWeeks: row.average_playtime_2weeks,
        });
      }
    });
  }

  // Transform to App shape and compute derived metrics
  const appsMap = new Map<number, App>();
  const now = new Date();

  for (const row of appsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    const metrics = r.latest_daily_metrics;
    const filterInfo = filterDataMap.get(r.appid);

    // Get growth metrics from ccu_tier_assignments
    const ccuTier = ccuMap.get(r.appid);
    const growth7d = ccuTier?.growth7d ?? null;
    const growth30d = ccuTier?.growth30d ?? null;
    const tier = ccuTier?.tier ?? null;

    // Get velocity metrics from review_velocity_stats
    const velocity = velocityMap.get(r.appid);
    const velocity7d = velocity?.v7d ?? null;
    const velocity30d = velocity?.v30d ?? null;
    const velocityTier = velocity?.tier ?? null;

    // Calculate days_live
    let daysLive: number | null = null;
    let hypeDuration: number | null = null;
    if (r.release_date) {
      const releaseDate = new Date(r.release_date);
      daysLive = Math.floor(
        (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (r.release_state === 'prerelease' && daysLive < 0) {
        hypeDuration = Math.abs(daysLive);
        daysLive = null;
      }
    }

    // Compute derived metrics (matching RPC logic)
    const ownersMid = metrics?.owners_midpoint ?? 0;
    const ccuPeak = metrics?.ccu_peak ?? 0;
    const totalReviews = metrics?.total_reviews ?? 0;
    const playtime = playtimeMap.get(r.appid);
    const playtimeForever = playtime?.forever ?? null;
    const playtime2Weeks = playtime?.twoWeeks ?? null;
    const priceCents = metrics?.price_cents ?? r.current_price_cents ?? 0;

    // Active player percentage: (CCU / owners) * 100
    const activePlayerPct =
      ownersMid > 0 ? Math.round((ccuPeak / ownersMid) * 10000) / 100 : null;

    // Review rate: reviews per 1K owners
    const reviewRate =
      ownersMid > 0 ? Math.round((totalReviews / ownersMid) * 100000) / 100 : null;

    // Value score: hours per dollar (only for paid games)
    const valueScore =
      !r.is_free && priceCents > 0 && playtimeForever && playtimeForever > 0
        ? Math.round(((playtimeForever / 60) / (priceCents / 100)) * 100) / 100
        : null;

    // Velocity acceleration: 7d - 30d velocity
    const velocityAccel =
      velocity7d !== null && velocity30d !== null
        ? Math.round((velocity7d - velocity30d) * 10000) / 10000
        : null;

    // Momentum score: (growth_7d + velocity_acceleration) / 2
    const momentumScore =
      growth7d !== null
        ? Math.round((growth7d + (velocityAccel ?? 0)) * 100) / 200
        : null;

    const app: App = {
      appid: r.appid,
      name: r.name,
      type: r.type,
      is_free: r.is_free,
      ccu_peak: ccuPeak,
      owners_min: metrics?.owners_min ?? 0,
      owners_max: metrics?.owners_max ?? 0,
      owners_midpoint: ownersMid,
      total_reviews: totalReviews,
      positive_reviews: metrics?.positive_reviews ?? 0,
      review_score: metrics?.review_score ?? null,
      positive_percentage: metrics?.positive_percentage ?? null,
      price_cents: priceCents,
      current_discount_percent: r.current_discount_percent ?? 0,
      average_playtime_forever: playtimeForever,
      average_playtime_2weeks: playtime2Weeks,
      ccu_growth_7d_percent: growth7d,
      ccu_growth_30d_percent: growth30d,
      ccu_tier: tier as CcuTier | null,
      velocity_7d: velocity7d,
      velocity_30d: velocity30d,
      velocity_tier: velocityTier as VelocityTier | null,
      sentiment_delta: null, // Would need app_trends join to compute
      momentum_score: momentumScore,
      velocity_acceleration: velocityAccel,
      active_player_pct: activePlayerPct,
      review_rate: reviewRate,
      value_score: valueScore,
      vs_publisher_avg: null, // Would need publisher_metrics join to compute
      release_date: r.release_date,
      days_live: daysLive,
      hype_duration: hypeDuration,
      release_state: r.release_state,
      platforms: r.platforms,
      steam_deck_category: filterInfo?.steam_deck_category ?? null,
      controller_support: r.controller_support,
      publisher_id: filterInfo?.publisher_id ?? null,
      publisher_name: filterInfo?.publisher_name ?? null,
      publisher_game_count: filterInfo?.publisher_game_count ?? null,
      developer_id: filterInfo?.developer_id ?? null,
      developer_name: filterInfo?.developer_name ?? null,
      metric_date: metrics?.metric_date ?? null,
      data_updated_at: null,
    };

    appsMap.set(r.appid, app);
  }

  // Return in original order
  return appids.map((id) => appsMap.get(id)).filter((app): app is App => !!app);
}
