import api from '@/services/api';

export interface UserDTO {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

export const listUsers = async (): Promise<UserDTO[]> => {
  const response = await api.get<UserDTO[]>('/users');
  return Array.isArray(response.data) ? response.data : [];
};

export const getUserById = async (id: string): Promise<UserDTO> => {
  const response = await api.get<UserDTO>(`/users/${encodeURIComponent(id)}`);
  return response.data;
};

export const createUser = async (payload: UserDTO): Promise<UserDTO> => {
  const response = await api.post<UserDTO>('/users', payload);
  return response.data;
};

export const updateUser = async (
  id: string,
  payload: Partial<UserDTO>,
): Promise<UserDTO> => {
  const response = await api.put<UserDTO>(`/users/${encodeURIComponent(id)}`, payload);
  return response.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${encodeURIComponent(id)}`);
};
