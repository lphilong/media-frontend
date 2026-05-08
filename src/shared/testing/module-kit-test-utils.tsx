import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  ModuleDetailScreenShell,
  ModuleListScreenShell,
  ModuleMutationSurface,
  type ModuleDetailScreenShellProps,
  type ModuleListScreenShellProps,
  type ModuleMutationSurfaceProps,
} from '@shared/modules';

const defaultListProps: ModuleListScreenShellProps = {
  title: 'List Title',
  tableSection: <div>List Table</div>,
};

const defaultDetailProps: ModuleDetailScreenShellProps = {
  title: 'Detail Title',
  summarySection: <div>Summary</div>,
};

const defaultMutationProps: ModuleMutationSurfaceProps = {
  title: 'Mutation Title',
  kind: 'action',
  submitLabel: 'Submit',
  cancelLabel: 'Cancel',
  children: <div>Fields</div>,
};

export const renderModuleListShell = (props?: Partial<ModuleListScreenShellProps>) => {
  return render(<ModuleListScreenShell {...defaultListProps} {...props} />);
};

export const renderModuleDetailShell = (props?: Partial<ModuleDetailScreenShellProps>) => {
  return render(<ModuleDetailScreenShell {...defaultDetailProps} {...props} />);
};

export const renderModuleMutationSurface = (props?: Partial<ModuleMutationSurfaceProps>) => {
  return render(<ModuleMutationSurface {...defaultMutationProps} {...props} />);
};

export const expectPageHeading = (title: string): void => {
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
};

export const expectStatusText = (status: ReactNode): void => {
  if (typeof status === 'string') {
    expect(screen.getByText(status)).toBeInTheDocument();
  }
};

export const expectSectionText = (text: string): void => {
  expect(screen.getByText(text)).toBeInTheDocument();
};
