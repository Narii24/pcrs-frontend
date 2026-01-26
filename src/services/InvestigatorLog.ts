import api from '@/services/api';

export interface InvestigatorLogDTO {
  investigatorId: string;
  caseId: string;
  date: string;
  updateDetails: string;
}

export const listInvestigatorLogs = async (): Promise<InvestigatorLogDTO[]> => {
  const response = await api.get<InvestigatorLogDTO[]>('/investigatorlogs');
  return Array.isArray(response.data) ? response.data : [];
};

export const getInvestigatorLogById = async (
  id: string,
): Promise<InvestigatorLogDTO> => {
  const response = await api.get<InvestigatorLogDTO>(
    `/investigatorlogs/${encodeURIComponent(id)}`,
  );
  return response.data;
};

export const createInvestigatorLog = async (
  payload: InvestigatorLogDTO,
): Promise<InvestigatorLogDTO> => {
  const response = await api.post<InvestigatorLogDTO>(
    '/investigatorlogs',
    payload,
  );
  return response.data;
};

export const updateInvestigatorLog = async (
  id: string,
  payload: Partial<InvestigatorLogDTO>,
): Promise<InvestigatorLogDTO> => {
  const response = await api.put<InvestigatorLogDTO>(
    `/investigatorlogs/${encodeURIComponent(id)}`,
    payload,
  );
  return response.data;
};

export const deleteInvestigatorLog = async (id: string): Promise<void> => {
  await api.delete(`/investigatorlogs/${encodeURIComponent(id)}`);
};
