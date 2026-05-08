export type AccessTokenProvider = () => Promise<string | null>;

let tokenProvider: AccessTokenProvider | null = null;

export const setAccessTokenProvider = (provider: AccessTokenProvider | null): void => {
  tokenProvider = provider;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!tokenProvider) {
    return null;
  }

  return tokenProvider();
};
