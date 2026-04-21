import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "./defaults";

const STORAGE_KEY = "twinmind-copilot:settings:v1";

/**
 * Load settings from localStorage, falling back to defaults for any missing
 * fields (so upgrading the default prompts doesn't wipe a user's key).
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn("Failed to load settings, using defaults", err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings", err);
  }
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}