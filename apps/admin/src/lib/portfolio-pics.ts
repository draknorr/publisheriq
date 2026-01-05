import { getSupabase, isSupabaseConfigured } from './supabase';

// Types
export type EntityType = 'developer' | 'publisher';

export interface PortfolioGenre {
  genre_id: number;
  name: string;
  game_count: number | null;
  is_primary_count: number;
}

export interface PortfolioCategory {
  category_id: number;
  name: string;
  game_count: number | null;
}

export interface PortfolioPlatformStats {
  platforms: {
    windows: number;
    macos: number;
    linux: number;
  };
  controllerSupport: {
    full: number;
    partial: number;
    none: number;
  };
  steamDeck: {
    verified: number;
    playable: number;
    unsupported: number;
    unknown: number;
  };
  totalGames: number;
}

export interface PortfolioFranchise {
  id: number;
  name: string;
  game_count: number | null;
}

export interface PortfolioLanguage {
  language: string;
  game_count: number | null;
}

export interface PortfolioContentDescriptor {
  descriptor_id: string;
  label: string;
  severity: 'high' | 'medium';
  game_count: number | null;
}

export interface PortfolioPICSData {
  genres: PortfolioGenre[];
  categories: PortfolioCategory[];
  platformStats: PortfolioPlatformStats;
  franchises: PortfolioFranchise[];
  languages: PortfolioLanguage[];
  contentDescriptors: PortfolioContentDescriptor[];
}

// Content descriptor mapping
const CONTENT_DESCRIPTOR_MAP: Record<string, { label: string; severity: 'high' | 'medium' }> = {
  '1': { label: 'Some Nudity or Sexual Content', severity: 'medium' },
  '2': { label: 'Frequent Violence or Gore', severity: 'medium' },
  '3': { label: 'Adult Only Sexual Content', severity: 'high' },
  '4': { label: 'Frequent Nudity or Sexual Content', severity: 'high' },
  '5': { label: 'General Mature Content', severity: 'medium' },
};

// Helper: Get all appids for an entity
async function getEntityAppIds(entityType: EntityType, entityId: number): Promise<number[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const junctionTable = entityType === 'developer' ? 'app_developers' : 'app_publishers';
  const idColumn = entityType === 'developer' ? 'developer_id' : 'publisher_id';

  const { data } = await supabase
    .from(junctionTable)
    .select('appid')
    .eq(idColumn, entityId);

  return data?.map(a => a.appid) ?? [];
}

// Get genre distribution
async function getPortfolioGenres(appIds: number[]): Promise<PortfolioGenre[]> {
  if (appIds.length === 0) return [];
  const supabase = getSupabase();

  // Query genres - note: is_primary exists in DB but may not be in generated types yet
  const { data: genres } = await supabase
    .from('app_genres')
    .select('genre_id, steam_genres(name)')
    .in('appid', appIds);

  if (!genres) return [];

  // Aggregate by genre
  const genreMap = new Map<number, { name: string; count: number; primaryCount: number }>();
  for (const g of genres) {
    const genreData = g.steam_genres as { name: string } | null;
    const name = genreData?.name ?? 'Unknown';
    const existing = genreMap.get(g.genre_id) ?? { name, count: 0, primaryCount: 0 };
    existing.count++;
    // Note: is_primary tracking would need type regeneration, skipping for now
    genreMap.set(g.genre_id, existing);
  }

  return [...genreMap.entries()]
    .map(([genre_id, data]) => ({
      genre_id,
      name: data.name,
      game_count: data.count,
      is_primary_count: data.primaryCount,
    }))
    .sort((a, b) => b.game_count - a.game_count);
}

// Get category/feature distribution
async function getPortfolioCategories(appIds: number[]): Promise<PortfolioCategory[]> {
  if (appIds.length === 0) return [];
  const supabase = getSupabase();

  const { data: categories } = await supabase
    .from('app_categories')
    .select('category_id, steam_categories(name)')
    .in('appid', appIds);

  if (!categories) return [];

  // Aggregate by category
  const categoryMap = new Map<number, { name: string; count: number }>();
  for (const c of categories) {
    const catData = c.steam_categories as { name: string } | null;
    const name = catData?.name ?? 'Unknown';
    const existing = categoryMap.get(c.category_id) ?? { name, count: 0 };
    existing.count++;
    categoryMap.set(c.category_id, existing);
  }

  return [...categoryMap.entries()]
    .map(([category_id, data]) => ({
      category_id,
      name: data.name,
      game_count: data.count,
    }))
    .sort((a, b) => b.game_count - a.game_count);
}

