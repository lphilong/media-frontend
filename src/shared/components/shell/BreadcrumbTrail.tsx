import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type BreadcrumbTrailProps = {
  items: BreadcrumbItem[];
};

export const BreadcrumbTrail = ({ items }: BreadcrumbTrailProps): JSX.Element => {
  const { t } = useTranslation('common');

  return (
    <nav className="flex items-center gap-2 text-xs text-muted" aria-label={t('labels.breadcrumb')}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-text hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="text-text">{item.label}</span>
            )}
            {!isLast ? <span>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
};
