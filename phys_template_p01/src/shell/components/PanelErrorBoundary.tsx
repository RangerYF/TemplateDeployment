import { Component, type ErrorInfo, type ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';

interface PanelErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  compact?: boolean;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  override state: PanelErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): PanelErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[PanelErrorBoundary]', this.props.title ?? 'panel', error, errorInfo);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.bg,
          color: COLORS.textSecondary,
          borderRadius: 8,
          padding: this.props.compact ? '8px 10px' : '12px 14px',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {this.props.title ?? '模块'} 暂时无法显示。
      </div>
    );
  }
}
