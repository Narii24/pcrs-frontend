import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { api as baseApi } from './CaseService';

export interface AssignedCaseDTO {
  assignmentId?: number;
  caseId: string;
  userId: string;
  assignedDate: string; // YYYY-MM-DD
}

const api = baseApi ?? axios.create({
  baseURL: 'http://localhost:8081/api'
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AssignedCaseService = {
  listAll: () => api.get<AssignedCaseDTO[]>('/assignedcases'),
  create: (payload: AssignedCaseDTO) => api.post<AssignedCaseDTO>('/assignedcases', payload),
  getById: (id: number) => api.get<AssignedCaseDTO>(`/assignedcases/${id}`),
  update: (id: number, payload: AssignedCaseDTO) => api.put<AssignedCaseDTO>(`/assignedcases/${id}`, payload),
  delete: (id: number) => api.delete(`/assignedcases/${id}`)
};

export default AssignedCaseService;
