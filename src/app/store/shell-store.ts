import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_LOCALE, type AppLocale } from '@shared/i18n/constants';
import { getStoredLocale } from '@shared/i18n/locale';

type ShellStore = {
  sidebarCollapsed: boolean;
  locale: AppLocale;
  toggleSidebar: () => void;
  setLocale: (locale: AppLocale) => void;
};

export const useShellStore = create<ShellStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      locale: typeof window === 'undefined' ? DEFAULT_LOCALE : getStoredLocale(),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'admin.shell.preferences',
    },
  ),
);
