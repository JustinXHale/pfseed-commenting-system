import { getEnv } from '../utils/env';
import { ProviderType, IssueProviderAdapter } from '../types/provider';
import { GitHubAdapter } from './githubAdapter';
import { GitLabAdapter } from './gitlabAdapter';

const PROVIDER_TYPE_STORAGE_KEY = 'commenting_provider_type';

export function getStoredProviderType(): ProviderType | undefined {
  try {
    const stored = localStorage.getItem(PROVIDER_TYPE_STORAGE_KEY);
    if (stored === 'github' || stored === 'gitlab') return stored;
  } catch {
    // Ignore storage access issues
  }
  return undefined;
}

export function setStoredProviderType(providerType: ProviderType | null): void {
  try {
    if (!providerType) {
      localStorage.removeItem(PROVIDER_TYPE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PROVIDER_TYPE_STORAGE_KEY, providerType);
  } catch {
    // Ignore storage access issues
  }
}

/**
 * Auto-detect provider type from environment variables
 * Supports backward compatibility by checking for GitHub credentials if no explicit provider is set
 */
export function getProviderType(): ProviderType {
  const explicitProvider = getEnv('VITE_PROVIDER_TYPE') as ProviderType | undefined;

  if (explicitProvider === 'github' || explicitProvider === 'gitlab') {
    return explicitProvider;
  }

  const storedProvider = getStoredProviderType();
  if (storedProvider) {
    const hasStoredClientId = Boolean(
      getEnv(storedProvider === 'gitlab' ? 'VITE_GITLAB_CLIENT_ID' : 'VITE_GITHUB_CLIENT_ID'),
    );
    if (hasStoredClientId) {
      return storedProvider;
    }
  }

  // Auto-detect from credentials (GitLab preferred for Red Hat workflows)
  const hasGitHubClientId = Boolean(getEnv('VITE_GITHUB_CLIENT_ID'));
  const hasGitLabClientId = Boolean(getEnv('VITE_GITLAB_CLIENT_ID'));

  if (hasGitLabClientId) {
    return 'gitlab';
  }

  // Fallback to GitHub if configured
  if (hasGitHubClientId) {
    return 'github';
  }

  // Default to GitLab (Red Hat's primary platform)
  return 'gitlab';
}

/**
 * Get the appropriate provider adapter instance based on current configuration
 */
export function getProviderAdapter(): IssueProviderAdapter {
  const providerType = getProviderType();

  switch (providerType) {
    case 'gitlab':
      return new GitLabAdapter();
    case 'github':
    default:
      return new GitHubAdapter();
  }
}

/**
 * Get human-readable display name for the current provider
 */
export function getProviderDisplayName(providerOverride?: ProviderType): string {
  const providerType = providerOverride ?? getProviderType();

  switch (providerType) {
    case 'gitlab':
      return 'GitLab';
    case 'github':
    default:
      return 'GitHub';
  }
}

/**
 * Get the OAuth authorization URL for the current provider
 */
export function getOAuthAuthorizeUrl(providerOverride?: ProviderType): string {
  const providerType = providerOverride ?? getProviderType();

  switch (providerType) {
    case 'gitlab': {
      const baseUrl = getEnv('VITE_GITLAB_BASE_URL') || 'https://gitlab.cee.redhat.com';
      const clientId = getEnv('VITE_GITLAB_CLIENT_ID');
      const redirectUri = `${window.location.origin}/api/gitlab-oauth-callback`;
      return `${baseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=api`;
    }
    case 'github':
    default: {
      const clientId = getEnv('VITE_GITHUB_CLIENT_ID');
      const redirectUri = `${window.location.origin}/api/github-oauth-callback`;
      return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
    }
  }
}

/**
 * Get the token storage key for the current provider
 */
export function getTokenStorageKey(providerOverride?: ProviderType): string {
  const providerType = providerOverride ?? getProviderType();

  switch (providerType) {
    case 'gitlab':
      return 'gitlab_access_token';
    case 'github':
    default:
      return 'github_access_token';
  }
}

/**
 * Get the user storage key for the current provider
 */
export function getUserStorageKey(providerOverride?: ProviderType): string {
  const providerType = providerOverride ?? getProviderType();

  switch (providerType) {
    case 'gitlab':
      return 'gitlab_user';
    case 'github':
    default:
      return 'github_user';
  }
}
