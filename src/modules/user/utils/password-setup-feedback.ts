import type { UserMutationResult, UserPasswordSetupMetadata } from '@modules/user/types/user.types';

type PasswordSetupFeedbackKey =
  | 'user:feedback.passwordSetupEmailSent'
  | 'user:feedback.passwordSetupTicketCreated'
  | 'user:feedback.passwordSetupCompleted';

type ProvisionPasswordSetupFeedbackKey =
  | 'user:provisionResult.passwordSetupEmailSent'
  | 'user:provisionResult.passwordSetupTicketCreated'
  | 'user:provisionResult.passwordSetupNotCreated';

export const getPasswordSetupFeedback = (
  result: UserMutationResult | UserPasswordSetupMetadata | null | undefined,
): PasswordSetupFeedbackKey => {
  const passwordSetup = result && 'deliveryMode' in result ? result : result?.passwordSetup;

  if (passwordSetup?.emailSent === true) {
    return 'user:feedback.passwordSetupEmailSent';
  }

  if (passwordSetup?.ticketCreated === true) {
    return 'user:feedback.passwordSetupTicketCreated';
  }

  return 'user:feedback.passwordSetupCompleted';
};

export const getProvisionPasswordSetupFeedback = (
  result: UserMutationResult,
): ProvisionPasswordSetupFeedbackKey => {
  if (
    result.provisioning?.invitationEmailSent === true ||
    result.passwordSetup?.emailSent === true
  ) {
    return 'user:provisionResult.passwordSetupEmailSent';
  }

  if (
    result.provisioning?.invitationTicketCreated === true ||
    result.passwordSetup?.ticketCreated === true
  ) {
    return 'user:provisionResult.passwordSetupTicketCreated';
  }

  return 'user:provisionResult.passwordSetupNotCreated';
};
