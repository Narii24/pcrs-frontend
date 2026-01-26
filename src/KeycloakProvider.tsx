import { ReactKeycloakProvider } from '@react-keycloak/web';
import { ReactNode } from 'react';
import { useAuthStore } from './stores/authStore';
import keycloak from './services/keycloak';
import api from './services/api';

interface KeycloakProviderProps {
  children: ReactNode;
}

export default function KeycloakProvider({ children }: KeycloakProviderProps) {
  const handleEvent = (event: string, error: any) => {
    if (event === 'onReady') {
      // Ready
    }
  };

  const handleTokens = (tokens: { idToken?: string; refreshToken?: string; token?: string }) => {
    if (tokens.token) {
      localStorage.setItem('token', tokens.token);
      // Fetch user info from backend or Keycloak
      api.get('/users/me').then((res) => {
        useAuthStore.getState().setAuth(tokens.token!, res.data);
      });
    }
  };

  return (
    <ReactKeycloakProvider authClient={keycloak} onEvent={handleEvent} onTokens={handleTokens}>
      {children}
    </ReactKeycloakProvider>
  );
}