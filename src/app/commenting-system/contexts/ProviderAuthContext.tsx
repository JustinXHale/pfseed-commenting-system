import * as React from 'react';
import { ProviderUser, ProviderType } from '../types/provider';
import {
  getProviderType,
  getProviderDisplayName,
  getOAuthAuthorizeUrl,
  getTokenStorageKey,
  getUserStorageKey,
  setStoredProviderType,
} from '../services/providerFactory';
import { getEnv } from '../utils/env';

interface ProviderAuthContextType {
  user: ProviderUser | null;
  isAuthenticated: boolean;
  providerType: ProviderType;
  providerDisplayName: string;
  availableProviders: ProviderType[];
  setProviderType: (providerType: ProviderType) => void;
  login: (providerType?: ProviderType) => void;
  logout: () => void;
}

const ProviderAuthContext = React.createContext<ProviderAuthContextType | undefined>(undefined);

const storeProviderAuth = (token: string, user: ProviderUser, providerType: ProviderType) => {
  localStorage.setItem(getTokenStorageKey(providerType), token);
  localStorage.setItem(getUserStorageKey(providerType), JSON.stringify(user));
};

const clearProviderAuth = (providerType: ProviderType) => {
  localStorage.removeItem(getTokenStorageKey(providerType));
  localStorage.removeItem(getUserStorageKey(providerType));
};

const getStoredProviderUser = (providerType: ProviderType): ProviderUser | null => {
  const raw = localStorage.getItem(getUserStorageKey(providerType));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderUser;
  } catch {
    return null;
  }
};

export const ProviderAuthProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<ProviderUser | null>(null);
  const [providerType, setProviderTypeState] = React.useState<ProviderType>(getProviderType());
  const providerDisplayName = getProviderDisplayName(providerType);
  const availableProviders = React.useMemo<ProviderType[]>(() => {
    const explicitProvider = getEnv('VITE_PROVIDER_TYPE') as ProviderType | undefined;
    if (explicitProvider === 'github' || explicitProvider === 'gitlab') {
      return [explicitProvider];
    }

    const providers: ProviderType[] = [];
    if (getEnv('VITE_GITHUB_CLIENT_ID')) providers.push('github');
    if (getEnv('VITE_GITLAB_CLIENT_ID')) providers.push('gitlab');
    if (!providers.length) providers.push(getProviderType());
    return providers;
  }, []);

  React.useEffect(() => {
    const stored = getStoredProviderUser(providerType);
    setUser(stored);
  }, [providerType]);

  const setProviderType = (nextProvider: ProviderType) => {
    if (!availableProviders.includes(nextProvider)) return;
    setProviderTypeState(nextProvider);
    setStoredProviderType(nextProvider);
  };

  // Handle local dev OAuth callback via hash: /#/auth-callback?token=...&login=...&avatar=...
  React.useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('#/auth-callback')) return;

    const query = hash.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const token = params.get('token');
    const login = params.get('login');
    const avatar = params.get('avatar');

    if (token && login && avatar) {
      const decodedUser = { login, avatar: decodeURIComponent(avatar) };
      storeProviderAuth(token, decodedUser, providerType);
      setUser(decodedUser);
    }

    // remove hash and return to home
    window.location.hash = '/';
  }, []);

  const login = (requestedProvider?: ProviderType) => {
    const nextProvider = requestedProvider || providerType;

    let clientId: string | undefined;
    try {
      const envKey = nextProvider === 'gitlab' ? 'VITE_GITLAB_CLIENT_ID' : 'VITE_GITHUB_CLIENT_ID';
      clientId = getEnv(envKey);
    } catch (e) {
      clientId = undefined;
    }

    if (!clientId) {
      // eslint-disable-next-line no-alert
      alert(`${getProviderDisplayName(nextProvider)} login is not configured (missing client ID).`);
      return;
    }

    if (requestedProvider && requestedProvider !== providerType) {
      setProviderType(requestedProvider);
    }

    const url = getOAuthAuthorizeUrl(nextProvider);

    console.log(`🔑 ${getProviderDisplayName(nextProvider)} OAuth URL:`, url);
    console.log(`📋 Provider type:`, nextProvider);

    window.location.href = url;
  };

  const logout = () => {
    clearProviderAuth(providerType);
    setUser(null);
  };

  return (
    <ProviderAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        providerType,
        providerDisplayName,
        availableProviders,
        setProviderType,
        login,
        logout,
      }}
    >
      {children}
    </ProviderAuthContext.Provider>
  );
};

export const useProviderAuth = (): ProviderAuthContextType => {
  const ctx = React.useContext(ProviderAuthContext);
  if (!ctx) throw new Error('useProviderAuth must be used within a ProviderAuthProvider');
  return ctx;
};
