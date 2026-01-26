import api from '@/services/api';

export interface EvidenceDTO {
  evidenceId?: string;
  caseId: string;
  type: string;
  description: string;
  collectedByUserId?: string;
}

export const listEvidences = async (): Promise<EvidenceDTO[]> => {
  const response = await api.get<EvidenceDTO[]>('/evidences');
  return Array.isArray(response.data) ? response.data : [];
};

export const getEvidenceById = async (id: string): Promise<EvidenceDTO> => {
  const response = await api.get<EvidenceDTO>(`/evidences/${encodeURIComponent(id)}`);
  return response.data;
};

export const createEvidence = async (payload: EvidenceDTO): Promise<EvidenceDTO> => {
  const response = await api.post<EvidenceDTO>('/evidences', payload);
  return response.data;
};

export const updateEvidence = async (
  id: string,
  payload: Partial<EvidenceDTO>,
): Promise<EvidenceDTO> => {
  const response = await api.put<EvidenceDTO>(`/evidences/${encodeURIComponent(id)}`, payload);
  return response.data;
};

export const deleteEvidence = async (id: string): Promise<void> => {
  await api.delete(`/evidences/${encodeURIComponent(id)}`);
};
