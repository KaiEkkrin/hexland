/**
 * Environment Detection Utility
 *
 * Provides utilities for detecting the deployment environment (production, test, development)
 * and retrieving environment-specific configuration like colors.
 *
 * Environment detection hierarchy:
 * 1. Build-time environment variable (VITE_DEPLOY_ENV) - most reliable
 * 2. Runtime hostname detection - fallback for runtime scenarios
 */

export type Environment = 'production' | 'test' | 'development';

/**
 * Detects environment based on hostname
 * Used as fallback when VITE_DEPLOY_ENV is not set
 */
const getEnvironmentFromHostname = (): Environment => {
  if (typeof window === 'undefined') {
    return 'development';
  }

  const hostname = window.location.hostname;

  // Production domains
  if (hostname === 'wallandshadow.io' || hostname === 'hexland.web.app') {
    return 'production';
  }

  // Test domain
  if (hostname.includes('hexland-test-25')) {
    return 'test';
  }

  // Local development
  return 'development';
};

/**
 * Gets the current deployment environment
 *
 * Priority:
 * 1. VITE_DEPLOY_ENV (set at build time by GitHub Actions or local builds)
 * 2. Hostname detection (runtime fallback)
 */
export const getEnvironment = (): Environment => {
  // Priority 1: Build-time environment variable
  const buildEnv = import.meta.env.VITE_DEPLOY_ENV;
  if (buildEnv && (buildEnv === 'production' || buildEnv === 'test' || buildEnv === 'development')) {
    return buildEnv;
  }

  // Priority 2: Runtime hostname detection
  return getEnvironmentFromHostname();
};

/**
 * Checks if the current environment is production
 */
export const isProduction = (): boolean => getEnvironment() === 'production';

/**
 * Checks if the current environment is test
 */
export const isTest = (): boolean => getEnvironment() === 'test';

/**
 * Checks if the current environment is development
 */
export const isDevelopment = (): boolean => getEnvironment() === 'development';

/**
 * Gets environment-specific color configuration
 *
 * Returns colors for navbar and background based on current environment:
 * - Production: Dark grey (current design)
 * - Test: Navy blue (distinctive for staging)
 * - Development: Forest green (distinctive for local dev)
 */
export const getEnvironmentColors = () => {
  const env = getEnvironment();

  const colors = {
    production: {
      navbar: '#212529',      // Dark grey (Bootstrap default dark)
      background: '#282c34',  // Dark grey (slightly lighter than navbar)
    },
    test: {
      navbar: '#001f3e',      // Navy blue (matched perceptual brightness)
      background: '#001f3e',  // Navy blue (matched perceptual brightness)
    },
    development: {
      navbar: '#062706',      // Very dark forest green (halfway to black)
      background: '#062706',  // Very dark forest green (halfway to black)
    },
  };

  return colors[env];
};

/**
 * Gets a human-readable environment label
 */
export const getEnvironmentLabel = (): string => {
  const env = getEnvironment();

  const labels = {
    production: 'Production',
    test: 'Test',
    development: 'Development',
  };

  return labels[env];
};
