import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { PageContainer, StatusBadge } from '@shared/components/primitives';

export type WorkspaceModuleItem<ModuleId extends string> = {
  id: ModuleId;
  label: string;
  description: string;
  statusLabel: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
};

type WorkspaceShellProps = {
  testId?: string;
  header: ReactNode;
  children: ReactNode;
};

export const WorkspaceShell = ({
  testId = 'workspace-shell',
  header,
  children,
}: WorkspaceShellProps): JSX.Element => (
  <main className="min-h-screen bg-bg text-text" data-testid={testId}>
    <div className="border-b border-border bg-panel">{header}</div>
    <PageContainer className="space-y-5 py-5">{children}</PageContainer>
  </main>
);

type WorkspaceHeaderProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  profile?: ReactNode;
};

export const WorkspaceHeader = ({
  title,
  subtitle,
  actions,
  profile,
}: WorkspaceHeaderProps): JSX.Element => (
  <PageContainer className="py-4">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3 md:items-end">
        {actions ? (
          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            {actions}
          </div>
        ) : null}
        {profile}
      </div>
    </div>
  </PageContainer>
);

type WorkspaceModuleSwitcherProps<ModuleId extends string> = {
  items: Array<WorkspaceModuleItem<ModuleId>>;
  activeId: ModuleId;
  label: string;
  selectedLabel: string;
  onSelect: (moduleId: ModuleId) => void;
  getTestId?: (moduleId: ModuleId) => string;
};

export const WorkspaceModuleSwitcher = <ModuleId extends string>({
  items,
  activeId,
  label,
  selectedLabel,
  onSelect,
  getTestId,
}: WorkspaceModuleSwitcherProps<ModuleId>): JSX.Element => (
  <nav aria-label={label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="tablist">
    {items.map((item) => (
      <WorkspaceModuleCard
        key={item.id}
        item={item}
        active={activeId === item.id}
        selectedLabel={selectedLabel}
        onSelect={onSelect}
        testId={getTestId?.(item.id)}
      />
    ))}
  </nav>
);

type WorkspaceModuleCardProps<ModuleId extends string> = {
  item: WorkspaceModuleItem<ModuleId>;
  active: boolean;
  selectedLabel: string;
  onSelect: (moduleId: ModuleId) => void;
  testId?: string;
};

export const WorkspaceModuleCard = <ModuleId extends string>({
  item,
  active,
  selectedLabel,
  onSelect,
  testId,
}: WorkspaceModuleCardProps<ModuleId>): JSX.Element => {
  const Icon = item.icon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-pressed={active}
      aria-disabled={item.disabled ? true : undefined}
      aria-describedby={item.disabledReason ? `${item.id}-disabled-reason` : undefined}
      onClick={() => onSelect(item.id)}
      className={`min-h-32 rounded border p-4 text-left transition ${
        active ? 'border-text bg-text text-bg' : 'border-border bg-panel text-text hover:bg-bg'
      }`}
      data-testid={testId}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <span
            className={`rounded border p-2 ${
              active ? 'border-bg/40 bg-bg/10' : 'border-border bg-bg'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className={`mt-1 block text-xs ${active ? 'text-bg/80' : 'text-muted'}`}>
              {item.description}
            </span>
          </span>
        </span>
        <span className="shrink-0">
          <StatusBadge
            label={active ? selectedLabel : item.statusLabel}
            tone={active ? 'neutral' : item.disabled ? 'warning' : 'success'}
            uppercase={false}
          />
        </span>
      </span>
      {item.disabledReason ? (
        <span
          id={`${item.id}-disabled-reason`}
          className={`mt-3 block text-xs ${active ? 'text-bg/80' : 'text-muted'}`}
        >
          {item.disabledReason}
        </span>
      ) : null}
    </button>
  );
};

type WorkspacePanelProps = {
  labelledBy?: string;
  testId?: string;
  children: ReactNode;
};

export const WorkspacePanel = ({
  labelledBy,
  testId,
  children,
}: WorkspacePanelProps): JSX.Element => (
  <section aria-labelledby={labelledBy} data-testid={testId} role="tabpanel">
    {children}
  </section>
);

type WorkspaceReadinessCardProps = {
  title: string;
  message: string;
  badgeLabel?: string;
};

export const WorkspaceReadinessCard = ({
  title,
  message,
  badgeLabel,
}: WorkspaceReadinessCardProps): JSX.Element => (
  <section className="rounded border border-border bg-panel p-4 shadow-sm">
    {badgeLabel ? (
      <div className="mb-3">
        <StatusBadge label={badgeLabel} tone="warning" uppercase={false} />
      </div>
    ) : null}
    <h2 className="text-lg font-semibold text-text">{title}</h2>
    <p className="mt-1 text-sm text-muted">{message}</p>
  </section>
);
