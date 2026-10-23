import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import {
  getGuestId,
  getLastToddlerRef,
  getToken,
  getCachedSession,
  setCachedSession,
  clearCachedSession,
  setGuestId,
  setLastToddlerRef,
  setToken,
} from './storage';
import { syncRemindersFromToddler } from './notifications';
import type { Toddler, User } from './types';

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  toddlers: Toddler[];
  activeToddler: Toddler | null;
  guestId: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveToddler: (t: Toddler | null) => Promise<void>;
  addToddlerLocal: (t: Toddler) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function pickActive(list: Toddler[], preferred: string | null): Toddler | null {
  if (!list.length) return null;
  if (preferred) {
    const hit = list.find((t) => t.ref === preferred || String(t.id) === preferred);
    if (hit) return hit;
  }
  return list[0];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [toddlers, setToddlers] = useState<Toddler[]>([]);
  const [activeToddler, setActiveToddlerState] = useState<Toddler | null>(null);
  const [guestId, setGuestIdState] = useState<string | null>(null);

  const applySession = useCallback(async (data: any, persist = true) => {
    const list: Toddler[] = data.toddlers || [];
    const preferred = await getLastToddlerRef();
    const active = pickActive(list, preferred);
    const isAuth = !!data.authenticated || !!data.token || !!data.user;
    setAuthenticated(isAuth);
    setUser(data.user || null);
    setToddlers(list);
    setActiveToddlerState(active);
    if (data.guest_id) {
      await setGuestId(data.guest_id);
      setGuestIdState(data.guest_id);
    } else if (!isAuth) {
      const g = await getGuestId();
      setGuestIdState(g);
    } else {
      setGuestIdState(null);
    }
    if (active) {
      await setLastToddlerRef(active.ref);
      // Defer reminder sync so cold start is not blocked on notification APIs.
      setTimeout(() => {
        syncRemindersFromToddler(active.ref, active.name, (active as any).meal_schedule).catch(
          () => undefined,
        );
      }, 0);
    }
    if (persist) {
      await setCachedSession({
        authenticated: isAuth,
        user: data.user || null,
        toddlers: list,
        guest_id: data.guest_id || null,
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    let hydrated = false;
    const cached = await getCachedSession();
    if (cached) {
      const preferred = await getLastToddlerRef();
      const active = pickActive(cached.toddlers, preferred);
      setAuthenticated(cached.authenticated);
      setUser(cached.user);
      setToddlers(cached.toddlers);
      setActiveToddlerState(active);
      if (cached.guest_id) setGuestIdState(cached.guest_id);
      else if (!cached.authenticated) {
        const g = await getGuestId();
        setGuestIdState(g);
      }
      setReady(true);
      hydrated = true;
    }

    try {
      const token = await getToken();
      const guest = await getGuestId();
      if (!token && guest) {
        try {
          await api.restore(guest);
        } catch {
          /* continue to status */
        }
      }
      const status = await api.status();
      await applySession(status);
    } catch (err) {
      console.warn('auth refresh failed', err);
      if (!hydrated) {
        setAuthenticated(false);
        setUser(null);
        await clearCachedSession();
      }
    } finally {
      if (!hydrated) setReady(true);
    }
  }, [applySession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const guest = await getGuestId();
      const data = await api.login(email, password, guest);
      if (data.token) await setToken(data.token);
      await applySession({ ...data, authenticated: true });
    },
    [applySession],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      const guest = await getGuestId();
      const data = await api.signup({
        email,
        password,
        confirm_password: password,
        name,
        guest_id: guest,
      });
      if (data.token) await setToken(data.token);
      await applySession({ ...data, authenticated: true });
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    await setToken(null);
    setAuthenticated(false);
    setUser(null);
    // Keep guest toddlers if any; refresh status
    await refresh();
  }, [refresh]);

  const setActiveToddler = useCallback(async (t: Toddler | null) => {
    setActiveToddlerState(t);
    if (t) {
      await setLastToddlerRef(t.ref);
      await syncRemindersFromToddler(t.ref, t.name, (t as any).meal_schedule).catch(
        () => undefined,
      );
    }
  }, []);

  const addToddlerLocal = useCallback(async (t: Toddler) => {
    setToddlers((prev) => {
      const next = [...prev.filter((x) => x.id !== t.id), t];
      return next;
    });
    await setActiveToddler(t);
    if (t && (t as any).guest_id) {
      await setGuestId((t as any).guest_id);
      setGuestIdState((t as any).guest_id);
    }
    const cached = await getCachedSession();
    if (cached) {
      const list = [...cached.toddlers.filter((x) => x.id !== t.id), t];
      await setCachedSession({
        authenticated: cached.authenticated,
        user: cached.user,
        toddlers: list,
        guest_id: cached.guest_id,
      });
    }
  }, [setActiveToddler]);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      user,
      toddlers,
      activeToddler,
      guestId,
      refresh,
      login,
      signup,
      logout,
      setActiveToddler,
      addToddlerLocal,
    }),
    [
      ready,
      authenticated,
      user,
      toddlers,
      activeToddler,
      guestId,
      refresh,
      login,
      signup,
      logout,
      setActiveToddler,
      addToddlerLocal,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
