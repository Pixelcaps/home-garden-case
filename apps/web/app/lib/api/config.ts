/**
 * Server-only configuration for talking to the backend API.
 * These values are read in loaders/actions (Node), never shipped to the browser.
 */
export const apiConfig = {
  baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  bearerToken: process.env.API_BEARER_TOKEN,
  defaultUserId: Number(process.env.DEFAULT_USER_ID ?? '1'),
};
