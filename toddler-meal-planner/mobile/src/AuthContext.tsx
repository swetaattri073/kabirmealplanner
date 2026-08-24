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

  const applySession = useCallback(async (data: any) => {
    const list: Toddler[] = data.toddlers || [];
    const preferred = await getLastToddlerRef();
    const active = pickActive(list, preferred);
    setAuthenticated(!!data.authenticated || !!data.token || !!data.user);
    setUser(data.user || null);
    setToddlers(list);
    setActiveToddlerState(active);
    if (data.guest_id) {
      await setGuestId(data.guest_id);
      setGuestIdState(data.guest_id);
    } else if (!data.authenticated) {
      const g = await getGuestId();
      setGuestIdState(g);
    } else {
      setGuestIdState(null);
    }
    if (active) {
      await setLastToddlerRef(active.ref);
      await syncRemindersFromToddler(active.ref, active.name, (active as any).meal_schedule);
    }
  }, []);

  const refresh = useCallback(async () => {
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
      setAuthenticated(false);
      setUser(null);
    } finally {
      setReady(true);
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
