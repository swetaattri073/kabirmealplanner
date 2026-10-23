import Constants from 'expo-constants';
import { getDeviceId } from './device';
import { getGuestId, getToken, setGuestId, setToken } from './storage';

const DEFAULT_BASE = 'https://littlebowl.in';

export function apiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  return (fromEnv || extra?.apiBaseUrl || DEFAULT_BASE).replace(/\/$/, '');
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const REQUEST_TIMEOUT_MS = 25_000;

/** Turn fetch / Android network failures into a short, actionable message. */
export function formatNetworkError(err: unknown, baseUrl = apiBaseUrl()): string {
  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return baseUrl;
    }
  })();
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    err instanceof TypeError ||
    lower.includes('network request failed') ||
    lower.includes('connectexception') ||
    lower.includes('failed to connect') ||
    lower.includes('econnrefused') ||
    lower.includes('enetunreach') ||
    lower.includes('timeout') ||
    lower.includes('aborted')
  ) {
    return `Cannot reach ${host}. The server may be offline or your phone has no internet. Try again on Wi‑Fi or mobile data, or check that ${host} is running.`;
  }
  return msg || 'Something went wrong. Please try again.';
}

type RequestOpts = {
  method?: string;
  body?: any;
  formData?: FormData;
  auth?: boolean;
  guest?: boolean;
};

export async function apiRequest<T = any>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (!opts.formData) headers['Content-Type'] = 'application/json';

  if (opts.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (opts.guest !== false) {
    const guest = await getGuestId();
    if (guest) headers['X-Guest-Id'] = guest;
  }
  const deviceId = await getDeviceId();
  if (deviceId) headers['X-Device-Id'] = deviceId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method: opts.method || (opts.body || opts.formData ? 'POST' : 'GET'),
      headers,
      body: opts.formData
        ? opts.formData
        : opts.body != null
          ? JSON.stringify(opts.body)
          : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(formatNetworkError(err), 0);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || (Array.isArray(data.errors) && data.errors.join(' ')))) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), res.status, data);
  }

  if (data && typeof data === 'object') {
    if (data.token) await setToken(data.token);
    if (data.guest_id) await setGuestId(data.guest_id);
  }
  return data as T;
}

