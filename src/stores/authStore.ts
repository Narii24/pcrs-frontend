import { create } from 'zustand';
import keycloak from '@/services/keycloak';
import { UserInfo } from '@/types';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  userInfo: (UserInfo & { role: string; username: string }) | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  initAuth: (manualTokens?: { token: string; refreshToken: string }) => Promise<void>;
  setAuth: (token: string, userInfo: any) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  token: null,
  userInfo: null,
  loading: true,
  error: null,

  setAuth: (token, userInfo) => {
      set({ 
          isAuthenticated: true, 
          token, 
          userInfo, 
          loading: false 
      });
  },

  logout: async () => {
    // Standardizing the redirect URI
    await keycloak.logout({ redirectUri: window.location.origin });
    set({ isAuthenticated: false, token: null, userInfo: null, loading: false });
  },

  hasRole: (role: string) => {
    const roles = get().userInfo?.roles || [];
    return roles.includes(role);
  },

  initAuth: async (manualTokens) => {
    set({ loading: true, error: null });
    try {
      // PROACTIVE HEALTH CHECK: Ensure Keycloak is reachable before redirecting
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 3000);
        try {
          await fetch(
            'http://localhost:8080/realms/pcrs-realm/.well-known/openid-configuration',
            {
              method: 'GET',
              signal: controller.signal,
            },
          );
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (connErr) {
        console.error("Auth Server Unreachable:", connErr);
        set({ 
            loading: false, 
            isAuthenticated: false, 
            error: 'Authentication Server (Keycloak) is unreachable. Please ensure Docker is running.' 
        });
        return;
      }

      const initOptions: any = {
        // CHANGED: 'login-required' forces the redirect to the Keycloak login page
        onLoad: 'login-required', 
        pkceMethod: 'S256',
        checkLoginIframe: false,
      };

      if (manualTokens) {
        initOptions.token = manualTokens.token;
        initOptions.refreshToken = manualTokens.refreshToken;
      }

      const authenticated = await keycloak.init(initOptions);

      if (authenticated) {
        // Handle Token Refreshing
        keycloak.onTokenExpired = async () => {
          try {
            await keycloak.updateToken(30);
            set({ token: keycloak.token });
          } catch (error) {
            console.error("Failed to refresh token");
            get().logout();
          }
        };

        const roles = keycloak.tokenParsed?.realm_access?.roles || [];
        
        // Match the roles used in your SecurityConfig.java
        const primaryRole = roles.includes('ADMIN') ? 'Administrator' : 
                           roles.includes('SUPERVISOR') ? 'Supervisor' : 
                           roles.includes('INVESTIGATOR') ? 'Investigator' : 
                           roles.includes('DESK_OFFICER') ? 'Desk Officer' : 'User';

        set({
          isAuthenticated: true,
          token: keycloak.token || null,
          userInfo: {
            sub: keycloak.subject || '',
            preferred_username: keycloak.tokenParsed?.preferred_username || '',
            username: keycloak.tokenParsed?.preferred_username || '',
            name: keycloak.tokenParsed?.name || '',
            roles: roles,
            role: primaryRole,
          },
          loading: false,
        });
      } else {
        set({ isAuthenticated: false, loading: false });
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      set({ loading: false, isAuthenticated: false, error: 'System Uplink Sync Failure' });
    }
  },
}));

export default useAuthStore;
