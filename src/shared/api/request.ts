import type { AxiosRequestConfig } from 'axios';

import { normalizeApiError } from '@shared/api/api-error';
import { apiClient } from '@shared/api/http-client';

export const apiRequest = async <TResponse, TPayload = unknown>(
  config: AxiosRequestConfig<TPayload>,
): Promise<TResponse> => {
  try {
    const response = await apiClient.request<TResponse, { data: TResponse }, TPayload>(config);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
};
