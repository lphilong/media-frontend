import clsx from 'clsx';
import { KeyRound, LayoutGrid, Landmark, Rocket, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import {
  shellNavigationGroups,
  type NavGroup,
  type ShellNavigationItem,
} from '@app/router/module-definitions';

const navGroupOrder: NavGroup[] = [
  'overview',
  'identityAccess',
  'organization',
  'talentOwnership',
  'operations',
  'commercial',
];

const navGroupIconMap: Record<NavGroup, JSX.Element> = {
  overview: <LayoutGrid className="h-4 w-4" />,
  identityAccess: <KeyRound className="h-4 w-4" />,
  organization: <Landmark className="h-4 w-4" />,
  talentOwnership: <Rocket className="h-4 w-4" />,
  operations: <Wrench className="h-4 w-4" />,
  commercial: <LayoutGrid className="h-4 w-4" />,
};

type SidebarNavProps = {
  collapsed: boolean;
};

export const SidebarNav = ({ collapsed }: SidebarNavProps): JSX.Element => {
  const { t } = useTranslation('nav');
  const location = useLocation();

  const isItemActive = (item: ShellNavigationItem): boolean => {
    if (item.to) {
      return (
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(`${item.to}/`))
      );
    }

    return item.children?.some((child) => isItemActive(child)) ?? false;
  };

  const renderNavItem = (item: ShellNavigationItem, depth = 0): JSX.Element => {
    const hasChildren = (item.children?.length ?? 0) > 0;
    const active = isItemActive(item);
    const label = collapsed ? t(`short.${item.navItemKey}`) : t(`items.${item.navItemKey}`);

    if (!item.to) {
      return (
        <div key={item.id} className="space-y-1">
          <div
            className={clsx(
              'rounded px-3 py-2 text-sm font-medium',
              depth > 0 && !collapsed ? 'ml-4' : '',
              active ? 'bg-accent/10 text-accent' : 'text-muted',
            )}
          >
            {label}
          </div>
          {hasChildren ? (
            <div className={clsx('space-y-1', collapsed ? '' : 'ml-2')}>
              {item.children!.map((child) => renderNavItem(child, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <NavLink
        key={item.id}
        to={item.to}
        data-testid={`nav-link-${item.id}`}
        className={({ isActive }) =>
          clsx(
            'block rounded px-3 py-2 text-sm transition-colors',
            depth > 0 && !collapsed ? 'ml-4' : '',
            isActive
              ? 'bg-accent/10 font-medium text-accent'
              : 'text-text hover:bg-slate-100 hover:text-text',
          )
        }
      >
        {label}
      </NavLink>
    );
  };

  return (
    <nav
      className="flex-1 overflow-y-auto px-2 pb-3"
      aria-label={t('landmarks.primaryNavigation')}
      data-testid="primary-navigation"
    >
      {navGroupOrder.map((group) => {
        const navGroup = shellNavigationGroups.find((groupDef) => groupDef.id === group);
        if (!navGroup || navGroup.items.length === 0) {
          return null;
        }

        return (
          <section key={group} className="mb-4">
            <header className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase text-muted">
              {navGroupIconMap[group]}
              {!collapsed ? <span>{t(`groups.${group}`)}</span> : null}
            </header>
            <div className="space-y-1">{navGroup.items.map((item) => renderNavItem(item))}</div>
          </section>
        );
      })}
    </nav>
  );
};
