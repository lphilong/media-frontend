import { Link } from 'react-router-dom';

type ReferenceLinkProps = {
  label: string;
  to?: string;
  asChip?: boolean;
};

export const ReferenceLink = ({ label, to, asChip = false }: ReferenceLinkProps): JSX.Element => {
  const sharedClassName = asChip
    ? 'inline-flex rounded border border-border bg-bg px-2 py-1 font-mono text-xs'
    : 'font-mono text-sm';

  if (!to) {
    return <span className={`${sharedClassName} text-muted`}>{label}</span>;
  }

  return (
    <Link to={to} className={`${sharedClassName} text-accent hover:underline`}>
      {label}
    </Link>
  );
};
