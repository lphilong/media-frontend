import { ReferenceLink } from '@shared/components/primitives/ReferenceLink';

type ReferenceChipProps = {
  label: string;
  to?: string;
};

export const ReferenceChip = ({ label, to }: ReferenceChipProps): JSX.Element => {
  return <ReferenceLink label={label} to={to} asChip />;
};
