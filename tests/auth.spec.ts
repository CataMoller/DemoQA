import test, { expect } from '@/fixtures';
import {
  deleteUser,
  generateToken,
  getUserProfile,
  registerUser,
} from '@/functions/auth';
import { generateUserData } from '@/functions/testData';

test('Auth > Register > New user can register successfully', {
  annotation: { type: 'ID', description: 'AUTH-001' },
}, async ({ apiContext }) => {
  const api = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    const registered = await registerUser(api, credentials);
    userId = registered.userID;

    expect(typeof registered.userID).toBe('string');
    expect(registered.userID.length).toBeGreaterThan(0);
    expect(registered.username).toBe(credentials.userName);
    expect(registered.books).toEqual([]);

    token = await generateToken(api, credentials);
  } finally {
    if (userId && token) {
      await deleteUser(api, userId, token);
    }
  }
});

test('Auth > Login > Registered user receives a valid JWT', {
  annotation: { type: 'ID', description: 'AUTH-002' },
}, async ({ apiContext }) => {
  const api = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    const registered = await registerUser(api, credentials);
    userId = registered.userID;
    token = await generateToken(api, credentials);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token.split('.')).toHaveLength(3);

    const profile = await getUserProfile(api, userId, token);
    expect(profile.username).toBe(credentials.userName);
  } finally {
    if (userId && token) {
      await deleteUser(api, userId, token);
    }
  }
});

// User never registered — no cleanup needed
test('Auth > Login > Invalid credentials return 401', {
  annotation: { type: 'ID', description: 'AUTH-003' },
}, async ({ apiContext }) => {
  const api = apiContext.request;
  const credentials = generateUserData();
  const badCredentials = {
    userName: credentials.userName,
    password: `${credentials.password}WRONG`,
  };

  const promise = generateToken(api, badCredentials);

  await expect(promise).rejects.toThrow();
  await expect(generateToken(api, badCredentials)).rejects.toThrow(
    /authorization failed|token generation failed/i,
  );
  await expect(generateToken(api, badCredentials)).rejects.toThrow(/generateToken/);
});

test('Auth > Profile > Correct user data is displayed after login', {
  annotation: { type: 'ID', description: 'AUTH-004' },
}, async ({ customPage: page, apiContext }) => {
  const apiRaw = apiContext.request;
  const credentials = generateUserData();
  let userId = '';
  let token = '';
  try {
    await registerUser(page, credentials);
    const userData = await page.getUserData();
    userId = userData.userId;

    expect(typeof userData.userId).toBe('string');
    expect(userData.userId.length).toBeGreaterThan(0);
    expect(userData.username.toLowerCase()).toBe(credentials.userName.toLowerCase());

    await page.goto('/profile');
    await expect(page.getByText(credentials.userName)).toBeVisible();
  } finally {
    if (userId) {
      token = await generateToken(apiRaw, credentials);
      await deleteUser(apiRaw, userId, token);
    }
  }
});
