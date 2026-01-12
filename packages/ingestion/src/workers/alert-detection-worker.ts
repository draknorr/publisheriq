/**
 * Alert Detection Worker
 *
 * Detects anomalies in pinned entities and creates alerts for users.
 * Runs hourly via GitHub Actions after CCU sync completes.
 *
 * Alert types detected:
 * - ccu_spike: CCU > 50% above 7-day average
 * - ccu_drop: CCU > 50% below 7-day average
 * - trend_reversal: 30-day trend direction changed
 * - review_surge: Review velocity > 3x normal
 * - sentiment_shift: Positive ratio changed > 5%
 * - milestone: Review count crossed threshold (10K, 100K, 1M)
 *
 * Run with: pnpm --filter @publisheriq/ingestion alert-detection
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, ALERT_THRESHOLDS } from '@publisheriq/shared';

const log = logger.child({ worker: 'alert-detection' });

type AlertType =
  | 'ccu_spike'
  | 'ccu_drop'
  | 'trend_reversal'
  | 'review_surge'
  | 'sentiment_shift'
  | 'milestone';

type AlertSeverity = 'low' | 'medium' | 'high';

interface PinnedEntity {
  user_id: string;
  pin_id: string;
  entity_type: 'game' | 'publisher' | 'developer';
  entity_id: number;
  display_name: string;
  ccu_current: number | null;
  ccu_7d_avg: number | null;
  review_velocity: number | null;
  positive_ratio: number | null;
  total_reviews: number | null;
  price_cents: number | null;
  discount_percent: number | null;
  trend_30d_direction: string | null;
  sensitivity_ccu: number;
  sensitivity_review: number;
  sensitivity_sentiment: number;
  alerts_enabled: boolean;
  // Per-alert-type toggles (merged from pin and global settings)
  alert_ccu_spike: boolean;
  alert_ccu_drop: boolean;
  alert_trend_reversal: boolean;
  alert_review_surge: boolean;
  alert_sentiment_shift: boolean;
  alert_price_change: boolean;
  alert_new_release: boolean;
  alert_milestone: boolean;
}

interface DetectionState {
  entity_type: string;
  entity_id: number;
  ccu_7d_avg: number | null;
  ccu_prev_value: number | null;
  review_velocity_7d_avg: number | null;
  positive_ratio_prev: number | null;
  total_reviews_prev: number | null;
  trend_30d_direction_prev: string | null;
}

interface DetectionResult {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metricName: string;
  previousValue: number | null;
  currentValue: number | null;
  changePercent: number | null;
}

interface AlertInsert {
  user_id: string;
  pin_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric_name: string;
  previous_value: number | null;
  current_value: number | null;
  change_percent: number | null;
  dedup_key: string;
}

function detectCcuAnomaly(
  entity: PinnedEntity,
  baseline: DetectionState | null,
  sensitivity: number
): DetectionResult | null {
  const current = entity.ccu_current;

  // Skip if no current CCU or too low to matter
  if (!current || current < ALERT_THRESHOLDS.CCU_MIN_ABSOLUTE) {
    return null;
  }

  // Use baseline 7d avg if available, otherwise use entity's ccu_7d_avg, otherwise skip
  const avg = baseline?.ccu_7d_avg ?? entity.ccu_7d_avg;
  if (!avg || avg === 0) {
    return null;
  }

  const changePercent = ((current - avg) / avg) * 100;
  // Higher sensitivity = lower threshold (more alerts)
  const threshold = ALERT_THRESHOLDS.CCU_CHANGE_PERCENT / sensitivity;

  if (changePercent > threshold) {
    const severity: AlertSeverity = changePercent > 100 ? 'high' : 'medium';
    return {
      alertType: 'ccu_spike',
      severity,
      title: `CCU Spike: +${changePercent.toFixed(0)}%`,
      description: `${entity.display_name} CCU jumped from ${avg.toLocaleString()} to ${current.toLocaleString()}`,
      metricName: 'ccu',
      previousValue: avg,
      currentValue: current,
      changePercent,
    };
  } else if (changePercent < -threshold) {
    const severity: AlertSeverity = changePercent < -75 ? 'high' : 'medium';
    return {
      alertType: 'ccu_drop',
      severity,
      title: `CCU Drop: ${changePercent.toFixed(0)}%`,
      description: `${entity.display_name} CCU dropped from ${avg.toLocaleString()} to ${current.toLocaleString()}`,
      metricName: 'ccu',
      previousValue: avg,
      currentValue: current,
      changePercent,
    };
  }

  return null;
}

function detectTrendReversal(
  entity: PinnedEntity,
  baseline: DetectionState | null
): DetectionResult | null {
  const current = entity.trend_30d_direction;
  const previous = baseline?.trend_30d_direction_prev;

  // Need both current and previous to detect reversal
  if (!current || !previous) {
    return null;
  }

  // Check if direction changed (up->down, down->up)
  const isReversal =
    (previous === 'up' && current === 'down') || (previous === 'down' && current === 'up');

  if (!isReversal) {
    return null;
  }

  const direction = current === 'up' ? 'upward' : 'downward';
  return {
    alertType: 'trend_reversal',
    severity: 'medium',
    title: `Trend Reversal: Now ${direction}`,
    description: `${entity.display_name} trend changed from ${previous} to ${current}`,
    metricName: 'trend',
    previousValue: null,
    currentValue: null,
    changePercent: null,
  };
}

function detectReviewSurge(
  entity: PinnedEntity,
  baseline: DetectionState | null,
  sensitivity: number
): DetectionResult | null {
  const currentVelocity = entity.review_velocity;

  // Skip if velocity too low
  if (!currentVelocity || currentVelocity < ALERT_THRESHOLDS.REVIEW_MIN_DAILY) {
    return null;
  }

  const avgVelocity = baseline?.review_velocity_7d_avg ?? currentVelocity / 2;
  if (!avgVelocity || avgVelocity === 0) {
    return null;
  }

  // Higher sensitivity = lower multiplier threshold (more alerts)
  const threshold = ALERT_THRESHOLDS.REVIEW_VELOCITY_MULTIPLIER / sensitivity;
  const multiplier = currentVelocity / avgVelocity;

  if (multiplier >= threshold) {
    const severity: AlertSeverity = multiplier >= 5 ? 'high' : 'medium';
    return {
      alertType: 'review_surge',
      severity,
      title: `Review Surge: ${multiplier.toFixed(1)}x normal`,
      description: `${entity.display_name} is receiving ${currentVelocity.toFixed(1)} reviews/day (normally ${avgVelocity.toFixed(1)})`,
      metricName: 'review_velocity',
      previousValue: avgVelocity,
      currentValue: currentVelocity,
      changePercent: (multiplier - 1) * 100,
    };
  }

  return null;
}

function detectSentimentShift(
  entity: PinnedEntity,
  baseline: DetectionState | null,
  sensitivity: number
): DetectionResult | null {
  const currentRatio = entity.positive_ratio;
  const totalReviews = entity.total_reviews;

  // Need enough reviews for ratio to be meaningful
  if (
    !currentRatio ||
    !totalReviews ||
    totalReviews < ALERT_THRESHOLDS.SENTIMENT_MIN_REVIEWS
  ) {
    return null;
  }

  const previousRatio = baseline?.positive_ratio_prev;
  if (previousRatio === null || previousRatio === undefined) {
    return null;
  }

  // Calculate change in positive percentage points
  const changePercent = (currentRatio - previousRatio) * 100;
  // Higher sensitivity = lower threshold (more alerts)
  const threshold = ALERT_THRESHOLDS.SENTIMENT_CHANGE_PERCENT / sensitivity;

  if (Math.abs(changePercent) >= threshold) {
    const direction = changePercent > 0 ? 'improved' : 'declined';
    const severity: AlertSeverity = 'medium';
    return {
      alertType: 'sentiment_shift',
      severity,
      title: `Sentiment ${direction}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
      description: `${entity.display_name} positive ratio changed from ${(previousRatio * 100).toFixed(0)}% to ${(currentRatio * 100).toFixed(0)}%`,
      metricName: 'positive_ratio',
      previousValue: previousRatio,
      currentValue: currentRatio,
      changePercent,
    };
  }

  return null;
}

function detectMilestone(
  entity: PinnedEntity,
  baseline: DetectionState | null
): DetectionResult | null {
  const currentReviews = entity.total_reviews;
  const previousReviews = baseline?.total_reviews_prev;

  if (!currentReviews || !previousReviews) {
    return null;
  }

  // Check if we crossed any milestone threshold
  for (const milestone of ALERT_THRESHOLDS.MILESTONES) {
    if (previousReviews < milestone && currentReviews >= milestone) {
      const milestoneLabel =
        milestone >= 1000000
          ? `${(milestone / 1000000).toFixed(0)}M`
          : `${(milestone / 1000).toFixed(0)}K`;

      const severity: AlertSeverity = milestone >= 100000 ? 'high' : 'medium';
      return {
        alertType: 'milestone',
        severity,
        title: `Milestone: ${milestoneLabel} reviews`,
        description: `${entity.display_name} has reached ${currentReviews.toLocaleString()} reviews`,
        metricName: 'total_reviews',
        previousValue: previousReviews,
        currentValue: currentReviews,
        changePercent: null,
      };
    }
  }

  return null;
}

function generateDedupKey(
  userId: string,
  entityType: string,
  entityId: number,
  alertType: AlertType
): string {
  const today = new Date().toISOString().split('T')[0];
  return `${userId}:${entityType}:${entityId}:${alertType}:${today}`;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  log.info('Starting alert detection', { githubRunId });

  const supabase = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Note: Using 'any' cast because user_pins, user_alerts, and alert_detection_state tables
  // are created by migration 20260112000001_add_personalization.sql. Types will be available
  // after applying migration and running: pnpm --filter database generate
  // See: docs/architecture/personalized-dashboard.md#type-safety-notes
  const db = supabase as any;

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'alert_detection',
      github_run_id: githubRunId,
      status: 'running',
    })
    .select()
    .single();

  let entitiesProcessed = 0;
  let alertsCreated = 0;
  let statesUpdated = 0;

  try {
    // Fetch all pinned entities with current metrics
    const { data: pinnedEntities, error: fetchError } = await db.rpc(
      'get_pinned_entities_with_metrics'
    );

    if (fetchError) {
      throw new Error(`Failed to fetch pinned entities: ${fetchError.message}`);
    }

    if (!pinnedEntities || pinnedEntities.length === 0) {
      log.info('No pinned entities to process');

      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: 0,
            items_succeeded: 0,
            items_failed: 0,
          })
          .eq('id', job.id);
      }
      return;
    }

    log.info('Fetched pinned entities', { count: pinnedEntities.length });

    // Get unique entities to fetch baseline state for
    const uniqueEntities = new Map<string, { type: string; id: number }>();
    for (const entity of pinnedEntities as PinnedEntity[]) {
      const key = `${entity.entity_type}:${entity.entity_id}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, { type: entity.entity_type, id: entity.entity_id });
      }
    }

    // Fetch baseline detection states for all unique entities
    const entityIds = Array.from(uniqueEntities.values()).map((e) => e.id);
    const { data: statesData } = await db
      .from('alert_detection_state')
      .select('*')
      .in('entity_id', entityIds);

    // Build lookup map for baseline states
    const stateMap = new Map<string, DetectionState>();
    if (statesData) {
      for (const state of statesData as DetectionState[]) {
        const key = `${state.entity_type}:${state.entity_id}`;
        stateMap.set(key, state);
      }
    }

    log.info('Fetched baseline states', { count: stateMap.size });

    // Collect alerts to insert and states to update
    const alertsToInsert: AlertInsert[] = [];
    const statesToUpdate: Array<{
      entity_type: string;
      entity_id: number;
      ccu_7d_avg: number | null;
      ccu_prev_value: number | null;
      review_velocity_7d_avg: number | null;
      positive_ratio_prev: number | null;
      total_reviews_prev: number | null;
      trend_30d_direction_prev: string | null;
    }> = [];

    // Track which entities we've processed for state updates
    const processedEntities = new Set<string>();

    for (const entity of pinnedEntities as PinnedEntity[]) {
      entitiesProcessed++;

      // Skip if alerts disabled for this user
      if (!entity.alerts_enabled) {
        continue;
      }

      const stateKey = `${entity.entity_type}:${entity.entity_id}`;
      const baseline = stateMap.get(stateKey) ?? null;

      // Run detection functions based on per-alert-type toggles
      const detections: (DetectionResult | null)[] = [];

      // CCU spike/drop detection (single function returns either spike or drop)
      if (entity.alert_ccu_spike || entity.alert_ccu_drop) {
        const ccuResult = detectCcuAnomaly(entity, baseline, entity.sensitivity_ccu);
        // Only include if the specific alert type is enabled
        if (ccuResult) {
          if (
            (ccuResult.alertType === 'ccu_spike' && entity.alert_ccu_spike) ||
            (ccuResult.alertType === 'ccu_drop' && entity.alert_ccu_drop)
          ) {
            detections.push(ccuResult);
          }
        }
      }

      // Trend reversal detection
      if (entity.alert_trend_reversal) {
        detections.push(detectTrendReversal(entity, baseline));
      }

      // Review surge detection
      if (entity.alert_review_surge) {
        detections.push(detectReviewSurge(entity, baseline, entity.sensitivity_review));
      }

      // Sentiment shift detection
      if (entity.alert_sentiment_shift) {
        detections.push(detectSentimentShift(entity, baseline, entity.sensitivity_sentiment));
      }

      // Milestone detection
      if (entity.alert_milestone) {
        detections.push(detectMilestone(entity, baseline));
      }

      // Create alerts for any detections
      for (const detection of detections) {
        if (detection) {
          alertsToInsert.push({
            user_id: entity.user_id,
            pin_id: entity.pin_id,
            alert_type: detection.alertType,
            severity: detection.severity,
            title: detection.title,
            description: detection.description,
            metric_name: detection.metricName,
            previous_value: detection.previousValue,
            current_value: detection.currentValue,
            change_percent: detection.changePercent,
            dedup_key: generateDedupKey(
              entity.user_id,
              entity.entity_type,
              entity.entity_id,
              detection.alertType
            ),
          });
        }
      }

      // Update baseline state for this entity (once per unique entity)
      if (!processedEntities.has(stateKey)) {
        processedEntities.add(stateKey);
        statesToUpdate.push({
          entity_type: entity.entity_type,
          entity_id: entity.entity_id,
          ccu_7d_avg: entity.ccu_7d_avg ?? entity.ccu_current,
          ccu_prev_value: entity.ccu_current,
          review_velocity_7d_avg: entity.review_velocity,
          positive_ratio_prev: entity.positive_ratio,
          total_reviews_prev: entity.total_reviews,
          trend_30d_direction_prev: entity.trend_30d_direction,
        });
      }
    }

    log.info('Detection complete', {
      entitiesProcessed,
      alertsToCreate: alertsToInsert.length,
      statesToUpdate: statesToUpdate.length,
    });

    // Batch insert alerts (with dedup via ON CONFLICT)
    if (alertsToInsert.length > 0) {
      const { error: insertError, count } = await db
        .from('user_alerts')
        .upsert(alertsToInsert, {
          onConflict: 'dedup_key',
          ignoreDuplicates: true,
          count: 'exact',
        });

      if (insertError) {
        log.error('Failed to insert alerts', { error: insertError.message });
      } else {
        alertsCreated = count ?? 0;
        log.info('Alerts inserted', { count: alertsCreated });
      }
    }

    // Batch upsert detection states
    if (statesToUpdate.length > 0) {
      const { error: stateError } = await db
        .from('alert_detection_state')
        .upsert(
          statesToUpdate.map((s) => ({
            ...s,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'entity_type,entity_id' }
        );

      if (stateError) {
        log.error('Failed to update detection states', { error: stateError.message });
      } else {
        statesUpdated = statesToUpdate.length;
        log.info('Detection states updated', { count: statesUpdated });
      }
    }

    // Update job status
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: entitiesProcessed,
          items_succeeded: alertsCreated,
          items_failed: 0,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('Alert detection completed', {
      entitiesProcessed,
      alertsCreated,
      statesUpdated,
      durationSeconds: duration,
    });
  } catch (error) {
    log.error('Alert detection failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
