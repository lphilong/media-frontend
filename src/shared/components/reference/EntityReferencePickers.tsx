import {
  AsyncReferencePicker,
  type AsyncReferencePickerProps,
} from '@shared/components/reference/AsyncReferencePicker';

type EntityReferencePickerProps = Omit<AsyncReferencePickerProps, 'pickerId'>;

const createEntityReferencePicker = (pickerId: string) => {
  const EntityReferencePicker = (props: EntityReferencePickerProps): JSX.Element => {
    return <AsyncReferencePicker pickerId={pickerId} {...props} />;
  };

  EntityReferencePicker.displayName = `${pickerId}ReferencePicker`;

  return EntityReferencePicker;
};

export const OrgUnitReferencePicker = createEntityReferencePicker('org-unit');
export const EmploymentProfileReferencePicker = createEntityReferencePicker('employment-profile');
export const TalentReferencePicker = createEntityReferencePicker('talent');
export const TalentGroupReferencePicker = createEntityReferencePicker('talent-group');
export const PlatformAccountReferencePicker = createEntityReferencePicker('platform-account');
export const StudioResourceReferencePicker = createEntityReferencePicker('studio-resource');

export type { EntityReferencePickerProps };
