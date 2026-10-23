import AsyncStorage from '@react-native-async-storage/async-storage';

type Entry = { data: unknown; at: number };

const memory = new Map<string, Entry>();

const DISK_DASHBOARD_PREFIX = 'littlebowl_dash_v1:';

/** TTLs in milliseconds */
export const CACHE_TTL = {
  dashboard: 60_000,
  home: 60_000,
  nutrition: 60_000,
  plan: 60_000,
  recipes: 120_000,
  preferences: 120_000,
  cookbook: 120_000,
  growth: 120_000,
  recipeDetail: 600_000,
  weaning: 120_000,
} as const;

export function recipeDetailKey(slug: string): string {
  return `recipe:${slug}`;
}

export function screenCacheKey(screen: string, toddlerRef: string, extra?: string): string {
  return extra ? `${screen}:${toddlerRef}:${extra}` : `${screen}:${toddlerRef}`;
}

export function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) return null;
  return entry.data as T;
}

/** Returns cached data even if TTL expired (for stale-while-revalidate). */
export function getStale<T>(key: string): T | null {
  const entry = memory.get(key);
  return entry ? (entry.data as T) : null;
}

export function setCached<T>(key: string, data: T): void {
  memory.set(key, { data, at: Date.now() });
}

export function invalidateCacheKey(key: string): void {
  memory.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** Drop dashboard, home, and nutrition caches after a meal is logged or deleted. */
export function invalidateToddlerMealData(toddlerRef: string): void {
  invalidateCachePrefix(`dashboard:${toddlerRef}`);
  invalidateCachePrefix(`home:${toddlerRef}`);
  invalidateCachePrefix(`nutrition:${toddlerRef}`);
  AsyncStorage.removeItem(`${DISK_DASHBOARD_PREFIX}${toddlerRef}`).catch(() => undefined);
}

export async function getPersistedDashboard<T>(toddlerRef: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DISK_DASHBOARD_PREFIX}${toddlerRef}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function persistDashboard<T>(toddlerRef: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DISK_DASHBOARD_PREFIX}${toddlerRef}`, JSON.stringify(data));
  } catch {
    /* disk full */
  }
}
