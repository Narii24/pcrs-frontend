import { useEffect, useState, useRef, Fragment } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { getPresignedUpload, recordDocument, presignEnabled } from '../services/storageService';
import { usePreferencesStore, t } from '../stores/preferencesStore';

interface DocumentDTO {
  documentId: string;
  caseId: string;
  typeOfDocument: string;
  digitalFilePath: string;
  fileName: string;
  locationOfTheStorage: string;
}

const Documents = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = usePreferencesStore();

  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState({
    documentId: '',
    caseId: '',
    typeOfDocument: 'Identification',
    locationOfTheStorage: 'Electronic Folder AABB',
    file: null as File | null
  });

  const getDocumentId = (doc: any) => {
    const raw =
      doc.documentId ||
      doc.document_id ||
      doc.id ||
      doc._id;
    return raw ? String(raw).trim() : '';
  };

  const getDocumentPath = (doc: any) => {
    const raw =
      (doc as any).documentUrl ||
      (doc as any).objectKey ||
      doc.digitalFilePath ||
      '';
    const trimmed = String(raw || '').trim();
    if (!trimmed || trimmed === '#' || trimmed.toLowerCase() === 'n/a') return null;
    if (trimmed.startsWith('cases/')) {
      return `http://localhost:9000/pcrs-file/${trimmed}`;
    }
    return trimmed;
  };

  const getDocumentIdFromPath = (path: string | null) => {
    if (!path) return '';
    const trimmed = String(path).trim();
    if (!trimmed) return '';
    const match = trimmed.match(/\/documents\/(?:view|download)\/([^/?#]+)/i);
    return match && match[1] ? match[1].trim() : '';
  };

  const buildAbsoluteUrl = (path: string | null) => {
    if (!path) return null;
    const trimmed = String(path).trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const base = api.defaults.baseURL || '';
    if (!base) return null;

    const root = base.replace(/\/api\/?$/i, '');
    const normalized = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
    return `${root}${normalized}`;
  };

  const handleViewDocument = async (doc: DocumentDTO) => {
    const directPath = getDocumentPath(doc);
    const directUrl = buildAbsoluteUrl(directPath);
    const documentIdFromMeta = getDocumentId(doc);
    const documentIdFromPath = getDocumentIdFromPath(directPath);
    const documentId = documentIdFromMeta || documentIdFromPath;

    try {
      let response;

      if (directUrl) {
        try {
          response = await api.get(directUrl, {
            responseType: 'blob',
          });
        } catch (err: any) {
          if (!documentId) {
            throw err;
          }
        }
      }

      if (!response) {
        if (!documentId) {
          alert(t(language, 'intelligenceAccessDeniedFileBinaryNotFound'));
          return;
        }

        try {
          response = await api.get(`/documents/view/${documentId}`, {
            responseType: 'blob',
          });
        } catch (err: any) {
          if (err?.response?.status === 404) {
            response = await api.get(`/documents/download/${documentId}`, {
              responseType: 'blob',
            });
          } else {
            throw err;
          }
        }
      }

      const contentType = response.headers['content-type'] || undefined;
      const fileURL = URL.createObjectURL(new Blob([response.data], { type: contentType }));
      window.open(fileURL, '_blank');
    } catch (err) {
      alert(t(language, 'intelligenceAccessDeniedFileBinaryNotFound'));
    }
  };

  const handleDownloadDocument = async (doc: DocumentDTO) => {
    const directPath = getDocumentPath(doc);
    const directUrl = buildAbsoluteUrl(directPath);
    const documentIdFromMeta = getDocumentId(doc);
    const documentIdFromPath = getDocumentIdFromPath(directPath);
    const documentId = documentIdFromMeta || documentIdFromPath;

    try {
      let response;

      if (directUrl) {
        try {
          response = await api.get(directUrl, {
            responseType: 'blob',
          });
        } catch (err: any) {
          if (!documentId) {
            throw err;
          }
        }
      }

      if (!response) {
        if (!documentId) {
          alert(t(language, 'uplinkFailureCouldNotDownload'));
          return;
        }

        try {
          response = await api.get(`/documents/download/${documentId}`, {
            responseType: 'blob',
          });
        } catch (err: any) {
          if (err?.response?.status === 404) {
            response = await api.get(`/documents/view/${documentId}`, {
              responseType: 'blob',
            });
          } else {
            throw err;
          }
        }
      }

      const contentType = response.headers['content-type'] || undefined;
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        doc.fileName || (documentId ? `DOC-${documentId}` : 'document')
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(t(language, 'uplinkFailureCouldNotDownload'));
    }
  };

  const handleOpenModal = () => {
    setFormData({
      documentId: 'DOC-010',
      caseId: 'PCRS-772',
      typeOfDocument: 'Identification',
      locationOfTheStorage: 'Electronic Folder AABB',
      file: null
    });
    setShowModal(true);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const docId = searchParams.get('documentId') || '';
    const caseId = searchParams.get('caseId') || '';
    const initial = docId || caseId;
    if (initial) {
      setSearchTerm(initial);
    }
  }, [searchParams]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const [docsRes, casesRes] = await Promise.all([
        api.get<DocumentDTO[]>('/documents'),
        api.get('/cases'),
      ]);

      const docsData = Array.isArray(docsRes.data) ? docsRes.data : [];
      const casesData = Array.isArray(casesRes.data) ? casesRes.data : [];

      setDocuments(docsData);
      setCases(casesData);
    } catch (err) {
      setDocuments([]);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    data.append('documentId', formData.documentId);
    data.append('caseId', formData.caseId);
    data.append('typeOfDocument', formData.typeOfDocument);
    data.append('locationOfTheStorage', formData.locationOfTheStorage);
    if (formData.file) data.append('file', formData.file);

    const file = formData.file;
    const caseId = formData.caseId;

    try {
      if (file && caseId && presignEnabled()) {
        const contentType = file.type || 'application/octet-stream';
        try {
          const presign = await getPresignedUpload({
            caseId: String(caseId),
            fileName: file.name,
            contentType,
          });
          await fetch(presign.url, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
          });
          await recordDocument({
            caseId: String(caseId),
            objectKey: presign.key,
            typeOfDocument: formData.typeOfDocument,
            locationOfTheStorage: 'MinIO - pcrs-file',
            originalName: file.name,
            size: file.size,
            contentType,
          });
          setShowModal(false);
          fetchDocuments();
          return;
        } catch (_) {
        }
      }

      await api.post('/documents/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowModal(false);
      fetchDocuments();
    } catch (err) {
      alert(t(language, 'submitEntryFailed'));
    }
  };

  const filteredDocs = documents.filter(doc => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const docId = (doc.documentId || '').toLowerCase();
    const caseId = (doc.caseId || '').toLowerCase();
    const fileName = (doc.fileName || '').toLowerCase();
    const type = (doc.typeOfDocument || '').toLowerCase();
    return (
      docId.includes(term) ||
      caseId.includes(term) ||
      fileName.includes(term) ||
      type.includes(term)
    );
  });

  const casesWithDocuments = (() => {
    const map = new Map<string, { caseData: any | null; documents: DocumentDTO[] }>();

    filteredDocs.forEach(doc => {
      const rawCaseId =
        (doc as any).caseId ||
        (doc as any).case_id ||
        (doc as any).caseID ||
        '';
      const caseId = String(rawCaseId || '').trim();
      if (!caseId) return;

      if (!map.has(caseId)) {
        const caseData =
          cases.find(
            (c: any) =>
              String(c.caseId || c.case_id || c.caseID || '').trim() === caseId
          ) || null;
        map.set(caseId, { caseData, documents: [] });
      }

      map.get(caseId)!.documents.push(doc);
    });

    return Array.from(map.entries()).map(([caseId, value]) => ({
      caseId,
      caseData: value.caseData,
      documents: value.documents,
    }));
  })();

  return (
    <div className="space-y-6 p-8 bg-[#06080f] min-h-screen text-white">
      
      {/* RESTORED HEADER: Matches your screenshot style */}
      <div className="flex justify-between items-center bg-[#0a0c14] p-6 rounded-3xl border border-white/5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">{t(language, 'documentArchiveTitle')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder={t(language, 'filterIntelligencePlaceholder')} 
            className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-blue-500 w-64"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* THE BUTTON: Exactly as requested */}
          <button 
            onClick={handleOpenModal} 
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all"
          >
            {t(language, 'addDocument')}
          </button>
        </div>
      </div>

      {/* DOCUMENT TABLE */}
      <div className="bg-[#0a0c14] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.15em] text-blue-500/70 italic">
              <th className="p-5">{t(language, 'documentIdLabel')}</th>
              <th className="p-5">{t(language, 'caseIdLabel')}</th>
              <th className="p-5">{t(language, 'typeFileName')}</th>
              <th className="p-5">{t(language, 'storage')}</th>
              <th className="p-5 text-right">{t(language, 'actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {casesWithDocuments.map(block => {
              const c = block.caseData;
              const caseLabel = block.caseId;
              const title =
                (c && (c.title || c.caseTitle || c.case_title)) || t(language, 'unknownCase');
              const status =
                (c &&
                  (c.currentStatus ||
                    c.current_status ||
                    c.status)) || t(language, 'unknown');

              return (
                <Fragment key={caseLabel}>
                  <tr className="bg-white/[0.03]">
                    <td colSpan={5} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">
                            {t(language, 'caseLabel')}: {caseLabel}
                          </div>
                          <div className="text-sm font-black uppercase text-white">
                            {title}
                          </div>
                          <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                            {t(language, 'statusLabel')}: {status}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {block.documents.map(doc => (
                    <tr
                      key={doc.documentId}
                      className="hover:bg-blue-600/[0.03] transition-colors"
                    >
                      <td className="p-5 font-mono text-cyan-400 text-xs font-bold">
                        {doc.documentId}
                      </td>
                      <td className="p-5 text-white text-xs font-black italic">
                        {doc.caseId}
                      </td>
                      <td className="p-5">
                        <div className="text-white text-[11px] font-bold uppercase">
                          {doc.typeOfDocument}
                        </div>
                        <div className="text-slate-500 text-[9px] font-mono">
                          {doc.fileName}
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-3 py-1 rounded-lg border border-emerald-500/20 uppercase">
                          {doc.locationOfTheStorage}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-2">
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all"
                        >
                          {t(language, 'viewDocument')}
                        </button>
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-lg shadow-blue-600/20"
                        >
                          {t(language, 'download')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL: Restoration of the Uplink Modal from your second screenshot */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#0f111a] border border-white/10 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="bg-blue-600 p-6">
                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{t(language, 'newDocumentUplink')}</h3>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">{t(language, 'documentIdLabel')}</label>
                    <input 
                      name="documentId" value={formData.documentId} 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500" 
                      onChange={(e) => setFormData({...formData, documentId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">{t(language, 'caseIdLabel')}</label>
                    <input 
                      name="caseId" value={formData.caseId} 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500"
                      onChange={(e) => setFormData({...formData, caseId: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">{t(language, 'typeofdocument')}</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none"
                      value={formData.typeOfDocument}
                      onChange={(e) => setFormData({...formData, typeOfDocument: e.target.value})}
                    >
                      <option value="Identification">{t(language, 'documentTypeIdentification')}</option>
                      <option value="Forensic Report">{t(language, 'documentTypeForensicReport')}</option>
                      <option value="Legal Warrant">{t(language, 'documentTypeLegalWarrant')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block">{t(language, 'storageLocation')}</label>
                    <input 
                      value={formData.locationOfTheStorage} 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500"
                      onChange={(e) => setFormData({...formData, locationOfTheStorage: e.target.value})}
                    />
                  </div>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/5 transition-all"
                >
                  <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setFormData({...formData, file: e.target.files?.[0] || null})} />
                  <span className="text-2xl">📤</span>
                  <p className="text-[10px] font-black uppercase text-gray-400">
                    {formData.file ? formData.file.name : t(language, 'selectOrDragDocumentBinary')}
                  </p>
                </div>

                <div className="flex justify-end items-center gap-6 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="text-gray-500 text-[10px] font-black uppercase hover:text-white transition-colors">{t(language, 'abort')}</button>
                  <button type="submit" className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all">{t(language, 'submitEntry')}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Documents;
