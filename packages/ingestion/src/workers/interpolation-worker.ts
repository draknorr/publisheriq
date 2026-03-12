/**
 * Interpolation Worker
 *
 * Fills gaps in review_deltas with interpolated values for trend visualization.
 * Runs daily to ensure continuous time-series data.
 *
 * Run with: pnpm --filter @publisheriq/ingestion interpolate-reviews
 */

import { getServiceClient } from "@publisheriq/database";
import { logger } from "@publisheriq/shared";

const log = logger.child({ worker: "interpolation" });
const DEFAULT_INTERPOLATION_DAYS = 30;
const DEFAULT_APP_BATCH_SIZE = 2000;

type InterpolationBatchResult = {
  apps_processed: number;
  has_more: boolean;
  last_appid: number | null;
  total_interpolated: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer but received "${value}"`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  // Get date range from env or default to last 30 days
  const daysBack = parsePositiveInt(
    process.env.INTERPOLATION_DAYS,
    DEFAULT_INTERPOLATION_DAYS,
  );
  const appBatchSize = parsePositiveInt(
    process.env.INTERPOLATION_APP_BATCH_SIZE,
    DEFAULT_APP_BATCH_SIZE,
  );
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const endDate = new Date().toISOString().split("T")[0];

  log.info("Starting review interpolation", {
    githubRunId,
    startDate,
    endDate,
    daysBack,
    appBatchSize,
  });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job } = await supabase
    .from("sync_jobs")
    .insert({
      job_type: "interpolation",
      github_run_id: githubRunId,
      status: "running",
      batch_size: daysBack,
    })
    .select()
    .single();

  try {
    let totalInterpolated = 0;
    let appsProcessed = 0;
    let batchCount = 0;
    let lastAppId = 0;
    let hasMore = true;

    while (hasMore) {
      batchCount += 1;

      log.info("Running interpolation batch", {
        batchCount,
        appBatchSize,
        startDate,
        endDate,
        afterAppId: lastAppId,
      });

      const { data, error: interpolateError } = await supabase.rpc(
        "interpolate_review_deltas_batch",
        {
          p_start_date: startDate,
          p_end_date: endDate,
          p_after_appid: lastAppId,
          p_app_limit: appBatchSize,
        },
      );

      if (interpolateError) {
        throw new Error(
          `Failed to interpolate batch ${batchCount}: ${interpolateError.message}`,
        );
      }

      const batchResult = data?.[0] as InterpolationBatchResult | undefined;
      if (!batchResult) {
        break;
      }

      totalInterpolated += batchResult.total_interpolated ?? 0;
      appsProcessed += batchResult.apps_processed ?? 0;

      log.info("Interpolation batch completed", {
        batchCount,
        appsProcessed: batchResult.apps_processed ?? 0,
        batchInterpolated: batchResult.total_interpolated ?? 0,
        totalInterpolated,
        cumulativeAppsProcessed: appsProcessed,
        lastAppId: batchResult.last_appid,
        hasMore: batchResult.has_more,
      });

      if (
        (batchResult.apps_processed ?? 0) === 0 ||
        batchResult.last_appid === null
      ) {
        hasMore = false;
        break;
      }

      if (batchResult.last_appid <= lastAppId) {
        throw new Error(
          `Interpolation batch cursor stalled at appid ${batchResult.last_appid}`,
        );
      }

      lastAppId = batchResult.last_appid;
      hasMore = batchResult.has_more ?? false;
    }

    log.info("Interpolation completed", {
      totalInterpolated,
      appsProcessed,
      batchCount,
    });

    // Get stats on interpolated vs actual data
    const { count: interpolatedCount, error: interpolatedCountError } =
      await supabase
        .from("review_deltas")
        .select("*", { count: "exact", head: true })
        .gte("delta_date", startDate)
        .eq("is_interpolated", true);
    const { count: actualCount, error: actualCountError } = await supabase
      .from("review_deltas")
      .select("*", { count: "exact", head: true })
      .gte("delta_date", startDate)
      .eq("is_interpolated", false);

    if (interpolatedCountError || actualCountError) {
      log.warn("Failed to fetch interpolation delta stats", {
        interpolatedCountError: interpolatedCountError?.message,
        actualCountError: actualCountError?.message,
      });
    }

    log.info("Delta stats", {
      totalRecords: (interpolatedCount ?? 0) + (actualCount ?? 0),
      actualSyncs: actualCount,
      interpolatedRecords: interpolatedCount,
      interpolationRatio:
        typeof actualCount === "number" &&
        actualCount > 0 &&
        typeof interpolatedCount === "number"
          ? (interpolatedCount / actualCount).toFixed(2)
          : "N/A",
    });

    // Update job as completed
    if (job) {
      await supabase
        .from("sync_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          items_processed: appsProcessed,
          items_succeeded: totalInterpolated,
          items_failed: 0,
          items_created: totalInterpolated,
        })
        .eq("id", job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info("Interpolation worker completed", {
      durationSeconds: duration,
      appsProcessed,
      totalInterpolated,
      batchCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    log.error("Interpolation failed", {
      error: errorMessage,
      stack: errorStack,
      durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    });

    if (job) {
      await supabase
        .from("sync_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq("id", job.id);
    }

    process.exit(1);
  }
}

main();
