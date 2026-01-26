import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE = 'http://localhost:8081/api';

// Create authenticated instance
const api = axios.create({
  baseURL: API_BASE
});

// Fixes the 401 error by injecting the token into every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token; 
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const caseService = {
  createCase: (data: any) => api.post('/cases', data),
  createParty: (data: any) => api.post('/parties', data),
  getAllCases: () => api.get('/cases'),
  getCaseById: (caseId: string) => api.get(`/cases/${caseId}`),
  getPartiesByCase: (caseId: string) => api.get(`/parties?caseId=${caseId}`),
  
  // Unified upload method to ensure multipart headers are correct
  uploadDocument: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export { api }; // Export for raw calls if needed
export default caseService;
