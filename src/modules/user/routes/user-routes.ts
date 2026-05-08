import { APP_PATHS } from '@app/router/paths';

export const userFrontendRoutes = {
  list: APP_PATHS.users,
  detailPattern: APP_PATHS.userDetailPattern,
  detail: APP_PATHS.userDetail,
} as const;
