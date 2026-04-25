import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";

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
  sessionId: number | null;
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
const USER_KEY = "caprina_user";
const EDIT_BRAND_KEY = "edit_brand";

// polling كل 3 ثوان عشان تغييرات الصلاحيات تنعكس بسرعة
const POLL_INTERVAL_MS = 3_000;

// الصلاحيات الافتراضية لكل دور — تُستخدم فقط لو permissions فاضية تماماً
// (للمستخدمين القدامى اللي اتعملوا قبل نظام الصلاحيات)
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "dashboard", "orders", "inventory", "movements", "shipping", "invoices",
    "import", "analytics", "users", "audit", "whatsapp",
    "view_financials", "edit_inventory", "edit_delete_inventory",
    "view_product_performance", "add_team_member", "edit_brand",
    "section_dashboard", "section_product_performance", "section_team_performance",
    "section_team_management", "section_smart_analytics", "section_ads_analytics",
    "section_orders", "section_new_order", "section_archive", "section_shipping_followup",
    "section_whatsapp", "section_inventory", "section_warehouses", "section_movements",
    "section_shipping", "section_invoices", "section_import", "section_export_data",
    "section_users", "section_sessions_report", "section_audit",
  ],
  employee: [
    "dashboard", "orders",
    "section_dashboard", "section_orders", "section_new_order",
    "section_archive", "section_shipping_followup",
  ],
  warehouse: [
    "dashboard", "inventory", "movements",
    "edit_inventory", "edit_delete_inventory",
    "section_dashboard", "section_inventory", "section_warehouses", "section_movements",
  ],
};

// مقارنة الـ permissions بغض النظر عن الترتيب
function permissionsChanged(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  const setA = new Set(a);
  return b.some((p) => !setA.has(p));
}

function flattenPermissions(raw: any): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { return []; }
      if (!Array.isArray(raw)) return [];
    } else return [];
  }
  const flat: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") flat.push(item);
    else if (Array.isArray(item)) {
      for (const sub of item) { if (typeof sub === "string") flat.push(sub); }
    }
  }
  return [...new Set(flat)];
}

function normalizeUser(u: AuthUser): AuthUser {
  return {
    ...u,
    permissions: flattenPermissions(u.permissions).sort(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recordLogin = useCallback(
    async (tkn: string): Promise<number | null> => {
      try {
        const res = await fetch("/api/sessions/login", {
          method: "POST",
          headers: { Authorization: `Bearer ${tkn}`, "Content-Type": "application/json" },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.sessionId ?? null;
      } catch { return null; }
    }, []
  );

  const recordLogout = useCallback(async (tkn: string, sid: number) => {
    try {
      await fetch(`/api/sessions/${sid}/logout`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tkn}` },
      });
    } catch { /* silent */ }
  }, []);

  const logoutRef = useRef<() => void>(() => {});

  const logout = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const tkn = localStorage.getItem(TOKEN_KEY);
    const sid = localStorage.getItem("caprina_session_id");
    if (tkn && sid) recordLogout(tkn, parseInt(sid));
    setToken(null); setUser(null); setSessionId(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("caprina_session_id");
  }, [recordLogout]);

  useEffect(() => { logoutRef.current = logout; }, [logout]);

  const fetchMe = useCallback(async (tkn: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${tkn}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return normalizeUser((await res.json()) as AuthUser);
    } catch { return null; }
  }, []);

  const refreshUser = useCallback(async () => {
    const tkn = localStorage.getItem(TOKEN_KEY);
    if (!tkn) return;
    const updated = await fetchMe(tkn);
    if (updated) {
      const fresh = normalizeUser(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      setUser({ ...fresh });
    }
  }, [fetchMe]);

  const startPolling = useCallback((tkn: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const updated = await fetchMe(tkn);
      if (updated) {
        setUser((prev) => {
          if (!prev) return normalizeUser(updated);
          const roleChanged = prev.role !== updated.role;
          const activeChanged = prev.isActive !== updated.isActive;
          const permsChanged = permissionsChanged(prev.permissions, updated.permissions);
          if (!roleChanged && !activeChanged && !permsChanged) return prev;
          const fresh = normalizeUser(updated);
          localStorage.setItem(USER_KEY, JSON.stringify(fresh));
          return { ...fresh };
        });
      } else {
        logoutRef.current();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchMe]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(normalizeUser(parsed));
        fetchMe(savedToken).then((fresh) => {
          if (fresh) {
            const normalized = normalizeUser(fresh);
            setUser({ ...normalized });
            localStorage.setItem(USER_KEY, JSON.stringify(normalized));
          } else {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null); setUser(null);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (newToken: string, newUser: AuthUser) => {
      const normalized = normalizeUser(newUser);
      setToken(newToken);
      setUser({ ...normalized });
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      startPolling(newToken);
      const sid = await recordLogin(newToken);
      if (sid) {
        setSessionId(sid);
        localStorage.setItem("caprina_session_id", String(sid));
      }
    },
    [startPolling, recordLogin]
  );

  // ─── can() — المنطق الصحيح للصلاحيات ──────────────────────────────────
  // الأولوية:
  // 1. لو "*" → كل الصلاحيات
  // 2. لو permissions فاضية تماماً → استخدم الافتراضية للدور (للمستخدمين القدامى)
  // 3. لو permissions موجودة → تحقق منها بشكل صريح (حتى للأدمن)
  const can = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      const rawPerms = flattenPermissions(user.permissions);

      // "*" يعني كل الصلاحيات
      if (rawPerms.includes("*")) return true;

      // لو permissions فاضية تماماً — استخدم الافتراضية للدور
      // ده للمستخدمين القدامى اللي اتعملوا قبل نظام الصلاحيات
      if (rawPerms.length === 0) {
        const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] ?? [];
        return defaults.includes(permission);
      }

      // تحقق من الـ permissions المخزنة فعلاً — لكل الأدوار بما فيهم الأدمن
      return rawPerms.includes(permission);
    },
    [user]
  );

  const canViewFinancials = useMemo(() => can("view_financials"), [can]);

  return (
    <AuthContext.Provider value={{
      user, token, sessionId, login, logout, refreshUser,
      isAdmin: user?.role === "admin",
      isEmployee: user?.role === "employee",
      isWarehouse: user?.role === "warehouse",
      can, canViewFinancials, loading,
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
