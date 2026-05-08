import { useEffect, type ReactNode } from 'react';

import { usePageChromeStore } from '@app/store/page-chrome-store';

export const usePageActions = (actions: ReactNode | null): void => {
  const setPageActions = usePageChromeStore((state) => state.setPageActions);

  useEffect(() => {
    setPageActions(actions);

    return () => {
      setPageActions(null);
    };
  }, [actions, setPageActions]);
};
