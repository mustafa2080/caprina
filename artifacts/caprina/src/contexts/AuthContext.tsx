import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
const USER_KEY = "caprina_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // Refresh current user data from API (for realtime permissions update)
  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (!savedToken || !savedUser) return;
    try {
      const currentUser: AuthUser = JSON.parse(savedUser);
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (!res.ok) return;
      const users: AuthUser[] = await res.json();
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) {
        setUser(updated);
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
      }
    } catch { /* ignore */ }
  }, []);

  const can = (permission: string): boolean => {
    if (!user) return false;
    // Use explicit permissions if saved
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes("*") || user.permissions.includes(permission);
    }
    // Fallback defaults if no permissions saved
    const defaults: Record<string, string[]> = {
      admin: ["*"],
      employee: ["orders", "dashboard"],
      warehouse: ["inventory", "movements", "dashboard"],
    };
    const allowed = defaults[user.role] || [];
    return allowed.includes("*") || allowed.includes(permission);
  };

  const canViewFinancials = can("view_financials");

  return (
    <AuthContext.Provider value={{
      user, token,
      login, logout, refreshUser,
      isAdmin: user?.role === "admin",
      isEmployee: user?.role === "employee",
      isWarehouse: user?.role === "warehouse",
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
