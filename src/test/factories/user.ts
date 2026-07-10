export type TestUser = {
  id: string;
  displayName: string;
  email: string;
  locale: 'en' | 'vi' | 'zh';
  timezone: string;
  employmentProfileId?: string;
};

export const createUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: 'test-user',
  displayName: 'Test User',
  email: 'test.user@example.test',
  locale: 'en',
  timezone: 'Asia/Saigon',
  ...overrides,
});
