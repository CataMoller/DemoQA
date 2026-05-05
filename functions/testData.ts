import { faker } from '@faker-js/faker';
import { type NewUser } from './auth';

const USERNAME_PREFIX = 'testuser_';
const USERNAME_MAX_LEN = 30;

/**
 * Generates a unique username prefixed with `testuser_`, with no whitespace
 * and capped at 30 characters total — safe for the DemoQA Account API.
 */
export function uniqueUsername(): string {
  const slug = faker.internet.username().replace(/\s+/g, '').toLowerCase();
  const remaining = USERNAME_MAX_LEN - USERNAME_PREFIX.length;
  const suffix = `${slug}${faker.string.alphanumeric(4)}`.slice(0, remaining);
  return `${USERNAME_PREFIX}${suffix}`;
}

/**
 * Generates a password that satisfies DemoQA's complexity policy:
 * minimum 8 characters and at least one uppercase letter, one lowercase
 * letter, one digit and one special character.
 */
export function uniquePassword(): string {
  const upper = faker.string.alpha({ length: 2, casing: 'upper' });
  const lower = faker.string.alpha({ length: 3, casing: 'lower' });
  const digits = faker.string.numeric(2);
  const special = faker.helpers.arrayElement(['!', '@', '#', '$', '%', '^', '&', '*']);
  return `${upper}${lower}${digits}${special}`;
}

/**
 * Builds a fresh NewUser payload using `uniqueUsername` and `uniquePassword`.
 */
export function generateUserData(): NewUser {
  return {
    userName: uniqueUsername(),
    password: uniquePassword(),
  };
}

/**
 * Returns the exact request body shape expected by `addToCollection`
 * (POST /BookStore/v1/Books).
 */
export function buildAddBookPayload(
  userId: string,
  isbn: string,
): { userId: string; collectionOfIsbns: Array<{ isbn: string }> } {
  return {
    userId,
    collectionOfIsbns: [{ isbn }],
  };
}
