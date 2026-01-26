import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import keycloak from '@/services/keycloak';

const api = axios.create({
  baseURL: 'http://localhost:8081/api',
});

api.interceptors.request.use(async (config) => {
  // 1. Prioritize Keycloak instance for fresh tokens
  if (keycloak.authenticated) {
    try {
      // Update token if it expires in < 30 seconds
      await keycloak.updateToken(30);
      
      // Sync with store if changed
      if (keycloak.token && keycloak.token !== useAuthStore.getState().token) {
        useAuthStore.setState({ token: keycloak.token });
      }
      
      config.headers.Authorization = `Bearer ${keycloak.token}`;
    } catch (error) {
      console.warn("Token refresh attempt failed", error);
      // Fallback to existing token in store if refresh fails
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } else {
    // 2. Fallback to store token
    const token = useAuthStore.getState().token; 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Global 401 Error Handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      try {
        if (keycloak.authenticated) {
          await keycloak.updateToken(30);
          if (keycloak.token && keycloak.token !== useAuthStore.getState().token) {
            useAuthStore.setState({ token: keycloak.token });
          }
          const config = error.config || {};
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${keycloak.token}`;
          config._retry = true;
          return api.request(config);
        }
      } catch (_) {
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
