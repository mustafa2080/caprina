import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UsePwaInstall {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<boolean>;
  dismiss: () => void;
  isDismissed: boolean;
}

const DISMISSED_KEY = "caprina_pwa_dismissed";

export function usePwaInstall(): UsePwaInstall {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );

  useEffect(() => {
    // Check if already installed (standalone mode)
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(
      mq.matches ||
      (window.navigator as any).standalone === true
    );
    const onChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", onChange);

    // Capture the install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Track app installation
    const onInstalled = () => setIsInstalled(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [prompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  return {
    canInstall: !!prompt && !isInstalled,
    isInstalled,
    install,
    dismiss,
    isDismissed,
  };
}
