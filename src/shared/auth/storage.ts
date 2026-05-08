type StoredAuthToken = {
  accessToken: string;
  expiresAt: number;
};

const AUTH_STORAGE_KEY = 'admin.auth.token';

export const readStoredToken = (): StoredAuthToken | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthToken;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const writeStoredToken = (token: StoredAuthToken): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(token));
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
