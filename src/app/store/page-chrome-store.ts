import { create } from 'zustand';

import type { ReactNode } from 'react';

type PageChromeStore = {
  pageActions: ReactNode | null;
  setPageActions: (actions: ReactNode | null) => void;
};

export const usePageChromeStore = create<PageChromeStore>((set) => ({
  pageActions: null,
  setPageActions: (pageActions) => set({ pageActions }),
}));
