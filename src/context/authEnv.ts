const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process

const isDevEnv = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
  (globalProcess?.env?.NODE_ENV !== 'production' && globalProcess?.env?.NODE_ENV !== undefined)
)

const isProdEnv = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
  (globalProcess?.env?.NODE_ENV === 'production')
)

const mockAuthFlag = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_DEV_MOCK_AUTH === 'true') ||
  (globalProcess?.env?.VITE_ENABLE_DEV_MOCK_AUTH === 'true')
)

/**
 * Mock authentication is strictly isolated to explicitly enabled development environments.
 * Completely disabled in production builds.
 */
export const isDevMockAuthEnabled: boolean = isDevEnv && !isProdEnv && mockAuthFlag
