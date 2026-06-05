import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type DetailBackLinkProps = {
  to: string;
  label: string;
  className?: string;
};

export const DetailBackLink = ({ to, label, className = '' }: DetailBackLinkProps): JSX.Element => (
  <Link
    to={to}
    aria-label={label}
    title={label}
    className={`inline-flex h-9 w-9 items-center justify-center rounded border border-border bg-panel text-text hover:bg-bg focus:outline-none focus:ring-2 focus:ring-accent ${className}`}
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </Link>
);
