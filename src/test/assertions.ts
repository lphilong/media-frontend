import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const accountContextCodePattern = /\b(?:ADMIN_CONSOLE|MANAGER_CONSOLE|STAFF_CONSOLE)\b/u;
const rawRoleOrBundleCodePattern =
  /\b(?:ADMIN_FULL|TEAM_MANAGER|COMMERCIAL_FINANCE|TALENT_STAFF_SELF|OWNER_ADMIN|ACCESS_ADMIN|REVENUE_FINANCE_OPS|STAFF_CONSOLE_USER|[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){1,})\b/u;
const defaultRawIdPattern =
  /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(?:user|role|assignment|employment-profile|talent|group|org|kpi|revenue|commission)-[a-z0-9-]{3,})\b/iu;
const backendSourceNamePattern =
  /\b(?:ACCOUNT_CONTEXT|RESPONSIBILITY_ASSIGNMENT|responsibility_assignments|talent_group_manager_assignments|org_unit_manager_assignments|managerEmploymentProfileId|scopeFingerprint|sourceTrace)\b/u;
const rawJsonTracePattern = /(?:\{\s*"[^"]+"\s*:|\[\s*\{\s*"[^"]+"\s*:)/u;
const dtoApiNamePattern =
  /\b(?:[A-Z][A-Za-z0-9]+DTO|[A-Z][A-Za-z0-9]+Dto|ApiResponse|CurrentActorCapabilities|WorkspaceAvailabilityRecord|RoleAssignmentRecord|ScopeGrant)\b/u;
const debugTechnicalWordingPattern =
  /\b(?:debug|stack trace|console\.log|payload dump|raw payload|implementation detail|technical wording|api response|dto)\b/iu;

const cloneNormalUi = (container: HTMLElement): HTMLElement => {
  const clone = container.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      [
        'script',
        'style',
        'code',
        'pre',
        'details',
        '[data-testid*="technical" i]',
        '[data-testid*="audit" i]',
        '[aria-label*="technical" i]',
        '[aria-label*="audit" i]',
        '[data-normal-ui-ignore]',
      ].join(','),
    )
    .forEach((node) => node.remove());

  return clone;
};

const normalUiText = (container: HTMLElement = document.body): string =>
  cloneNormalUi(container).textContent ?? '';

export const expectNoRawAccountContextCodes = (container: HTMLElement = document.body): void => {
  expect(normalUiText(container)).not.toMatch(accountContextCodePattern);
};

export const expectNoRawIdsInNormalUi = (
  container: HTMLElement = document.body,
  rawIds: readonly string[] = [],
): void => {
  const text = normalUiText(container);

  for (const rawId of rawIds) {
    expect(text).not.toContain(rawId);
  }

  if (rawIds.length === 0) {
    expect(text).not.toMatch(defaultRawIdPattern);
  }
};

export const expectPermissionDeniedBusinessCopy = (
  container: HTMLElement = document.body,
  copyPattern: RegExp = /access|scope|permission|assigned|feature|required|data/iu,
): void => {
  expect(normalUiText(container)).toMatch(copyPattern);
  expectNoRawAccountContextCodes(container);
};

export const expectNoForbiddenNormalUiLeaks = (container: HTMLElement = document.body): void => {
  const text = normalUiText(container);

  expect(text).not.toMatch(accountContextCodePattern);
  expect(text).not.toMatch(rawRoleOrBundleCodePattern);
  expect(text).not.toMatch(defaultRawIdPattern);
  expect(text).not.toMatch(backendSourceNamePattern);
  expect(text).not.toMatch(rawJsonTracePattern);
  expect(text).not.toMatch(dtoApiNamePattern);
  expect(text).not.toMatch(debugTechnicalWordingPattern);
};

export const expectCursorPaginationDisclosure = (
  container: HTMLElement = document.body,
  disclosurePattern: RegExp = /one page at a time|total page count/iu,
): void => {
  const scope = within(container);

  expect(scope.getByRole('navigation', { name: /list pagination/i })).toBeInTheDocument();
  expect(scope.getByText(disclosurePattern)).toBeInTheDocument();
  expect(scope.queryByRole('spinbutton', { name: /go to page/i })).not.toBeInTheDocument();
  expect(normalUiText(container)).not.toMatch(/Page\s+\d+\s*\/\s*\d+/iu);
};

export const expectDangerousActionRequiresConfirmation = async (
  trigger: HTMLElement,
  options: { confirmName?: RegExp | string; dialogName?: RegExp | string } = {},
): Promise<void> => {
  const user = userEvent.setup();

  await user.click(trigger);

  const dialog =
    screen.queryByRole('dialog', { name: options.dialogName }) ??
    screen.getByTestId('confirm-dialog');
  expect(dialog).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', {
      name: options.confirmName ?? /confirm|apply|archive|delete|void|revoke/iu,
    }),
  ).toBeInTheDocument();
};

export const expectReferencePickerOption = (
  optionName: RegExp | string,
  options: { container?: HTMLElement; rawIds?: readonly string[] } = {},
): void => {
  const container = options.container ?? document.body;
  const scope = within(container);
  const option = scope.getByRole('option', { name: optionName });

  expect(option).toBeInTheDocument();
  expectNoRawAccountContextCodes(option);
  expectNoRawIdsInNormalUi(option, options.rawIds ?? []);
};
