import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-white hover:bg-blue-700',
  secondary: 'border-border bg-panel text-text hover:bg-slate-50',
  outline: 'border-border bg-transparent text-text hover:bg-slate-50',
  ghost: 'border-transparent bg-transparent text-text hover:bg-slate-100',
  danger: 'border-danger bg-danger text-white hover:bg-red-700',
  link: 'border-transparent bg-transparent px-0 text-accent hover:underline',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 py-1.5 text-xs',
  md: 'min-h-10 px-3 py-2 text-sm',
  lg: 'min-h-11 px-4 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled = false,
      leftIcon,
      loading = false,
      loadingLabel,
      rightIcon,
      size = 'md',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref,
  ): JSX.Element => {
    const isDisabled = disabled || loading;
    const accessibleLabel = loading && loadingLabel ? loadingLabel : props['aria-label'];

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-label={accessibleLabel}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded border font-medium transition',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',
          SIZE_CLASS[size],
          VARIANT_CLASS[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
        <span>{children}</span>
        {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
        {!loading ? rightIcon : null}
      </button>
    );
  },
);

Button.displayName = 'Button';
