import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "employee" | "warehouse";
  permissions: string[];
  isActive: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isEmployee: boolean;
  isWarehouse: boolean;
  can: (permission: string) => boolean;
  canViewFinancials: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "caprina_token";
const USER_KEY  = "caprina_user";

// كل كام ثانية نجيب بيانات اليوزر من السيرفر (60 ثانية)
const POLL_INTERVAL_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── جيب بيانات اليوزر الحالي من API ─────────────────────────────────────
  const fetchMe = useCallback(async (tkn: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      if (!res.ok) return null;
      return await res.json() as AuthUser;
    } catch {
      return null;
    }
  }, []);

  // ─── تحديث اليوزر يدوياً (بعد حفظ التعديلات) ─────────────────────────────
  const refreshUser = useCallback(async () => {
    const tkn = localStorage.getItem(TOKEN_KEY);
    if (!tkn) return;
    const updated = await fetchMe(tkn);
    if (updated) {
      // بس نحدث لو في فرق فعلي
      setUser(prev => {
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [fetchMe]);

  // ─── بدء الـ polling ──────────────────────────────────────────────────────
  const startPolling = useCallback((tkn: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const updated = await fetchMe(tkn);
      if (updated) {
        // بس نحدث لو في فرق فعلي — منع re-render زيادة
        setUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
          localStorage.setItem(USER_KEY, JSON.stringify(updated));
          return updated;
        });
      } else {
        logout();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchMe]);

  // ─── تحميل اليوزر من localStorage عند أول render ─────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser  = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(parsed);
        // جيب بيانات fresh من API مباشرة بدل localStorage القديمة
        fetchMe(savedToken).then(fresh => {
          if (fresh) {
            setUser(fresh);
            localStorage.setItem(USER_KEY, JSON.stringify(fresh));
          } else {
            // token منتهية
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
          }
          setLoading(false);
        });
        startPolling(savedToken);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    startPolling(newToken);
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // ─── can() — الـ permissions من DB هي المرجع الوحيد ──────────────────────
  const can = (permission: string): boolean => {
    if (!user) return false;
    const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes("*")) return true;
    return perms.includes(permission);
  };

  const canViewFinancials = can("view_financials");

  return (
    <AuthContext.Provider value={{
      user, token,
      login, logout, refreshUser,
      isAdmin:    user?.role === "admin",
      isEmployee: user?.role === "employee",
      isWarehouse:user?.role === "warehouse",
      can,
      canViewFinancials,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
