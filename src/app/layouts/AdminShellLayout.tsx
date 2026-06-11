import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router-dom';

import { usePageChromeStore } from '@app/store/page-chrome-store';
import { useShellStore } from '@app/store/shell-store';
import { ModalHostProvider } from '@shared/components/primitives';
import { AppTopBar, SidebarNav } from '@shared/components/shell';

type RouteHandle = {
  breadcrumbKey?: string;
  titleKey?: string;
  subtitleKey?: string;
  stubRoute?: boolean;
};

type MatchWithHandle = {
  pathname: string;
  handle?: RouteHandle;
};

export const AdminShellLayout = (): JSX.Element => {
  const { t } = useTranslation(['common', 'nav']);
  const matches = useMatches() as MatchWithHandle[];

  const sidebarCollapsed = useShellStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useShellStore((state) => state.toggleSidebar);
  const pageActions = usePageChromeStore((state) => state.pageActions);

  const leafHandle = matches.at(-1)?.handle;
  const pageTitle = leafHandle?.titleKey ? t(leafHandle.titleKey) : t('common:app.name');
  const pageSubtitle = leafHandle?.subtitleKey ? t(leafHandle.subtitleKey) : undefined;
  const defaultStubAction = leafHandle?.stubRoute ? (
    <button
      type="button"
      disabled
      className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted disabled:cursor-not-allowed"
    >
      {t('common:actions.stubAction')}
    </button>
  ) : null;

  const breadcrumbs = matches
    .filter((match) => match.handle?.breadcrumbKey)
    .map((match) => ({
      label: t(match.handle!.breadcrumbKey!),
      to: match.pathname,
    }));

  return (
    <ModalHostProvider>
      <div className="flex min-h-screen bg-bg text-text">
        <aside
          className={`flex flex-col border-r border-border bg-panel transition-all ${sidebarCollapsed ? 'w-20' : 'w-72'}`}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            {!sidebarCollapsed ? <span className="font-semibold">{t('common:app.name')}</span> : null}
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded border border-border p-1 text-muted hover:bg-slate-100"
              aria-label={t('common:actions.toggleSidebar')}
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
          <SidebarNav collapsed={sidebarCollapsed} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col" data-testid="admin-shell-main">
          <AppTopBar
            breadcrumbs={breadcrumbs}
            pageTitle={pageTitle}
            pageSubtitle={pageSubtitle}
            pageActions={pageActions ?? defaultStubAction}
          />
          <div className="flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </ModalHostProvider>
  );
};
