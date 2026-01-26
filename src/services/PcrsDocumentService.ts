import axios from 'axios';

const API_URL = 'http://localhost:8081/api/documents';

// Helper for Auth Headers
const getHeaders = (isMultipart = false) => ({
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': isMultipart ? 'multipart/form-data' : 'application/json'
    }
});

export const documentService = {
    // --- CREATE (POST) with File Upload ---
    upload: async (file: File, caseId: string, type: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caseId', caseId); // Matches "caseID" in DB
        formData.append('type', type);
        return await axios.post(`${API_URL}/upload`, formData, getHeaders(true));
    },

    // --- READ (GET) ---
    getAll: async () => await axios.get(API_URL, getHeaders()),
    
    getById: async (id: string) => await axios.get(`${API_URL}/${id}`, getHeaders()),

    download: async (id: string) => {
        const config = { ...getHeaders(), responseType: 'blob' as const };
        return await axios.get(`${API_URL}/download/${id}`, config);
    },

    // --- UPDATE (PUT) ---
    update: async (id: string, data: any) => 
        await axios.put(`${API_URL}/${id}`, data, getHeaders()),

    // --- DELETE ---
    delete: async (id: string) => 
        await axios.delete(`${API_URL}/${id}`, getHeaders())
};
