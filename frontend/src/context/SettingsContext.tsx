import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../libs/defaults";
import { loadSettings, saveSettings } from "../libs/storage";

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  hasApiKey: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    // Preserve the API key when resetting prompts/params — resetting should
    // not log the user out of Groq.
    setSettings((prev) => ({ ...DEFAULT_SETTINGS, groq_api_key: prev.groq_api_key }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      hasApiKey: settings.groq_api_key.trim().length > 0,
    }),
    [settings, updateSettings, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}