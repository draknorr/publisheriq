import * as cheerio from 'cheerio';
import { API_URLS, logger, ScrapeError } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';
import { rateLimiters } from '../utils/rate-limiter.js';

const log = logger.child({ component: 'PageCreationScraper' });

/**
 * Result of scraping page creation date
 */
export interface PageCreationResult {
  appid: number;
  foundedDate: Date | null;
  foundedDateRaw: string | null;
  success: boolean;
  error?: string;
}

/**
 * Parse date string from Steam Community page
 * Handles formats like "March 15, 2020", "15 March 2020", etc.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Clean up the string
  const cleaned = dateStr.trim();

  // Try direct Date parsing first
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common formats manually
  const patterns = [
    // "March 15, 2020"
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    // "15 March 2020"
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    // "2020-03-15"
    /(\d{4})-(\d{2})-(\d{2})/,
  ];

  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3,
    may: 4, june: 5, july: 6, august: 7,
    september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3,
    jun: 5, jul: 6, aug: 7, sep: 8,
    oct: 9, nov: 10, dec: 11,
  };

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let year: number, month: number, day: number;

      if (pattern === patterns[0]) {
        // "March 15, 2020"
        month = months[match[1].toLowerCase()] ?? 0;
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else if (pattern === patterns[1]) {
        // "15 March 2020"
        day = parseInt(match[1], 10);
        month = months[match[2].toLowerCase()] ?? 0;
        year = parseInt(match[3], 10);
      } else {
        // "2020-03-15"
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      }

      if (year && month !== undefined && day) {
        return new Date(year, month, day);
      }
    }
  }

  return null;
}

/**
 * Scrape the Steam Community page for an app to get the "Founded" date
 * This is when the Steam page was first created (different from release date)
 *
 * Rate limit: 1 request per 1.5 seconds (conservative)
 *
 * @param appid - Steam app ID
 * @returns Page creation result
 */
export async function scrapePageCreationDate(appid: number): Promise<PageCreationResult> {
  await rateLimiters.communityScrape.acquire();

  const url = `${API_URLS.STEAM_COMMUNITY}/app/${appid}`;

  try {
    const html = await withRetry(async () => {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        throw new ScrapeError(`Failed to fetch community page for ${appid}`, url, {
          status: res.status,
        });
      }

      return res.text();
    });

    const $ = cheerio.load(html);

    // Look for the "Founded" field in various locations
    let foundedDateRaw: string | null = null;

    // Method 1: Look for "Founded" in group info block
    $('.grouppage_header_info .data').each((_, elem) => {
      const text = $(elem).text();
      if (text.includes('Founded')) {
        // Extract the date after "Founded"
        const match = text.match(/Founded[:\s]+(.+)/i);
        if (match) {
          foundedDateRaw = match[1].trim();
        }
      }
    });

    // Method 2: Look for specific date element
    if (!foundedDateRaw) {
      const foundedElem = $('dt:contains("Founded")').next('dd');
      if (foundedElem.length) {
        foundedDateRaw = foundedElem.text().trim();
      }
    }

    // Method 3: Look in stats area
    if (!foundedDateRaw) {
      $('.communityHub_stats .stat').each((_, elem) => {
        const label = $(elem).find('.label').text().toLowerCase();
        if (label.includes('founded') || label.includes('created')) {
          foundedDateRaw = $(elem).find('.value').text().trim();
        }
      });
    }

    // Method 4: Search all text for "Founded" pattern
    if (!foundedDateRaw) {
      const bodyText = $('body').text();
      const foundedMatch = bodyText.match(/Founded[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      if (foundedMatch) {
        foundedDateRaw = foundedMatch[1].trim();
      }
    }

    if (!foundedDateRaw) {
      log.debug('No founded date found on page', { appid });
      return {
        appid,
        foundedDate: null,
        foundedDateRaw: null,
        success: true,
      };
    }

    const foundedDate = parseDateString(foundedDateRaw);

    log.debug('Scraped page creation date', { appid, foundedDateRaw, foundedDate });

    return {
      appid,
      foundedDate,
      foundedDateRaw,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to scrape page creation date', { appid, error: errorMessage });

    return {
      appid,
      foundedDate: null,
      foundedDateRaw: null,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch scrape page creation dates for multiple apps
 *
 * @param appids - Array of Steam app IDs
 * @param onResult - Callback for each result
 * @returns Array of results
 */
export async function scrapePageCreationDates(
  appids: number[],
  onResult?: (result: PageCreationResult) => Promise<void>
): Promise<PageCreationResult[]> {
  const results: PageCreationResult[] = [];

  for (const appid of appids) {
    const result = await scrapePageCreationDate(appid);
    results.push(result);

    if (onResult) {
      await onResult(result);
    }
  }

  return results;
}
