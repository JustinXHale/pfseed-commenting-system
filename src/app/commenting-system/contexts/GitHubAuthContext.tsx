/**
 * DEPRECATED: Use ProviderAuthContext instead
 * This file provides backward compatibility for existing code that uses GitHubAuthContext
 */

import { ProviderAuthProvider, useProviderAuth } from './ProviderAuthContext';

// Re-export for backward compatibility
export const GitHubAuthProvider = ProviderAuthProvider;
export const useGitHubAuth = useProviderAuth;


