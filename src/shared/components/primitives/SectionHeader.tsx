type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export const SectionHeader = ({ title, subtitle }: SectionHeaderProps): JSX.Element => {
  return (
    <div className="mb-3 border-b border-border pb-2">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
};
