import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { mdiAlertCircleOutline } from '@mdi/js';
import { reportError } from '../../api/core';
import { t } from '../../i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import { PageSpinner } from './Spinner';

interface State {
  error: Error | null;
}

/** Catches a crash (or a lazy chunk that failed to download) and offers a retry instead of a white screen. */
class ErrorCatcher extends Component<{ children: ReactNode; compact?: boolean }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack?.split('\n')[1]?.trim() ?? 'web');
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon path={mdiAlertCircleOutline} size={40} className="text-danger" />
        <p className="font-medium">{t('Something went wrong')}</p>
        {!this.props.compact && <p className="max-w-md text-sm text-muted">{error.message}</p>}
        <Button variant="outline" onClick={() => this.setState({ error: null })}>
          {t('Try again')}
        </Button>
      </div>
    );
  }
}

/** Use around any lazy component: spinner while it loads, retry button if it fails. */
export function Boundary({ children, fallback, compact }: { children: ReactNode; fallback?: ReactNode; compact?: boolean }) {
  return (
    <ErrorCatcher compact={compact}>
      <Suspense fallback={fallback ?? <PageSpinner />}>{children}</Suspense>
    </ErrorCatcher>
  );
}
