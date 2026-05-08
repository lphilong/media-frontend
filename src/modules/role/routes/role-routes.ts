import { APP_PATHS } from '@app/router/paths';

export const roleFrontendRoutes = {
  list: APP_PATHS.roles,
  detailPattern: APP_PATHS.roleDetailPattern,
  detail: APP_PATHS.roleDetail,
} as const;
