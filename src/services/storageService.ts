import api from './api';

export interface PresignRequest {
  caseId: string;
  fileName: string;
  contentType: string;
}

export interface PresignResponse {
  url: string;
  key: string;
  bucket?: string;
  expires?: number;
}

export function presignEnabled(): boolean {
  const raw = localStorage.getItem('minio_presign_enabled');
  if (!raw) return true; // Default to enabled
  const v = String(raw).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on' || v === 'enabled';
}

export async function getPresignedUpload(req: PresignRequest): Promise<PresignResponse> {
  if (!presignEnabled()) {
    throw new Error('MinIO presign disabled');
  }
  const res = await api.post('/storage/presign', req);
  return res.data;
}

export async function recordDocument(payload: {
  caseId: string;
  objectKey: string;
  typeOfDocument: string;
  locationOfTheStorage: string;
  originalName: string;
  size: number;
  contentType: string;
}) {
  return api.post('/documents', payload);
}
