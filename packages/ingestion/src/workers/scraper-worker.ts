/**
 * Page Creation Scraper Worker
 *
 * Scrapes Steam Community pages to get the "Founded" date (page creation date).
 *
 * Run with: pnpm --filter @publisheriq/ingestion scrape-creation-dates
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import { scrapePageCreationDate } from '../scrapers/page-creation.js';

const log = logger.child({ worker: 'scraper-sync' });

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.SCRAPER_BATCH), 10);

  log.info('Starting Page Creation scraper', { githubRunId, batchSize });

  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'scraper',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  let processed = 0;
  let created = 0;  // First-time enrichment
  let updated = 0;  // Refresh of existing data
  let failed = 0;

  try {
    // Get apps that need page creation scraping
    const { data: appsToScrape } = await supabase.rpc('get_apps_for_sync', {
      p_source: 'scraper',
      p_limit: batchSize,
    });

    if (!appsToScrape || appsToScrape.length === 0) {
      log.info('No apps need page creation scraping');

      // Mark job as completed with 0 items
      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: 0,
            items_succeeded: 0,
            items_failed: 0,
            items_created: 0,
            items_updated: 0,
          })
          .eq('id', job.id);
      }
      return;
    }

    log.info('Found apps to scrape', { count: appsToScrape.length });

    // Fetch sync status to determine which are first-time vs refresh
    const appIds = appsToScrape.map((a: { appid: number }) => a.appid);
    const { data: syncStatuses } = await supabase
      .from('sync_status')
      .select('appid, last_page_creation_scrape')
      .in('appid', appIds);

    // Build set of apps that have never been scraped (first-time enrichment)
    const neverScrapedSet = new Set(
      (syncStatuses || [])
        .filter((s) => s.last_page_creation_scrape === null)
        .map((s) => s.appid)
    );

    log.info('First-time vs refresh breakdown', {
      firstTime: neverScrapedSet.size,
      refresh: appsToScrape.length - neverScrapedSet.size,
    });

    for (const { appid } of appsToScrape) {
      processed++;

      const result = await scrapePageCreationDate(appid);

      if (result.success && result.foundedDate) {
        // Update app with page creation date
        await supabase
          .from('apps')
          .update({
            page_creation_date: result.foundedDate.toISOString().split('T')[0],
            page_creation_date_raw: result.foundedDateRaw,
          })
          .eq('appid', appid);

        // Mark as scraped
        await supabase
          .from('sync_status')
          .update({
            last_page_creation_scrape: new Date().toISOString(),
            needs_page_creation_scrape: false,
          })
          .eq('appid', appid);

        // Track first-time vs refresh
        if (neverScrapedSet.has(appid)) {
          created++;
        } else {
          updated++;
        }
      } else if (result.success) {
        // No date found but no error - mark as scraped anyway
        await supabase
          .from('sync_status')
          .update({
            last_page_creation_scrape: new Date().toISOString(),
            needs_page_creation_scrape: false,
          })
          .eq('appid', appid);

        // Track first-time vs refresh
        if (neverScrapedSet.has(appid)) {
          created++;
        } else {
          updated++;
        }
      } else {
        // Error occurred
        await supabase
          .from('sync_status')
          .update({
            last_error_source: 'scraper',
            last_error_message: result.error,
            last_error_at: new Date().toISOString(),
          })
          .eq('appid', appid);

        failed++;
      }

      if (processed % 25 === 0) {
        log.info('Scrape progress', { processed, created, updated, failed });
      }
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: processed,
          items_succeeded: created + updated,
          items_failed: failed,
          items_created: created,
          items_updated: updated,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Page Creation scraper completed', { processed, created, updated, failed, durationMinutes: duration });
  } catch (error) {
    log.error('Page Creation scraper failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: processed,
          items_succeeded: created + updated,
          items_failed: failed,
          items_created: created,
          items_updated: updated,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
