import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface BrandSettings {
  name: string;
  tagline: string;
  hasLogo: boolean;
  logoUrl: string | null;
}

interface BrandContextValue {
  brand: BrandSettings;
  refresh: () => Promise<void>;
  update: (data: { name?: string; tagline?: string }) => Promise<void>;
  uploadLogo: (dataUrl: string) => Promise<void>;
  deleteLogo: () => Promise<void>;
  loading: boolean;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const DEFAULTS: BrandSettings = {
  name: "CAPRINA",
  tagline: "WIN OR DIE",
  hasLogo: false,
  logoUrl: null,
};

const BrandContext = createContext<BrandContextValue>({
  brand: DEFAULTS,
  refresh: async () => {},
  update: async () => {},
  uploadLogo: async () => {},
  deleteLogo: async () => {},
  loading: false,
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULTS);
  const [logoVersion, setLogoVersion] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiFetch<{ name: string; tagline: string; hasLogo: boolean }>("/brand");
      setBrand({
        name: data.name,
        tagline: data.tagline,
        hasLogo: data.hasLogo,
        logoUrl: data.hasLogo ? `${BASE_URL}/api/brand/logo?v=${logoVersion}` : null,
      });
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [logoVersion]);

  useEffect(() => { fetchSettings(); }, []);

  const refresh = useCallback(async () => {
    setLogoVersion(Date.now());
    await fetchSettings();
  }, [fetchSettings]);

  const update = useCallback(async (data: { name?: string; tagline?: string }) => {
    const result = await apiFetch<{ name: string; tagline: string; hasLogo: boolean }>(
      "/brand", { method: "PATCH", body: JSON.stringify(data) }
    );
    setBrand(prev => ({
      ...prev,
      name: result.name,
      tagline: result.tagline,
      hasLogo: result.hasLogo,
    }));
  }, []);

  const uploadLogo = useCallback(async (dataUrl: string) => {
    await apiFetch("/brand/logo", { method: "POST", body: JSON.stringify({ dataUrl }) });
    const v = Date.now();
    setLogoVersion(v);
    setBrand(prev => ({
      ...prev,
      hasLogo: true,
      logoUrl: `${BASE_URL}/api/brand/logo?v=${v}`,
    }));
  }, []);

  const deleteLogo = useCallback(async () => {
    await apiFetch("/brand/logo", { method: "DELETE" });
    setBrand(prev => ({ ...prev, hasLogo: false, logoUrl: null }));
  }, []);

  return (
    <BrandContext.Provider value={{ brand, refresh, update, uploadLogo, deleteLogo, loading }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