// Get platform, controller support, and Steam Deck stats
async function getPortfolioPlatformStats(appIds: number[]): Promise<PortfolioPlatformStats> {
  const emptyStats: PortfolioPlatformStats = {
    platforms: { windows: 0, macos: 0, linux: 0 },
    controllerSupport: { full: 0, partial: 0, none: 0 },
    steamDeck: { verified: 0, playable: 0, unsupported: 0, unknown: 0 },
    totalGames: 0,
  };

  if (appIds.length === 0) return emptyStats;
  const supabase = getSupabase();

  // Get platform and controller data from apps table
  const { data: apps } = await supabase
    .from('apps')
    .select('appid, platforms, controller_support')
    .in('appid', appIds);

  // Get Steam Deck data
  const { data: steamDeckData } = await supabase
    .from('app_steam_deck')
    .select('appid, category')
    .in('appid', appIds);

  const platforms = { windows: 0, macos: 0, linux: 0 };
  const controllerSupport = { full: 0, partial: 0, none: 0 };
  const steamDeck = { verified: 0, playable: 0, unsupported: 0, unknown: 0 };

  if (apps) {
    for (const app of apps) {
      const platformStr = (app.platforms ?? '').toLowerCase();
      if (platformStr.includes('windows')) platforms.windows++;
      if (platformStr.includes('macos') || platformStr.includes('mac')) platforms.macos++;
      if (platformStr.includes('linux')) platforms.linux++;

      const controller = (app.controller_support ?? '').toLowerCase();
      if (controller === 'full') controllerSupport.full++;
      else if (controller === 'partial') controllerSupport.partial++;
      else controllerSupport.none++;
    }
  }

  if (steamDeckData) {
    for (const sd of steamDeckData) {
      const category = (sd.category ?? '').toLowerCase();
      if (category === 'verified') steamDeck.verified++;
      else if (category === 'playable') steamDeck.playable++;
      else if (category === 'unsupported') steamDeck.unsupported++;
      else steamDeck.unknown++;
    }
  }

  // Games without Steam Deck data count as unknown
  const gamesWithDeckData = steamDeckData?.length ?? 0;
  steamDeck.unknown += appIds.length - gamesWithDeckData;

  return {
    platforms,
    controllerSupport,
    steamDeck,
    totalGames: appIds.length,
  };
}

// Get franchises
async function getPortfolioFranchises(appIds: number[]): Promise<PortfolioFranchise[]> {
  if (appIds.length === 0) return [];
  const supabase = getSupabase();

  const { data: franchiseLinks } = await supabase
    .from('app_franchises')
    .select('franchise_id, franchises(id, name)')
    .in('appid', appIds);

  if (!franchiseLinks) return [];

  // Aggregate by franchise
  const franchiseMap = new Map<number, { name: string; count: number }>();
  for (const f of franchiseLinks) {
    const franchiseData = f.franchises as { id: number; name: string } | null;
    if (!franchiseData) continue;
    const existing = franchiseMap.get(franchiseData.id) ?? { name: franchiseData.name, count: 0 };
    existing.count++;
    franchiseMap.set(franchiseData.id, existing);
  }

  return [...franchiseMap.entries()]
    .map(([id, data]) => ({
      id,
      name: data.name,
      game_count: data.count,
    }))
    .sort((a, b) => b.game_count - a.game_count);
}

// Get language support
async function getPortfolioLanguages(appIds: number[]): Promise<PortfolioLanguage[]> {
  if (appIds.length === 0) return [];
  const supabase = getSupabase();

  const { data: apps } = await supabase
    .from('apps')
    .select('languages')
    .in('appid', appIds)
    .not('languages', 'is', null);

  if (!apps) return [];

  // Aggregate languages
  const languageMap = new Map<string, number>();
  for (const app of apps) {
    const languages = app.languages as Record<string, unknown> | null;
    if (!languages) continue;
    for (const lang of Object.keys(languages)) {
      languageMap.set(lang, (languageMap.get(lang) ?? 0) + 1);
    }
  }

  return [...languageMap.entries()]
    .map(([language, game_count]) => ({ language, game_count }))
    .sort((a, b) => b.game_count - a.game_count);
}

// Get content descriptors
async function getPortfolioContentDescriptors(appIds: number[]): Promise<PortfolioContentDescriptor[]> {
  if (appIds.length === 0) return [];
  const supabase = getSupabase();

  const { data: apps } = await supabase
    .from('apps')
    .select('content_descriptors')
    .in('appid', appIds)
    .not('content_descriptors', 'is', null);

  if (!apps) return [];

  // Aggregate content descriptors
  const descriptorMap = new Map<string, number>();
  for (const app of apps) {
    const descriptors = app.content_descriptors as unknown[] | null;
    if (!descriptors || !Array.isArray(descriptors)) continue;
    for (const d of descriptors) {
      const id = String(d);
      descriptorMap.set(id, (descriptorMap.get(id) ?? 0) + 1);
    }
  }

  return [...descriptorMap.entries()]
    .map(([descriptor_id, game_count]) => {
      const info = CONTENT_DESCRIPTOR_MAP[descriptor_id];
      return info
        ? { descriptor_id, label: info.label, severity: info.severity, game_count }
        : null;
    })
    .filter((d): d is PortfolioContentDescriptor => d !== null)
    .sort((a, b) => b.game_count - a.game_count);
}

// Main function to get all portfolio PICS data
export async function getPortfolioPICSData(
  entityType: EntityType,
  entityId: number
): Promise<PortfolioPICSData | null> {
  if (!isSupabaseConfigured()) return null;

  // Get all appids for this entity
  const appIds = await getEntityAppIds(entityType, entityId);
  if (appIds.length === 0) return null;

  // Run all PICS queries in parallel
  const [genres, categories, platformStats, franchises, languages, contentDescriptors] = await Promise.all([
    getPortfolioGenres(appIds),
    getPortfolioCategories(appIds),
    getPortfolioPlatformStats(appIds),
    getPortfolioFranchises(appIds),
    getPortfolioLanguages(appIds),
    getPortfolioContentDescriptors(appIds),
  ]);

  return {
    genres,
    categories,
    platformStats,
    franchises,
    languages,
    contentDescriptors,
  };
}
