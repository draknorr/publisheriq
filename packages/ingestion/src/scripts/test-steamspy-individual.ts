/**
 * Quick test script to verify SteamSpy individual fetch works
 * Run with: pnpm --filter @publisheriq/ingestion test-steamspy-individual
 */
import { getServiceClient } from '@publisheriq/database';
import { fetchSteamSpyAppDetails, parseOwnerEstimate } from '../apis/steamspy.js';

const TEST_APPIDS = [
  1808500, // Arc Raiders
  1030300, // Hollow Knight: Silksong
  3527290, // PEAK
];

async function main() {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  console.log('Testing SteamSpy individual fetch for:', TEST_APPIDS);

  for (const appid of TEST_APPIDS) {
    console.log(`\nFetching ${appid}...`);
    const details = await fetchSteamSpyAppDetails(appid);

    if (details?.name) {
      console.log(`Found: ${details.name}`);
      console.log(`  CCU: ${details.ccu}, Owners: ${details.owners}`);
      console.log(`  Reviews: +${details.positive} / -${details.negative}`);

      const owners = parseOwnerEstimate(details.owners);

      // Upsert to daily_metrics
      const { error: metricsError } = await supabase.from('daily_metrics').upsert(
        {
          appid,
          metric_date: today,
          owners_min: owners.min,
          owners_max: owners.max,
          ccu_peak: details.ccu,
          average_playtime_forever: details.average_forever,
          average_playtime_2weeks: details.average_2weeks,
          positive_reviews: details.positive,
          negative_reviews: details.negative,
          total_reviews: details.positive + details.negative,
          price_cents: parseInt(details.price, 10) || null,
          discount_percent: parseInt(details.discount, 10) || 0,
        },
        { onConflict: 'appid,metric_date' }
      );

      if (metricsError) {
        console.log(`  X Metrics upsert failed: ${metricsError.message}`);
      } else {
        console.log(`  OK Metrics upserted for ${today}`);
      }

      // Update sync_status
      const { error: syncError } = await supabase
        .from('sync_status')
        .update({
          steamspy_available: true,
          last_steamspy_sync: now,
        })
        .eq('appid', appid);

      if (syncError) {
        console.log(`  X Sync status update failed: ${syncError.message}`);
      } else {
        console.log(`  OK Marked steamspy_available = true`);
      }
    } else {
      console.log(`X No data found for ${appid}`);
    }
  }

  // Verify results
  console.log('\n--- Verification ---');
  const { data } = await supabase
    .from('sync_status')
    .select('appid, steamspy_available, last_steamspy_sync')
    .in('appid', TEST_APPIDS);

  console.log('sync_status:', data);

  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('appid, ccu_peak, owners_max, total_reviews')
    .in('appid', TEST_APPIDS)
    .eq('metric_date', today);

  console.log('daily_metrics:', metrics);
}

main().catch(console.error);