export const api = {
  status: () => apiRequest('/api/auth/status'),
  login: (email: string, password: string, guest_id?: string | null) =>
    apiRequest('/api/auth/login', { method: 'POST', body: { email, password, guest_id } }),
  signup: (payload: {
    email: string;
    password: string;
    confirm_password?: string;
    name?: string;
    guest_id?: string | null;
  }) => apiRequest('/api/auth/signup', { method: 'POST', body: payload }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  restore: (guest_id: string) =>
    apiRequest('/api/auth/restore', { method: 'POST', body: { guest_id } }),

  toddlers: () => apiRequest('/api/toddlers'),
  createToddler: (body: Record<string, unknown>) =>
    apiRequest('/api/toddlers', { method: 'POST', body }),
  updateToddler: (ref: string, body: Record<string, unknown>) =>
    apiRequest(`/api/toddlers/${encodeURIComponent(ref)}`, { method: 'PUT', body }),

  dashboard: (ref: string) => apiRequest(`/api/dashboard/${encodeURIComponent(ref)}`),
  nutritionDaily: (ref: string, date?: string) =>
    apiRequest(
      `/api/nutrition/daily/${encodeURIComponent(ref)}${date ? `?date=${date}` : ''}`,
    ),
  nutritionWeekly: (ref: string) =>
    apiRequest(`/api/nutrition/weekly/${encodeURIComponent(ref)}`),
  nutritionAlerts: (ref: string) =>
    apiRequest(`/api/nutrition/alerts/${encodeURIComponent(ref)}`),
  nutritionBreakdown: (ref: string) =>
    apiRequest(`/api/nutrition/breakdown/${encodeURIComponent(ref)}`),

  weeklyPlan: (ref: string, weekStart?: string, regenerate?: boolean) => {
    const q = new URLSearchParams();
    if (weekStart) q.set('week_start', weekStart);
    if (regenerate) q.set('regenerate', 'true');
    const qs = q.toString();
    return apiRequest(
      `/api/meal-plan/weekly/${encodeURIComponent(ref)}${qs ? `?${qs}` : ''}`,
    );
  },
  updatePlanItem: (planId: number, body: Record<string, unknown>) =>
    apiRequest(`/api/meal-plan/item/${planId}`, { method: 'PUT', body }),

  foods: (q?: string) =>
    apiRequest(`/api/foods${q ? `?search=${encodeURIComponent(q)}` : ''}`),
  mealLogs: (params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/api/meal-logs?${q}`);
  },
  createMealLog: (body: Record<string, unknown>) =>
    apiRequest('/api/meal-logs', { method: 'POST', body }),
  updateMealLog: (id: number, body: Record<string, unknown>) =>
    apiRequest(`/api/meal-logs/${id}`, { method: 'PUT', body }),
  deleteMealLog: (id: number) =>
    apiRequest(`/api/meal-logs/${id}`, { method: 'DELETE' }),
  parseMeal: (text: string) =>
    apiRequest('/api/parse-meal', { method: 'POST', body: { text } }),
  smartLog: (body: Record<string, unknown>) =>
    apiRequest('/api/smart-log', { method: 'POST', body }),
  recognizeFood: (formData: FormData) =>
    apiRequest('/api/recognize-food', { method: 'POST', formData }),

  preferences: (ref: string) =>
    apiRequest(`/api/preferences/${encodeURIComponent(ref)}`),
  setPreference: (ref: string, foodId: number, body: Record<string, unknown>) =>
    apiRequest(`/api/preferences/${encodeURIComponent(ref)}/${foodId}`, {
      method: 'PUT',
      body,
    }),

  recipes: (opts?: { q?: string; category?: string; age_months?: number }) => {
    const p = new URLSearchParams();
    if (opts?.q) p.set('q', opts.q);
    if (opts?.category) p.set('category', opts.category);
    if (opts?.age_months != null) p.set('age_months', String(opts.age_months));
    const qs = p.toString();
    return apiRequest(`/api/recipes${qs ? `?${qs}` : ''}`);
  },
  recipe: (slug: string) => apiRequest(`/api/recipes/${encodeURIComponent(slug)}`),

  weaning: (ref: string) => apiRequest(`/api/weaning/${encodeURIComponent(ref)}`),
  tryWeaningFood: (ref: string, body: Record<string, unknown>) =>
    apiRequest(`/api/weaning/${encodeURIComponent(ref)}/try-food`, { method: 'POST', body }),

  miniPlans: (ageMonths?: number) => {
    const q = ageMonths != null ? `?age_months=${ageMonths}` : '';
    return apiRequest(`/api/meal-plan/mini${q}`);
  },
  applyMiniPlan: (templateKey: string, ref: string) =>
    apiRequest(
      `/api/meal-plan/mini/${encodeURIComponent(templateKey)}/${encodeURIComponent(ref)}`,
      { method: 'POST' },
    ),

  growth: (ref: string) => apiRequest(`/api/growth/${encodeURIComponent(ref)}`),
  addGrowthRecord: (ref: string, body: Record<string, unknown>) =>
    apiRequest(`/api/growth/${encodeURIComponent(ref)}`, { method: 'POST', body }),

  savedRecipes: () => apiRequest('/api/recipes/saved'),
  saveRecipe: (slug: string) =>
    apiRequest(`/api/recipes/${encodeURIComponent(slug)}/save`, { method: 'POST' }),
  unsaveRecipe: (slug: string) =>
    apiRequest(`/api/recipes/${encodeURIComponent(slug)}/save`, { method: 'DELETE' }),

  chat: (body: Record<string, unknown>) =>
    apiRequest('/api/chat', { method: 'POST', body }),
  chatHealth: () => apiRequest('/api/chat/health'),
  chatSummarize: (body: Record<string, unknown>) =>
    apiRequest('/api/chat/summarize', { method: 'POST', body }),
  dailyTip: (ref: string) => apiRequest(`/api/daily-tip/${encodeURIComponent(ref)}`),
  flavorExplore: (ref: string) =>
    apiRequest(`/api/explore-flavors/${encodeURIComponent(ref)}`),
  nutritionBoosters: () => apiRequest('/api/nutrition-boosters'),
};
