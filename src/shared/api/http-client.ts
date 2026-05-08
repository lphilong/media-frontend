import axios from 'axios';

import { env } from '@shared/config/env';
import { getAccessToken } from '@shared/api/token-provider';

export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
