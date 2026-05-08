import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from 'i18next';

import { ErrorState } from '@shared/components/primitives/ErrorState';
import { PageContainer } from '@shared/components/primitives/PageContainer';
import { captureError } from '@shared/monitoring';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureError(error, {
      category: 'react',
      routePath: window.location.pathname,
      moduleSurface: errorInfo.componentStack ? 'app-error-boundary' : undefined,
    });
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <PageContainer>
          <ErrorState
            title={i18n.t('errors:unexpected.title')}
            message={i18n.t('errors:unexpected.message')}
            actionLabel={i18n.t('common:actions.reload')}
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      );
    }

    return this.props.children;
  }
}
