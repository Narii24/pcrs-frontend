import api from '@/services/api';

export interface DocumentDTO {
  documentId: string;
  caseId: string;
  typeOfDocument: string;
  locationOfTheStorage: string;
  file_name: string;
  fileSize: number;
  createdAt: string;
}

export const listDocuments = async (): Promise<DocumentDTO[]> => {
  const response = await api.get<DocumentDTO[]>('/documents');
  return Array.isArray(response.data) ? response.data : [];
};

export const getDocumentById = async (id: string): Promise<DocumentDTO> => {
  const response = await api.get<DocumentDTO>(`/documents/${encodeURIComponent(id)}`);
  return response.data;
};

export const createDocument = async (payload: DocumentDTO): Promise<DocumentDTO> => {
  const response = await api.post<DocumentDTO>('/documents', payload);
  return response.data;
};

export const updateDocument = async (
  id: string,
  payload: Partial<DocumentDTO>,
): Promise<DocumentDTO> => {
  const response = await api.put<DocumentDTO>(`/documents/${encodeURIComponent(id)}`, payload);
  return response.data;
};

export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${encodeURIComponent(id)}`);
};
