/**
 * Settings Store
 *
 * Manages extension settings using Zustand.
 */

import { create } from 'zustand';
import type { ExtensionSettings } from '~/types';
import { storage, DEFAULT_SETTINGS } from '~/lib/storage';

interface SettingsStore {
  // State
  settings: ExtensionSettings;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // Initial state with defaults
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  /**
   * Initialize settings from storage
   */
  initialize: async () => {
    set({ isLoading: true });

    try {
      const settings = await storage.getSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('[Ascentful] Settings initialization error:', error);
      set({ settings: DEFAULT_SETTINGS, isLoading: false });
    }
  },

  /**
   * Update settings
   */
  updateSettings: async (updates: Partial<ExtensionSettings>) => {
    const { settings } = get();
    const newSettings = { ...settings, ...updates };

    await storage.setSettings(newSettings);
    set({ settings: newSettings });
  },

  /**
   * Reset to default settings
   */
  resetSettings: async () => {
    await storage.setSettings(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

export default useSettingsStore;
