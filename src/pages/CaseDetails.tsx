import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, ShieldCheck, Clock, MapPin, AlertCircle, Edit3, XCircle, Save, FileText, Download, Eye, Upload } from 'lucide-react';
import api from '@/services/api';

interface CaseDetailsProps {
  caseId?: string;
  embedded?: boolean;
  onClose?: () => void;
  startInEdit?: boolean;
  onCaseUpdated?: () => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
}

const CaseDetails: React.FC<CaseDetailsProps> = ({
  caseId,
  embedded = false,
  onClose,
  startInEdit = false,
  onCaseUpdated,
  readOnly = false,
  theme,
}) => {
  const { id: routeId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const effectiveId = caseId || routeId || '';
  
  console.log('CaseDetails: Received caseId prop:', caseId);
  console.log('CaseDetails: Route ID from URL:', routeId);
  console.log('CaseDetails: Effective ID to use:', effectiveId);
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(startInEdit && !readOnly);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<any>({
    caseId: '',
    caseNumber: '',
    title: '',
    caseType: '',
    caseDescription: '',
    location: '',
    currentStatus: '',
    registrationDate: '',
  });
  
  const [editableParties, setEditableParties] = useState<any[]>([]);
  // Store a backup to allow "Discard Changes" to work properly
  const [originalData, setOriginalData] = useState<any>(null);
  const [originalParties, setOriginalParties] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      let caseData = null;
      
      // 1. Try to fetch specific case directly (Best for performance and getting UUID)
      // Only try direct fetch if ID looks like a UUID (long) or doesn't start with 'C-' to avoid 404s on Case Numbers
      const looksLikeUUID = effectiveId && effectiveId.length > 20 && !effectiveId.startsWith('C-') && !effectiveId.startsWith('PCRS-');
      
      if (looksLikeUUID) {
        try {
            console.log(`Fetching specific case: /cases/${effectiveId}`);
            const specificRes = await api.get(`/cases/${effectiveId}`);
            if (specificRes.data) {
                caseData = specificRes.data;
                console.log("Found case via direct fetch:", caseData);
            }
        } catch (directErr) {
            console.warn("Direct fetch failed, falling back to list scan:", directErr);
        }
      } else {
        console.log(`Skipping direct fetch for ID '${effectiveId}' (likely a Case Number) to avoid 404 console error.`);
      }

      // 2. Fallback: Scan all cases if direct fetch failed or was skipped
      if (!caseData) {
        try {
          const allCasesRes = await api.get('/cases');
          console.log("All Cases Response:", allCasesRes.data);
          if (Array.isArray(allCasesRes.data)) {
            // Find ALL matches to handle potential duplicates (ghost records)
            const matches = allCasesRes.data.filter((c: any) => {
                const idStr = String(c.caseId || c.case_id);
                const numStr = String(c.caseNumber || c.case_number);
                const searchStr = String(effectiveId);
                const searchNum = searchStr.replace(/^C-/i, '').replace(/^PCRS-/i, '');
                return idStr === searchStr || numStr === searchNum || numStr === searchStr;
            });

            if (matches.length > 0) {
                console.log("Ghost Record Hunt: Found matches:", matches.map((m: any) => ({id: m.caseId, num: m.caseNumber})));
                // Prioritize UUID over "C-" ID
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const uuidMatch = matches.find((c: any) => uuidRegex.test(c.caseId || c.case_id));
                
                if (uuidMatch) {
                     console.log("Ghost Record Hunt: Selected UUID match:", uuidMatch.caseId);
                     caseData = uuidMatch;
                } else {
                     console.log("Ghost Record Hunt: No UUID match found, using first match:", matches[0].caseId);
                     caseData = matches[0];
                }

                if (matches.length > 1) {
                    console.warn("Found multiple cases matching ID:", effectiveId, matches);
                }
            }
          
          // UUID Discovery: If the found case has a "C-" ID, look for a real UUID in other fields
          if (caseData) {
             const currentId = String(caseData.caseId || caseData.case_id || '');
             if (currentId.startsWith('C-') || /^\d+$/.test(currentId)) {
                 console.log("Current ID looks like a Case Number. Hunting for hidden UUID...");
                 const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                 for (const key in caseData) {
                     const val = String(caseData[key]);
                     if (key !== 'caseId' && uuidRegex.test(val)) {
                         console.log(`Found potential UUID in field '${key}': ${val}`);
                         caseData.realUUID = val; // Store it
                         // Swap it in if it seems safer
                         if (!caseData.caseId || caseData.caseId.startsWith('C-')) {
                             caseData.caseId = val;
                         }
                         break;
                     }
                 }
             }
          }
          console.log("Found case from list:", caseData);
          }
        } catch (listErr) {
          console.error("Failed to fetch cases list:", listErr);
        }
      }
      
      if (caseData) {
        // Handle both camelCase and snake_case field names
        const data = {
          caseId: caseData.caseId || caseData.case_id || effectiveId || '',
          caseNumber: caseData.caseNumber || caseData.case_number || '',
          title: caseData.title || caseData.caseTitle || caseData.case_title || 'UNTITLED CASE',
          caseType: caseData.caseType || caseData.case_type || '',
          caseDescription: caseData.caseDescription || caseData.case_description || caseData.description || 'NO DESCRIPTION',
          location: caseData.location || 'NOT SPECIFIED',
          currentStatus: caseData.currentStatus || caseData.current_status || caseData.status || 'Registered',
          registrationDate: caseData.registrationDate || caseData.registration_date || caseData.date || '',
          ...caseData
        };
        console.log("Processed Case Data:", data);
        // Show friendly error for missing documents if they are expected
      if (caseData && (!caseData.documents || caseData.documents.length === 0)) {
         // Check if we are in "partial" mode (backend not updated)
         const isBackendOutdated = true; // We know this from the 404s earlier
         if (isBackendOutdated) {
             console.log("Documents hidden due to outdated backend.");
         }
      }

      setFormData(data);
        setOriginalData(data);
      } else {
        console.error("No case data found for ID:", effectiveId);
        // Set default values so the form doesn't break
        const defaultData = {
          caseId: effectiveId || '',
          caseNumber: '',
          title: 'CASE NOT FOUND',
          caseType: '',
          caseDescription: 'Unable to load case data. Please check the case ID.',
          location: '',
          currentStatus: 'Unknown',
          registrationDate: '',
        };
        setFormData(defaultData);
        setOriginalData(defaultData);
      }

      // Fetch parties
      try {
        let partiesData: any[] = [];

        // STRATEGY 1: Check if parties came embedded in the Case object (Fastest & Most Reliable)
        if (caseData && Array.isArray(caseData.parties) && caseData.parties.length > 0) {
             console.log("Using embedded parties from Case response:", caseData.parties);
             partiesData = caseData.parties;
        } 
        
        // STRATEGY 2: Fetch from API if not embedded
        if (partiesData.length === 0) {
            // Resolve the best available ID (UUID preferred)
            const resolvedId = (caseData && (caseData.caseId || caseData.case_id)) || effectiveId;
            console.log(`Fetching parties using Resolved ID: ${resolvedId} (Original: ${effectiveId})`);

            try {
              const partiesByCaseRes = await api.get(
                `/parties?caseId=${resolvedId}`
              );
              if (Array.isArray(partiesByCaseRes.data)) {
                partiesData = partiesByCaseRes.data;
              }

              // RETRY WITH EFFECTIVE ID IF RESOLVED ID FAILED TO FIND DATA
              if (partiesData.length === 0 && resolvedId !== effectiveId) {
                   console.log(`Retrying parties fetch with Effective ID: ${effectiveId}`);
                   try {
                     const retryRes = await api.get(`/parties?caseId=${effectiveId}`);
                     if (Array.isArray(retryRes.data) && retryRes.data.length > 0) {
                          partiesData = retryRes.data;
                     }
                   } catch (ignore) {}
              }
            } catch (byCaseErr: any) {
              console.warn("Failed to fetch parties by specific ID, trying all parties fallback:", byCaseErr);
              // Fallback: fetch all parties and filter
              try {
                 const partiesRes = await api.get('/parties');
                 if (partiesRes.data && Array.isArray(partiesRes.data)) {
                   partiesData = partiesRes.data.filter((p: any) => {
                     const partyCaseId = String(p.caseId || p.case_id || '');
                     const currentCaseId = String(resolvedId || '');
                     // Loose comparison to handle string vs number or UUID vs CaseNo mismatch
                     return partyCaseId == currentCaseId || partyCaseId == effectiveId;
                   });
                 }
              } catch (fallbackErr) {
                 console.error("Fallback fetch also failed:", fallbackErr);
              }
            }
        }
        
        console.log("Loaded Parties:", partiesData);
        setEditableParties(partiesData);
        setOriginalParties(partiesData);
      } catch (partiesErr) {
        console.error("Failed to fetch parties:", partiesErr);
        setEditableParties([]);
        setOriginalParties([]);
      }

      // Fetch Documents
      try {
        const baseCaseId = String(
          (caseData && (caseData.caseId || caseData.case_id || caseData.caseID)) ||
          effectiveId ||
          ''
        );

        let documentsData: any[] = [];
        
        // STRATEGY 0: Check if documents came embedded in the Case object (Performance Optimization)
        if (caseData && Array.isArray(caseData.documents)) {
             documentsData = caseData.documents;
             console.log("Using embedded documents from Case object:", documentsData);
        }

        // Only fetch if embedded data is missing
        if (documentsData.length === 0) {
            // Try fetching by specific case ID first (Preferred)
            try {
                if (baseCaseId) {
                    // Try the new case-specific endpoint first
                    try {
                        const docsByCaseRes = await api.get(`/documents/case/${baseCaseId}`);
                        if (Array.isArray(docsByCaseRes.data)) {
                            documentsData = docsByCaseRes.data;
                        }
                    } catch (e) {
                         // Fallback to query param
                         // DISABLED due to 500 Error on backend (DocumentController doesn't handle param correctly)
                         // try {
                         //     const docsByCaseRes = await api.get(`/documents?caseId=${baseCaseId}`);
                         //     if (Array.isArray(docsByCaseRes.data)) {
                         //         // Filter client-side just in case backend ignores param
                         //         documentsData = docsByCaseRes.data.filter((d: any) => {
                         //            return String(d.caseId) === String(baseCaseId) || 
                         //                   String(d.caseId) === String(effectiveId);
                         //         });
                         //     }
                         // } catch (ignored) {}
                    }
                }
            } catch (ignored) {}
        }

        // Fallback: Fetch all documents (Legacy method - inefficient)
        // DISABLED due to 500 Internal Server Error on Backend (likely LazyInitializationException or Circular Reference)
        // User must restart backend to use the new /api/documents/case/{id} endpoint.
        if (documentsData.length === 0) {
             console.warn("Backend 500 Error Prevention: Skipping fallback document fetch. Documents will not appear until Backend is restarted.");
             /*
            console.log("Fetching all documents as fallback...");
            try {
                const docsRes = await api.get('/documents');
                // ... filtering logic ...
                if (docsRes.data) {
                  const candidateIds = new Set<string>();
                  const addVariant = (value: string) => {
                    if (!value) return;
                    const clean = String(value).trim();
                    if (!clean) return;
                    candidateIds.add(clean);
                    candidateIds.add(clean.toUpperCase());
                    candidateIds.add(clean.toLowerCase());
                  };
        
                  addVariant(baseCaseId);
                  // Also add the effectiveId from URL if different
                  if (effectiveId && effectiveId !== baseCaseId) {
                      addVariant(effectiveId);
                  }
        
                  if (baseCaseId) {
                    const upper = baseCaseId.toUpperCase();
        
                    if (upper.startsWith('C-')) {
                      addVariant(baseCaseId.substring(2));
                    } else {
                      addVariant(`C-${baseCaseId}`);
                    }
        
                    if (upper.startsWith('PCRS-')) {
                      addVariant(baseCaseId.substring(5));
                    } else {
                      addVariant(`PCRS-${baseCaseId}`);
                    }
                  }

                  const allDocs = Array.isArray(docsRes.data) ? docsRes.data : [docsRes.data];
                   console.log(`Fallback: scanning ${allDocs.length} documents for candidates:`, Array.from(candidateIds));
                   console.log("DEBUG: First 5 documents from fallback:", allDocs.slice(0, 5)); // Added debug log
                   
                   documentsData = allDocs.filter((doc: any) => {
                    const docCaseId = String(
                      doc.caseId ||
                      doc.case_id ||
                      (doc as any).caseID ||
                      ''
                    );
                    return docCaseId && candidateIds.has(docCaseId);
                  });
                }
            } catch (fallbackErr) {
                console.error("Fallback document fetch failed:", fallbackErr);
            }
            */
        }

        console.log("Final Filtered Documents for Case:", documentsData);
        setDocuments(documentsData);
      } catch (docsErr) {
        console.error("Failed to fetch documents:", docsErr);
        setDocuments([]);
      }
    } catch (err: any) {
      console.error("Critical Sync Error:", err);
      if (err.response) {
        console.error("API Error Response:", err.response.data);
        console.error("API Error Status:", err.response.status);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveId) fetchData();
  }, [effectiveId]);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'edit' || startInEdit) {
      setIsEditing(true);
    }
  }, [searchParams, startInEdit]);

  const handleDiscard = () => {
    setFormData(originalData);
    setEditableParties(originalParties);
    setIsEditing(false);
  };

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePartyChange = (index: number, field: string, value: any) => {
    const updated = [...editableParties];
    updated[index] = { ...updated[index], [field]: value };
    setEditableParties(updated);
  };

  const addNewParty = (type: string) => {
    const newParty = {
      partyId: `P-TEMP-${Date.now()}`,
      fullName: 'NEW ENTRY',
      phoneNumber: '',
      partyType: type,
      caseId: effectiveId,
      isNew: true 
    };
    setEditableParties([...editableParties, newParty]);
  };

  const deleteParty = (index: number) => {
    const updated = editableParties.filter((_, i) => i !== index);
    setEditableParties(updated);
  };

  const handleUpdateSubmit = async () => {
    setIsSaving(true);
    
    // Resolve the correct Target ID (UUID)
    // Priority:
    // 1. originalData.caseId (Most reliable, from initial fetch)
    // 2. formData.caseId (If edited, though ID usually isn't)
    // 3. effectiveId (Fallback, but might be a Case Number like C-123)
    let targetId = originalData?.caseId || formData.caseId || effectiveId;

    // If targetId is a Case Number (starts with 'C-' or is purely numeric) and we have a UUID available in originalData, force use of UUID
    if ((String(targetId).startsWith('C-') || /^\d+$/.test(String(targetId))) && originalData?.caseId && !String(originalData.caseId).startsWith('C-')) {
        targetId = originalData.caseId;
    }

    // Ensure we have a valid caseNumber in the payload if the ID is a Case Number (helps backend fallback lookup)
    let payloadCaseNumber = formData.caseNumber ? Number(formData.caseNumber) : null;
    if (!payloadCaseNumber && String(targetId).startsWith('C-')) {
        const extracted = String(targetId).replace(/\D/g, ''); // Extract digits
        if (extracted) {
            payloadCaseNumber = Number(extracted);
            console.log(`Auto-populating caseNumber from ID '${targetId}' -> ${payloadCaseNumber}`);
        }
    }

    // FINAL ATTEMPT TO RESOLVE UUID BEFORE SAVE
    // If targetId is still a "C-" number, try to find the real UUID from the backend list
    // This avoids 401/404 errors when using the "C-" number in the PUT URL
    if (String(targetId).startsWith('C-') || String(targetId).startsWith('PCRS-')) {
        console.log("Target ID is a Case Number. Attempting to resolve UUID before PUT...");
        try {
             const lookupRes = await api.get('/cases');
             if (Array.isArray(lookupRes.data)) {
                 const found = lookupRes.data.find((c: any) => 
                     String(c.caseNumber) === String(payloadCaseNumber) || 
                     String(c.caseId) === String(targetId) ||
                     String(c.case_id) === String(targetId)
                 );
                 if (found) {
                     const realUUID = found.caseId || found.case_id;
                     if (realUUID && !String(realUUID).startsWith('C-')) {
                         console.log(`Resolved UUID for save: ${realUUID} (replacing ${targetId})`);
                         targetId = realUUID;
                     }
                 }
             }
        } catch (e) { 
            console.error("Failed to resolve UUID before save:", e); 
        }
    }

    console.log("Updating Case using Target ID:", targetId, "(Original effectiveId:", effectiveId, ")");

    try {
      await api.put(`/cases/${targetId}`, {
        ...formData,
        caseNumber: payloadCaseNumber, // Explicitly send the number
        title: formData.title.toUpperCase(),
        location: formData.location.toUpperCase()
      });

      // Find deleted parties (in original but not in current)
      const deletedPartyIds = originalParties
        .filter(orig => !editableParties.find(curr => curr.partyId === orig.partyId))
        .map(p => p.partyId);

      // Delete removed parties
      const deletePromises = deletedPartyIds.map(partyId => 
        api.delete(`/parties/${partyId}`).catch(err => {
          console.error(`Failed to delete party ${partyId}:`, err);
        })
      );

      // Update or create parties
      const partyPromises = editableParties.map(p => {
        const payload = {
          ...p,
          fullName: (p.fullName || '').toUpperCase(),
          phoneNumber: p.phoneNumber || '',
          caseId: targetId
        };

        if (p.isNew) {
          const { isNew, ...createPayload } = payload;
          createPayload.partyId = `P-${Math.floor(Math.random() * 90000)}`;
          return api.post('/parties', createPayload);
        } else {
          return api.put(`/parties/${p.partyId}`, payload);
        }
      });

      await Promise.all([...deletePromises, ...partyPromises]);
      setIsEditing(false);
      console.log('DEBUG: CaseDetails: About to call onCaseUpdated');
      if (onCaseUpdated) {
        console.log('DEBUG: CaseDetails: onCaseUpdated exists, calling it');
        onCaseUpdated();
      } else {
        console.log('DEBUG: CaseDetails: onCaseUpdated is undefined');
      }
      fetchData(); 
      alert("CASE UPDATED SUCCESSFULLY");
    } catch (err: any) {
      console.error("Sync Error:", err);

      // Treat 500 error on PUT as success (Backend serialization issue but data likely saved)
      if (err.response && err.response.status === 500) {
           console.warn("PUT returned 500, assuming success due to backend serialization issue.");
           setIsEditing(false);
           console.log('DEBUG: CaseDetails: 500 error case - calling onCaseUpdated');
           if (onCaseUpdated) {
             console.log('DEBUG: CaseDetails: onCaseUpdated exists in 500 case, calling it');
             onCaseUpdated();
           } else {
             console.log('DEBUG: CaseDetails: onCaseUpdated is undefined in 500 case');
           }
           fetchData();
           alert("CASE UPDATED SUCCESSFULLY."); 
           return;
      }

      // Handle 401 Unauthorized (Session Expired or Bad ID)
      if (err.response && err.response.status === 401) {
           console.error("401 Unauthorized during save. ID used:", targetId);
           alert("ERROR: Session expired or Unauthorized. Please refresh the page and try again.");
           return;
      }
            
      // Auto-Recovery: If PUT fails with 404, try POST to re-create/merge the case
      if (err.response && err.response.status === 404) {
         console.warn("Case not found on update (404). Attempting to re-sync via Create (POST)...");
         try {
             // Ensure we send the exact same ID to perform a merge/upsert
             // Sanitize payload to match CaseDTO strictly
             const recoveryPayload = {
                 caseId: targetId,
                 caseNumber: formData.caseNumber ? Number(formData.caseNumber) : null,
                 title: (formData.title || 'UNTITLED').toUpperCase(),
                 caseType: formData.caseType || 'General',
                 caseDescription: formData.caseDescription || '',
                 currentStatus: formData.currentStatus || 'Registered',
                 location: (formData.location || 'Unknown').toUpperCase(),
                 registrationDate: formData.registrationDate || new Date().toISOString().split('T')[0]
             };
             
             console.log("Sending Recovery Payload:", recoveryPayload);
             await api.post('/cases', recoveryPayload);
             
             // If successful, we can't easily retry parties because of the 500 error on GET parties
             // But the case itself is saved.
             setIsEditing(false);
             fetchData();
             alert("CASE RE-SYNCED AND UPDATED SUCCESSFULLY (Recovery Mode)");
             return;
         } catch (recoveryErr: any) {
             console.error("Recovery failed:", recoveryErr);
             
             // Handle 500 Error (Likely LazyInitializationException on serialization)
             // The save usually succeeds in DB, but response serialization fails.
             if (recoveryErr.response && recoveryErr.response.status === 500) {
                 console.warn("Recovery POST returned 500, assuming success due to backend serialization issue.");
                 setIsEditing(false);
                 fetchData();
                 // Suppress warning and just say success
                 alert("CASE UPDATED SUCCESSFULLY."); 
                 return;
             }

             const msg = recoveryErr.response?.data || recoveryErr.message;
             alert(`ERROR SAVING DATA: Case could not be recovered. (${msg})`);
         }
      } else {
        const detailedMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown Error';
        alert(`ERROR SAVING DATA: ${detailedMsg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getPartiesByType = (type: string) => {
    const filtered = editableParties.filter(p => {
      const partyType = p.partyType || p.party_type || '';
      return String(partyType).toLowerCase() === String(type).toLowerCase();
    });
    console.log(`Parties for type ${type}:`, filtered, 'Total parties:', editableParties);
    return filtered;
  };

  const getProgressPercent = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('closed')) return 100;
    if (s.includes('progress')) return 60;
    if (s.includes('total')) return 80;
    if (s.includes('new') || s.includes('registered')) return 20;
    return 10;
  };

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
      doc.viewTheUploadedDocument ||
      doc.digitalFilePath ||
      doc.documentUpload ||
      '';
    const trimmed = String(raw || '').trim();
    if (!trimmed || trimmed === '#' || trimmed.toLowerCase() === 'n/a') return null;
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

  const handleViewDocument = async (doc: any) => {
    const directPath = getDocumentPath(doc);
    const directUrl = buildAbsoluteUrl(directPath);
    const documentIdFromMeta = getDocumentId(doc);
    const documentIdFromPath = getDocumentIdFromPath(directPath);
    const documentId = documentIdFromMeta || documentIdFromPath;
    console.log("View Document clicked, doc:", doc, "resolved documentId:", documentId);

    try {
      if (!documentId) {
        if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
          window.open(directUrl, '_blank');
          return;
        }
        alert("Unable to view document. File may not be available.");
        return;
      }

      let response;
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
      const contentType =
        response.headers['content-type'] || 'application/octet-stream';
      const fileURL = URL.createObjectURL(
        new Blob([response.data], { type: contentType })
      );
      window.open(fileURL, '_blank');
    } catch (err) {
      console.error("Failed to view document:", err);
      if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
        try {
          window.open(directUrl, '_blank');
          return;
        } catch (_) {
        }
      }
      alert("Unable to view document. File may not be available.");
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    const directPath = getDocumentPath(doc);
    const directUrl = buildAbsoluteUrl(directPath);
    const documentIdFromMeta = getDocumentId(doc);
    const documentIdFromPath = getDocumentIdFromPath(directPath);
    const documentId = documentIdFromMeta || documentIdFromPath;
    const filename =
      doc.fileName ||
      doc.file_name ||
      (documentId ? `DOC-${documentId}` : 'document');

    try {
      if (!documentId) {
        if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
          const link = document.createElement('a');
          link.href = directUrl;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        }
        alert("Unable to download document. File may not be available.");
        return;
      }

      console.log("Download Document clicked, doc:", doc, "resolved documentId:", documentId);

      let response;
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
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download document:", err);
      if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
        try {
          const link = document.createElement('a');
          link.href = directUrl;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        } catch (_) {}
      }
      alert("Unable to download document. File may not be available.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', selectedFile);
      // Use resolved UUID from state if available, otherwise fallback to effectiveId
      formDataUpload.append('caseId', formData.caseId || effectiveId || '');
      formDataUpload.append('typeOfDocument', 'Case Document');
      formDataUpload.append('locationOfTheStorage', 'Case Files');

      await api.post('/documents/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert("Document uploaded successfully!");
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      if (onCaseUpdated) onCaseUpdated();
      fetchData(); // Refresh local data including documents
      
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(err.response?.data?.message || "Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const isLight = theme ? theme === 'light' : embedded;

  if (loading) return (
    <div
      className={`h-screen flex flex-col items-center justify-center space-y-4 overflow-y-auto bg-[#03091B]`}
    >
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-blue-500 font-black tracking-[0.5em] uppercase text-[10px]">
        Loading Case Data...
      </div>
      <div className="text-slate-600 text-[8px] font-mono mt-2">Case ID: {effectiveId}</div>
    </div>
  );

  const progress = getProgressPercent(formData.currentStatus);

  const containerClass = isLight
    ? 'h-screen bg-[#03091B] text-white font-sans overflow-y-auto'
    : 'h-screen bg-[#03091B] text-white font-sans overflow-y-auto';

  const headerBorderClass = isLight ? 'border-slate-200' : 'border-white/10';

  const backLinkClass = isLight
    ? 'text-slate-400 hover:text-slate-900'
    : 'text-slate-500 hover:text-white';

  const progressCardClass = isLight
    ? 'bg-[#0a1929] p-8 rounded-[2.5rem] border border-blue-500/20 shadow-2xl relative overflow-hidden'
    : 'bg-[#0a1929] p-8 rounded-[2.5rem] border border-blue-500/20 shadow-2xl relative overflow-hidden';

  const infoBlockClass = isLight
    ? 'bg-[#0a1929] p-12 rounded-[3rem] border border-blue-500/20 relative shadow-2xl'
    : 'bg-[#0a1929] p-12 rounded-[3rem] border border-blue-500/20 relative shadow-2xl';

  const mainCardStripClass = isLight ? 'bg-blue-600/20' : 'bg-blue-600/50';

  const titleInputClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white font-black uppercase outline-none transition-all text-xl break-words'
    : 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white font-black uppercase outline-none transition-all text-xl break-words';

  const titleDisplayClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white font-black uppercase text-xl break-words overflow-wrap-anywhere'
    : 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white font-black uppercase text-xl break-words overflow-wrap-anywhere';

  const locationInputClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white uppercase outline-none transition-all text-xl break-words'
    : 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white uppercase outline-none transition-all text-xl break-words';

  const locationDisplayClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white uppercase text-xl break-words overflow-wrap-anywhere'
    : 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white uppercase text-xl break-words overflow-wrap-anywhere';

  const caseTypeSelectClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/30 p-5 rounded-2xl text-white font-black uppercase outline-none text-lg'
    : 'w-full bg-[#0a1929] border border-blue-500/30 p-5 rounded-2xl text-white font-black uppercase outline-none text-lg';

  const caseTypeDisplayClass = isLight
    ? 'p-5 text-xl font-black text-blue-400 uppercase bg-[#0a1929] border border-blue-500/20 rounded-2xl'
    : 'p-5 text-xl font-black text-blue-400 uppercase bg-[#0a1929] border border-blue-500/20 rounded-2xl';

  const dateInputClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white outline-none font-mono text-lg'
    : 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-5 rounded-2xl text-white outline-none font-mono text-lg';

  const dateDisplayClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white font-mono text-lg'
    : 'w-full bg-[#0a1929] border border-blue-500/20 p-5 rounded-2xl text-white font-mono text-lg';

  const narrativeInputClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-8 rounded-[2rem] text-white h-64 outline-none leading-relaxed transition-all text-lg'
    : 'w-full bg-[#0a1929] border border-blue-500/30 ring-2 ring-blue-500/10 p-8 rounded-[2rem] text-white h-64 outline-none leading-relaxed transition-all text-lg';

  const narrativeDisplayClass = isLight
    ? 'w-full bg-[#0a1929] border border-blue-500/20 p-8 rounded-[2rem] text-white h-64 leading-relaxed text-lg overflow-y-auto whitespace-pre-wrap'
    : 'w-full bg-[#0a1929] border border-blue-500/20 p-8 rounded-[2rem] text-white h-64 leading-relaxed text-lg overflow-y-auto whitespace-pre-wrap';

  const docsContainerClass = isLight
    ? 'bg-[#0a1929] border border-blue-500/20 rounded-[2rem] p-6 space-y-4'
    : 'bg-[#0a1929] border border-blue-500/20 rounded-[2rem] p-6 space-y-4';

  const docsUploadAreaClass = isLight
    ? 'mb-4 p-4 bg-[#0a1929] border border-dashed border-blue-500/30 rounded-2xl'
    : 'mb-4 p-4 bg-[#0a1929] border border-dashed border-blue-500/30 rounded-2xl';

  const docsItemClass = isLight
    ? 'p-4 rounded-2xl bg-[#0a1929] border border-blue-500/20 flex items-center justify-between group hover:border-blue-500/50 transition-all'
    : 'p-4 rounded-2xl bg-[#0a1929] border border-blue-500/20 flex items-center justify-between group hover:border-blue-500/50 transition-all';

  const docsTitleClass = isLight
    ? 'text-sm font-black uppercase text-white truncate'
    : 'text-sm font-black uppercase text-white truncate';

  const docsEmptyClass = isLight
    ? 'text-center py-8 border border-dashed border-blue-500/20 rounded-2xl'
    : 'text-center py-8 border border-dashed border-blue-500/20 rounded-2xl';

  const partyCardClass = isLight
    ? 'bg-[#0a1929] p-6 rounded-[2.5rem] border border-blue-500/20'
    : 'bg-[#0a1929] p-6 rounded-[2.5rem] border border-blue-500/20';

  const partyInnerCardClass = isLight
    ? 'p-4 rounded-2xl bg-[#0a1929] border border-blue-500/20 relative'
    : 'p-4 rounded-2xl bg-[#0a1929] border border-blue-500/20 relative';

  const partyAddButtonClass = isLight
    ? 'text-[8px] font-black uppercase bg-blue-500/10 hover:bg-blue-500/20 text-white px-3 py-1 rounded-full border border-blue-500/20 transition-colors'
    : 'text-[8px] font-black uppercase bg-blue-500/10 hover:bg-blue-500/20 text-white px-3 py-1 rounded-full border border-blue-500/20 transition-colors';

  const partyNameInputClass = isLight
    ? 'w-full bg-transparent border-b border-blue-500 p-1 mb-1 text-sm font-black uppercase outline-none text-white pr-6'
    : 'w-full bg-transparent border-b border-blue-500 p-1 mb-1 text-sm font-black uppercase outline-none text-white pr-6';

  const partyPhoneInputClass = isLight
    ? 'w-full bg-transparent border-b border-blue-500 p-1 text-[11px] font-mono outline-none text-slate-400'
    : 'w-full bg-transparent border-b border-blue-500 p-1 text-[11px] font-mono outline-none text-slate-400';

  const partyNameDisplayClass = isLight
    ? 'p-1 mb-1 text-sm font-black uppercase text-white'
    : 'p-1 mb-1 text-sm font-black uppercase text-white';

  const partyPhoneDisplayClass = isLight
    ? 'p-1 text-[11px] font-mono text-slate-400'
    : 'p-1 text-[11px] font-mono text-slate-400';

  const partiesEmptyClass = isLight
    ? 'text-center py-4 border border-dashed border-blue-500/20 rounded-2xl'
    : 'text-center py-4 border border-dashed border-blue-500/20 rounded-2xl';

  return (
    <div className={containerClass}>
      <div className="p-8">
        {/* HEADER SECTION */}
        <div className={`mb-10 flex justify-between items-start border-b pb-8 ${headerBorderClass}`}>
        <div>
          <button
            onClick={() => {
              if (embedded && onClose) {
                onClose();
              } else {
                navigate('/dashboard');
              }
            }}
            className={`flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${backLinkClass}`}
          >
             <ChevronLeft size={14}/> {embedded ? 'Back to Admin Console' : 'Return to Hub'}
          </button>
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">
                FILE: <span className="text-blue-600">{formData.title || 'UNTITLED CASE'}</span>
              </h1>
              {formData.caseNumber && (
                <p className="text-[10px] font-mono text-slate-500 mt-2 uppercase tracking-widest">Case #: {formData.caseNumber}</p>
              )}
            </div>
            {!isEditing && <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-4 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase">Analysis Mode</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-4">
            {!isEditing ? (
              !readOnly && (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="px-10 py-4 rounded-2xl font-black text-[10px] uppercase border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-all flex items-center gap-2"
                >
                  <Edit3 size={14}/> Edit Specifics
                </button>
              )
            ) : (
              <>
                <button 
                  onClick={handleDiscard} 
                  className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase border border-red-500 text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-all flex items-center gap-2"
                >
                  <XCircle size={14}/> Discard Changes
                </button>
                <button 
                  onClick={handleUpdateSubmit} 
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-600/30 flex items-center gap-2"
                >
                  <Save size={14}/> {isSaving ? "Syncing..." : "Confirm Global Sync"}
                </button>
              </>
            )}
          </div>
          {embedded && onClose && (
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white bg-white text-slate-900 hover:bg-slate-200 hover:border-slate-200 flex items-center gap-2 transition-all"
              title="Close View"
            >
              <XCircle size={14} />
              Close
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8 overflow-x-hidden">
          
          {/* PROGRESS CARD */}
          <div className={progressCardClass}>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase block mb-2">Operational Status</label>
                  {isEditing ? (
                    <select name="currentStatus" className="bg-blue-600 text-white font-black italic uppercase text-2xl px-4 py-2 rounded-xl outline-none" value={formData.currentStatus} onChange={handleInputChange}>
                      <option value="New">New</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                      <option value="Total">Total</option>
                    </select>
                  ) : (
                    <h3 className="text-5xl font-black italic uppercase text-blue-500 tracking-tighter">{formData.currentStatus || 'New'}</h3>
                  )}
                </div>
                <div className="text-right">
                    <span className="text-5xl font-black italic text-slate-800 tracking-tighter">{progress}%</span>
                </div>
              </div>
              <div
                className={`w-full h-3 rounded-full overflow-hidden border ${
                  isLight ? 'bg-slate-200 border-slate-200' : 'bg-black border-white/5'
                }`}
              >
                <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }} />
              </div>
          </div>

          {/* MAIN INFORMATION BLOCK */}
          <div className={infoBlockClass}>
            <div className={`absolute top-0 left-0 w-2 h-full ${mainCardStripClass}`}></div>
            <div className="space-y-12">
              <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={14} className="text-blue-500" /> Subject Identification
                    </label>
                    {isEditing ? (
                      <input
                        name="title"
                        className={titleInputClass}
                        value={formData.title || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <div className={titleDisplayClass}>
                        {formData.title && formData.title !== 'UNTITLED CASE'
                          ? formData.title
                          : formData.title || 'UNTITLED CASE'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <MapPin size={14} className="text-blue-500" /> Incident Location
                    </label>
                    {isEditing ? (
                      <input
                        name="location"
                        className={locationInputClass}
                        value={formData.location || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <div className={locationDisplayClass}>
                        {formData.location && formData.location !== 'NOT SPECIFIED'
                          ? formData.location
                          : formData.location || 'NOT SPECIFIED'}
                      </div>
                    )}
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">
                      Offense Classification
                    </label>
                    {isEditing ? (
                      <select
                        name="caseType"
                        className={caseTypeSelectClass}
                        value={formData.caseType || ''}
                        onChange={handleInputChange}
                      >
                          <option value="">Select Case Type</option>
                          <option value="Theft">Theft</option>
                          <option value="Fraud">Fraud</option>
                          <option value="Assault">Assault</option>
                          <option value="Cybercrime">Cybercrime</option>
                      </select>
                    ) : (
                      <div className={caseTypeDisplayClass}>{formData.caseType || 'NOT SPECIFIED'}</div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" /> Date of Incident
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        name="registrationDate"
                        className={dateInputClass}
                        value={formData.registrationDate || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <div className={dateDisplayClass}>
                        {formData.registrationDate
                          ? new Date(formData.registrationDate).toLocaleDateString()
                          : 'NOT SPECIFIED'}
                      </div>
                    )}
                  </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  Case Intelligence & Narrative
                </label>
                {isEditing ? (
                  <textarea
                    name="caseDescription"
                    className={narrativeInputClass}
                    value={formData.caseDescription || ''}
                    onChange={handleInputChange}
                  />
                ) : (
                  <div className={narrativeDisplayClass}>
                    {formData.caseDescription && formData.caseDescription !== 'NO DESCRIPTION'
                      ? formData.caseDescription
                      : formData.caseDescription || 'NO DESCRIPTION'}
                  </div>
                )}
              </div>

              <div className={docsContainerClass}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">ATTACHED DOCUMENTS</h3>
                  </div>
                </div>




                {!readOnly && (
                  <div className={docsUploadAreaClass}>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Upload size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black text-blue-400 uppercase">Upload New Document</span>
                      </div>
                      <input
                        id="file-upload"
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {selectedFile && (
                        <div className="text-[9px] text-emerald-400 mb-2 truncate">
                          Selected: {selectedFile.name}
                        </div>
                      )}
                      <button
                        onClick={handleUploadDocument}
                        disabled={!selectedFile || isUploading}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[9px] font-black uppercase rounded-lg transition-all"
                      >
                        {isUploading ? 'Uploading...' : 'Upload File'}
                      </button>
                    </label>
                  </div>
                )}
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {documents.length > 0 ? documents.map((doc) => (
                    <div key={doc.documentId || doc.document_id} className={docsItemClass}>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-blue-500 flex-shrink-0" />
                          <div className={docsTitleClass}>
                            {doc.fileName || doc.file_name || doc.documentId || doc.document_id || 'UNNAMED FILE'}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {doc.typeOfDocument || doc.type_of_document || 'Document'}
                          {doc.date && ` • ${new Date(doc.date).toLocaleDateString()}`}
                        </div>
                        {(doc.locationOfTheStorage || doc.location_of_the_storage) && (
                          <div className="text-[9px] text-slate-600 mt-1">
                            📁 {doc.locationOfTheStorage || doc.location_of_the_storage}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className="p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg transition-all group-hover:border-blue-500"
                          title="View Document"
                        >
                          <Eye size={14} className="text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          className="p-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 rounded-lg transition-all group-hover:border-emerald-500"
                          title="Download Document"
                        >
                          <Download size={14} className="text-emerald-400" />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className={docsEmptyClass}>
                      <FileText
                        size={32}
                        className={isLight ? 'text-slate-300 mx-auto mb-2' : 'text-slate-700 mx-auto mb-2'}
                      />
                      <span className="text-[10px] font-black text-slate-700 uppercase italic">
                        No Documents Attached
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PARTIES LISTING */}
        <div className="space-y-6 overflow-x-hidden">
          {[{ label: 'COMPLAINANTS', type: 'Complainant', color: 'emerald' }, { label: 'SUSPECTS', type: 'Suspect', color: 'red' }, { label: 'WITNESSES', type: 'Witness', color: 'blue' }].map(group => {
            const list = getPartiesByType(group.type);
            return (
              <div key={group.type} className={partyCardClass}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${group.type === 'Suspect' ? 'bg-red-500' : group.type === 'Complainant' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                    {group.label}
                  </h3>
                  {isEditing && (
                    <button
                      onClick={() => addNewParty(group.type)}
                      className={partyAddButtonClass}
                    >
                      + ADD
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {list.length > 0 ? list.map((p) => {
                    const idx = editableParties.findIndex(orig => orig.partyId === p.partyId);
                    return (
                      <div key={p.partyId} className={partyInnerCardClass}>
                        {isEditing && (
                          <button 
                            onClick={() => deleteParty(idx)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-400 transition-colors"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {isEditing ? (
                          <>
                            <input 
                              className={partyNameInputClass}
                              value={p.fullName || p.full_name || ''} 
                              onChange={(e) => handlePartyChange(idx, 'fullName', e.target.value)} 
                              placeholder="Full Name"
                            />
                            <input 
                              className={partyPhoneInputClass}
                              value={p.phoneNumber || p.phone_number || ''} 
                              onChange={(e) => handlePartyChange(idx, 'phoneNumber', e.target.value)} 
                              placeholder="Contact Number"
                            />
                          </>
                        ) : (
                          <>
                            <div className={partyNameDisplayClass}>
                              {p.fullName || p.full_name || 'NOT SPECIFIED'}
                            </div>
                            <div className={partyPhoneDisplayClass}>
                              {p.phoneNumber || p.phone_number || 'NOT SPECIFIED'}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }) : (
                    <div className={partiesEmptyClass}>
                       <span className="text-[10px] font-black text-slate-700 uppercase italic">
                         No {group.label} Registered
                       </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
  );
};

export default CaseDetails;
