import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { jsPDF } from 'jspdf';
import CaseDetails from '@/pages/CaseDetails';
import { usePreferencesStore, t } from '@/stores/preferencesStore';

interface AssignedCase {
  assignmentId: number;
  caseId: string;
  userId: string;
}

interface EvidenceItem {
  evidenceId: string;
  caseId: string;
  type: string;
  description: string;
  collectedByUserId: string;
}

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

interface InvestigatorProps {
  onRefresh?: () => void;
  refreshTrigger?: number;
  deletedCases?: Set<string>;
}

const Investigator: React.FC<InvestigatorProps> = ({ onRefresh, refreshTrigger, deletedCases }) => {
  const { userInfo } = useAuthStore() as any;
  const { language, theme, toggleTheme, setLanguage } = usePreferencesStore();
  const isLight = theme === 'light';
  const themeLabel = theme === 'dark' ? t(language, 'brightMode') : t(language, 'darkMode');

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [allCases, setAllCases] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<AssignedCase[]>([]);
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [editingEvidence, setEditingEvidence] = useState<Record<string, { type: string; description: string }>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadingCases, setUploadingCases] = useState<Record<string, boolean>>({});
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [investigatorLogs, setInvestigatorLogs] = useState<any[]>([]);
  const [newLogDrafts, setNewLogDrafts] = useState<Record<string, string>>({});
  const [newEvidenceDrafts, setNewEvidenceDrafts] = useState<Record<string, { type: string; description: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const initRef = useRef(false);

  const username =
    userInfo?.username || userInfo?.preferred_username || '';

  const myIdentityTokens = useMemo(() => {
    const set = new Set<string>();
    const add = (v: any) => {
      const t = String(v || '').trim().toLowerCase();
      if (t) set.add(t);
    };
    add(currentUserId);
    add(userInfo?.sub);
    add(username);
    return set;
  }, [currentUserId, userInfo?.sub, username]);

  const isUserIdMatch = useCallback((raw: any) => {
    const val = String(raw || '').trim().toLowerCase();
    if (!val) return false;
    for (const mine of myIdentityTokens) {
      if (!mine) continue;
      if (val === mine) return true;
      if (val.includes(mine)) return true;
      if (mine.includes(val)) return true;
    }
    return false;
  }, [myIdentityTokens]);

  const isMineByCaseEntity = useCallback((c: any) => {
    const usernameLower = String(username || '').toLowerCase();
    const fullNameLower = String(userInfo?.name || '').toLowerCase();
    const subjectId = String(userInfo?.sub || '');
    const currentId = String(currentUserId || '');

    const directValues: any[] = [
      c.assignedInvestigatorId,
      (c as any).assigned_investigator_id,
      (c as any).assignedInvestigatorID,
      (c as any).investigatorId,
      (c as any).investigator_id,
      (c as any).userId,
      (c as any).user_id,
      (c as any).assignedTo,
      (c as any).assigned_to,
      (c as any).assignedToId,
      (c as any).assigned_to_id,
      (c as any).assignedInvestigatorUsername,
      (c as any).assignedInvestigatorName,
      c.assignedInvestigator?.userId,
      c.assignedInvestigator?.id,
      c.assignedInvestigator?.username,
      c.assignedInvestigator?.preferred_username,
      c.assignedInvestigator?.name,
      (c as any).assignedNames,
      (c as any).assigned_names,
    ];

    const flat: string[] = [];
    directValues.forEach(v => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) {
        v.forEach(x => {
          if (x === null || x === undefined) return;
          flat.push(String(x));
        });
        return;
      }
      flat.push(String(v));
    });

    for (const raw of flat) {
      const val = String(raw);
      const valLower = val.toLowerCase();

      if (currentId && val === currentId) return true;
      if (subjectId && val === subjectId) return true;
      if (usernameLower && valLower === usernameLower) return true;
      if (usernameLower && valLower.includes(usernameLower)) return true;
      if (fullNameLower && valLower === fullNameLower) return true;
      if (fullNameLower && valLower.includes(fullNameLower)) return true;
    }

    return false;
  }, [currentUserId, userInfo?.name, userInfo?.sub, username]);

  const loadData = async () => {
    console.debug('Investigator: loadData start');
    setLoading(true);
    const fallbackTimer = setTimeout(() => {
      // Silent fallback: ensure UI stays accessible even if network is slow
      setLoading(false);
    }, 8000);
    try {
      const [usersRes, casesRes, assignmentsRes, evidencesRes, logsRes] = await Promise.allSettled([
        api.get('/users').catch(err => {
          if (err.response?.status === 403) {
            console.warn('Investigator: 403 Forbidden on /users - using cached data');
            // Try to get cached users data
            try {
              const cachedUsers = localStorage.getItem('cached_users');
              if (cachedUsers) {
                return { data: JSON.parse(cachedUsers), status: 'fulfilled' };
              }
            } catch (e) {
              console.warn('Investigator: Failed to load cached users');
            }
            return { data: [], status: 'fulfilled' };
          }
          throw err;
        }),
        api.get('/cases').catch(err => {
          if (err.response?.status === 403) {
            console.warn('Investigator: 403 Forbidden on /cases - using cached data');
            try {
              const cachedCases = localStorage.getItem('cached_cases');
              if (cachedCases) {
                return { data: JSON.parse(cachedCases), status: 'fulfilled' };
              }
            } catch (e) {
              console.warn('Investigator: Failed to load cached cases');
            }
            return { data: [], status: 'fulfilled' };
          }
          throw err;
        }),
        api.get('/assignedcases').catch(err => {
          if (err.response?.status === 403) {
            console.warn('Investigator: 403 Forbidden on /assignedcases - using cached data');
            try {
              const cachedAssignments = localStorage.getItem('cached_assignments');
              if (cachedAssignments) {
                return { data: JSON.parse(cachedAssignments), status: 'fulfilled' };
              }
            } catch (e) {
              console.warn('Investigator: Failed to load cached assignments');
            }
            return { data: [], status: 'fulfilled' };
          }
          throw err;
        }),
        api.get('/evidences').catch(err => {
          if (err.response?.status === 403) {
            console.warn('Investigator: 403 Forbidden on /evidences - using empty array');
            return { data: [], status: 'fulfilled' };
          }
          throw err;
        }),
        api.get('/investigatorlogs').catch(err => {
          if (err.response?.status === 403) {
            console.warn('Investigator: 403 Forbidden on /investigatorlogs - using empty array');
            return { data: [], status: 'fulfilled' };
          }
          throw err;
        }),
      ]);

      const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.data) ? usersRes.value.data : [];
      
      // Cache successful users data for future use
      if (users.length > 0) {
        try {
          localStorage.setItem('cached_users', JSON.stringify(users));
        } catch (e) {
          console.warn('Investigator: Failed to cache users data');
        }
      }
      
      let allCases = casesRes.status === 'fulfilled' && Array.isArray(casesRes.value?.data) ? casesRes.value.data : [];
      if (!Array.isArray(allCases) || allCases.length === 0) {
        try {
          const cached = localStorage.getItem('cached_cases');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              console.log('Investigator: Loaded cases from offline cache:', parsed.length);
              allCases = parsed;
            }
          }
        } catch (e) {
          console.warn('Investigator: Failed to load cached cases');
        }
      }
      const allAssignments = assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value?.data) ? assignmentsRes.value.data : [];
      const allEvidences = evidencesRes.status === 'fulfilled' && Array.isArray(evidencesRes.value?.data) ? evidencesRes.value.data : [];
      const allLogs = logsRes.status === 'fulfilled' && Array.isArray(logsRes.value?.data) ? logsRes.value.data : [];
      // Documents will be fetched per-case to avoid 500 errors on global fetch


      const currentUser = users.find(
        (u: any) =>
          String(u.username || '').toLowerCase() === String(username).toLowerCase()
      );

      const usernameLower = String(username || '').toLowerCase();
      const fullNameLower = String(userInfo?.name || '').toLowerCase();
      const subjectId = String(userInfo?.sub || '');

      let resolvedUserId =
        currentUser?.userId || currentUser?.userID || null;

      if (!resolvedUserId && username) resolvedUserId = username;
      if (!resolvedUserId && subjectId) resolvedUserId = subjectId;
      setCurrentUserId(resolvedUserId);

      const identityCandidates = [
        resolvedUserId,
        subjectId,
        username,
        usernameLower,
      ]
        .filter(Boolean)
        .map(v => String(v));
      const identityCandidatesLower = new Set(
        identityCandidates.map(v => v.toLowerCase()),
      );

      // PENDING ASSIGNMENTS: Fetch from local storage to show immediate assignments from Supervisor
      let pendingAssignments: any[] = [];
      try {
          const rawPending = localStorage.getItem('supervisor_pending_assignments');
          if (rawPending) {
              const parsed = JSON.parse(rawPending);
              // Filter for assignments to ME that are recent (< 24h)
              pendingAssignments = parsed.filter((p: any) => {
                  const pUserId = String(p.userId || '');
                  const pUserName = String(p.userName || '').toLowerCase();
                  const idMatch =
                    identityCandidatesLower.has(pUserId.toLowerCase());
                  const nameMatch =
                    (usernameLower ? pUserName === usernameLower || pUserName.includes(usernameLower) : false) ||
                    (fullNameLower ? pUserName === fullNameLower || pUserName.includes(fullNameLower) : false);
                  const isRecent = (Date.now() - (p.timestamp || 0)) < 86400000;
                  return isRecent && (idMatch || nameMatch);
              });
              if (pendingAssignments.length > 0) {
                  console.log(`Investigator: Found ${pendingAssignments.length} pending assignments from local storage.`);
              }
          }
      } catch (e) { console.warn("Failed to load pending assignments", e); }

      // Merge backend assignments with pending ones
      // Prioritize pending (latest) by removing duplicates based on caseId
      const combinedAssignments = [...allAssignments];
      pendingAssignments.forEach(p => {
          const exists = combinedAssignments.some(a => 
              String(a.caseId || a.case_id).toLowerCase() === String(p.caseId).toLowerCase()
          );
          if (!exists) {
              combinedAssignments.push(p);
          }
      });

      const myAssignments = combinedAssignments.filter((a: any) => {
        const uId = a.userId || a.user_id || a.investigatorId;
        const uName =
          a.userName ||
          a.username ||
          a.user ||
          a.investigatorUsername ||
          a.investigatorName ||
          a.fullName;

        const idMatch =
          (uId ? identityCandidatesLower.has(String(uId).toLowerCase()) : false);

        const assignmentNameLower = String(uName || '').toLowerCase();
        const nameMatch =
          (usernameLower
            ? assignmentNameLower === usernameLower ||
              assignmentNameLower.includes(usernameLower)
            : false) ||
          (fullNameLower
            ? assignmentNameLower === fullNameLower ||
              assignmentNameLower.includes(fullNameLower)
            : false);

        return idMatch || nameMatch;
      });

      const caseIds = new Set<string>();
      myAssignments.forEach((a: any) => {
          const cid = String(a.caseId || a.case_id);
          if (cid && cid !== 'null' && cid !== 'undefined') {
              caseIds.add(cid.toLowerCase());
              // Add variations to ensure matching works regardless of format
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
              if (!isUuid) {
                  const numericMatch = cid.match(/(\d+)/);
                  if (numericMatch) {
                      caseIds.add(numericMatch[1]); // "123"
                      caseIds.add(`c-${numericMatch[1]}`); // "c-123"
                  }
              }
          }
      });
      
      // ORPHAN RECOVERY: Fetch assigned cases that are missing from the list
      const existingIds = new Set(allCases.map((c: any) => String(c.caseId).toLowerCase()));
      const missingIds = Array.from(caseIds).filter(id => {
          if (!id) return false;
          const strId = String(id);
          if (strId === 'null' || strId === 'undefined') return false;
          return !existingIds.has(id);
      });

      if (missingIds.length > 0) {
          console.log(`Investigator: Recovering ${missingIds.length} missing assigned cases...`);
          const recoveredResults = await Promise.allSettled(
              missingIds.map(async (id) => {
                  try {
                      const res = await api.get(`/cases/${id}`);
                      return res.data;
                  } catch (e) {
                      // Fallback placeholder for investigator
                      return {
                          caseId: id,
                          title: `Case ${String(id).substring(0,8)}...`,
                          currentStatus: 'Assigned (Details Unavailable)',
                          description: 'You are assigned to this case but details could not be loaded.',
                          isPlaceholder: true,
                          uuid: id,
                          id: id
                      };
                  }
              })
          );
          const recoveredCases = recoveredResults
              .filter(r => r.status === 'fulfilled' && r.value)
              .map((r: any) => r.value)
              .filter(c => c && (c.caseId || c.id));
          
          if (recoveredCases.length > 0) {
               // Add recovered cases to allCases list so they can be filtered below
               allCases.push(...recoveredCases);
          }
      }
      
      
      // Deduplicate cases to prevent duplicates in the list (matches App.tsx/Supervisor.tsx logic)
      const uniqueCases = allCases.reduce((acc: any[], current: any) => {
          const currentId = current.caseId;
          let currentNum = current.caseNumber || (current as any).case_number;
          if (!currentNum && typeof currentId === 'string' && currentId.startsWith('C-')) {
               currentNum = currentId.replace('C-', '');
          }
          
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const isReal = uuidRegex.test(currentId);
          
          const existingIndex = acc.findIndex(item => {
             const itemId = item.caseId;
             let itemNum = item.caseNumber || (item as any).case_number;
             if (!itemNum && typeof itemId === 'string' && itemId.startsWith('C-')) {
                 itemNum = itemId.replace('C-', '');
             }

             if (itemId === currentId) return true;
             
             // STRICTER DEDUPLICATION: Only merge if IDs match or we have a very strong link.
             // We removed loose number matching to prevent hiding distinct cases.
             // Only merge if one is C-ID and the other is UUID and they share the SAME number.
             if (currentNum && itemNum && String(currentNum) === String(itemNum)) {
                  const isCurrentUuid = uuidRegex.test(currentId);
                  const isItemUuid = uuidRegex.test(itemId);
                  // Only merge if they are different types (one legacy, one UUID) 
                  if (isCurrentUuid !== isItemUuid) return true;
             }
             
             // Cross-check C- ID with Number (Strict Match)
             if (currentId === `C-${itemNum}`) return true;
             if (itemId === `C-${currentNum}`) return true;

             return false;
          });
          
          if (existingIndex > -1) {
              const existing = acc[existingIndex];
              const existingIsReal = uuidRegex.test(existing.caseId);
              if (isReal && !existingIsReal) {
                  // MERGE STRATEGY: Replace legacy with UUID, but PRESERVE all legacy properties
                  const merged = { ...existing, ...current }; // current (UUID) overwrites, but existing keeps unique props
                  
                  // Ensure case_number is preserved if only present in one
                  if (!merged.caseNumber && existing.caseNumber) merged.caseNumber = existing.caseNumber;
                  if (!merged.case_number && (existing as any).case_number) (merged as any).case_number = (existing as any).case_number;

                  acc[existingIndex] = merged;
              } else if (!isReal && existingIsReal) {
                   // Existing is real, current is C-. Update existing with C- props
                   const merged = { ...current, ...existing }; // existing (UUID) stays dominant
                   
                   if (!merged.caseNumber && current.caseNumber) merged.caseNumber = current.caseNumber;
                   if (!merged.case_number && (current as any).case_number) (merged as any).case_number = (current as any).case_number;
                   
                   acc[existingIndex] = merged;
              }
          } else {
              acc.push(current);
          }
          return acc;
        }, []);

      // EXPANDED MATCHING: Bridge the gap between UUID assignments and C-Number cases
      const uuidToNumber = new Map<string, string>();
      uniqueCases.forEach(c => {
          const u = String(c.caseId || c.uuid || c.id || '').toLowerCase();
          let n = c.caseNumber || (c as any).case_number;
          if (!n && typeof c.caseId === 'string' && c.caseId.startsWith('C-')) {
              n = c.caseId.replace('C-', '');
          }
          if (u && n && /^[0-9a-f]{8}-/i.test(u)) {
              uuidToNumber.set(u, String(n));
          }
      });
      
      // Add numeric aliases to caseIds for any UUIDs in the assigned list
      const extraIds = new Set<string>();
      caseIds.forEach(id => {
          const lowerId = String(id).toLowerCase();
          if (/^[0-9a-f]{8}-/i.test(lowerId)) {
              const mappedNum = uuidToNumber.get(lowerId);
              if (mappedNum) {
                  extraIds.add(mappedNum);
                  extraIds.add(`c-${mappedNum}`);
              }
          }
      });
      extraIds.forEach(id => caseIds.add(id));

      const myCases = uniqueCases.filter((c: any) => {
          // Gather ALL possible IDs for this case
          const candidates = new Set<string>();
          if (c.caseId) candidates.add(String(c.caseId).toLowerCase());
          if (c.id) candidates.add(String(c.id).toLowerCase());
          if (c.uuid) candidates.add(String(c.uuid).toLowerCase());
          if (c._id) candidates.add(String(c._id).toLowerCase());
          
          const num = c.caseNumber || (c as any).case_number;
          if (num) {
              candidates.add(String(num));
              candidates.add(`c-${num}`);
          }
          if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) {
               candidates.add(c.caseId.replace('C-', ''));
          }

          // Check if ANY candidate is in the assigned list
          for (const cand of candidates) {
              if (caseIds.has(cand)) return true;
          }
          
          // Also check direct property
          const directValues: any[] = [
            c.assignedInvestigatorId,
            c.assigned_investigator_id,
            (c as any).assignedInvestigatorID,
            (c as any).investigatorId,
            (c as any).investigator_id,
            (c as any).userId,
            (c as any).user_id,
            (c as any).assignedTo,
            (c as any).assigned_to,
            (c as any).assignedToId,
            (c as any).assigned_to_id,
            (c as any).assignedInvestigatorUsername,
            (c as any).assignedInvestigatorName,
            c.assignedInvestigator?.userId,
            c.assignedInvestigator?.id,
            c.assignedInvestigator?.username,
            c.assignedInvestigator?.preferred_username,
            c.assignedInvestigator?.name,
            (c as any).assignedNames,
            (c as any).assigned_names,
          ];

          const flat: string[] = [];
          directValues.forEach(v => {
            if (v === null || v === undefined) return;
            if (Array.isArray(v)) {
              v.forEach(x => {
                if (x === null || x === undefined) return;
                flat.push(String(x));
              });
              return;
            }
            flat.push(String(v));
          });

          for (const raw of flat) {
            const val = String(raw);
            const valLower = val.toLowerCase();
            if (resolvedUserId && val === String(resolvedUserId)) return true;
            if (subjectId && val === subjectId) return true;
            if (usernameLower && (valLower === usernameLower || valLower.includes(usernameLower))) return true;
            if (fullNameLower && (valLower === fullNameLower || valLower.includes(fullNameLower))) return true;
          }
          
          return false;
      });

      setAssignments(myAssignments);
      const deletedSet = deletedCases && deletedCases.size > 0 ? deletedCases : null;
      const filteredAllCases = deletedSet
        ? uniqueCases.filter(c => !deletedSet.has(String((c as any).caseId || '').toLowerCase()))
        : uniqueCases;
      const filteredMyCases = deletedSet
        ? myCases.filter(c => !deletedSet.has(String((c as any).caseId || '').toLowerCase()))
        : myCases;
      setAllCases(filteredAllCases);
      setCases(filteredMyCases);

      const myCaseIds = new Set(myCases.map(c => String(c.caseId)));
      const myEvidences = allEvidences.filter((e: any) =>
        myCaseIds.has(String(e.caseId))
      );
      setEvidences(myEvidences);

      const myLogs = allLogs.filter((l: any) =>
        myCaseIds.has(String((l as any).caseId || ''))
      );

      // Document fetching enabled (Per-Case Strategy)
      console.log(`Investigator: Fetching documents for ${myCaseIds.size} cases...`);
      const documentPromises = Array.from(myCaseIds).map(async (caseId) => {
          if (!caseId || caseId === 'null' || caseId === 'undefined') return [];
          
          // FIX: Skip non-UUID IDs to prevent 500 errors on backend
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(caseId)) {
              return [];
          }

          try {
              const res = await api.get(`/documents/case/${encodeURIComponent(caseId)}`);
              return Array.isArray(res.data) ? res.data : [];
          } catch (e) {
              console.warn(`Failed to fetch documents for case ${caseId}`, e);
              return [];
          }
      });

      const documentResults = await Promise.allSettled(documentPromises);
      const fetchedDocuments = documentResults
          .filter(r => r.status === 'fulfilled')
          .flatMap((r: any) => r.value);
      
      console.log(`Investigator: Fetched ${fetchedDocuments.length} documents total.`);
      setDocuments(fetchedDocuments);

      setInvestigatorLogs(myLogs);
    } catch (err) {
      console.error('Investigator sync failed', err);
      // Preserve current state instead of clearing lists to avoid empty UI
    } finally {
      setLoading(false);
      console.log('Investigator: loader off');
      try { clearTimeout(fallbackTimer); } catch (_) {}
    }
  };

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    try {
      const cached = localStorage.getItem('cached_cases');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setAllCases(parsed);
        }
      }
    } catch (_) {}
    setLoading(false);
    loadData();
  }, []);

  // Refresh data when triggered from AdminDashboard
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('Investigator: Refreshing data due to external trigger');
      loadData();
    }
  }, [refreshTrigger]);

  const assignedCasesWithEvidence = useMemo(
    () =>
      cases.map(c => ({
        ...c,
        evidences: evidences.filter(e => String(e.caseId) === String(c.caseId)),
        documents: documents.filter(d => {
          const docCaseId = String(
            d.caseId ||
            d.case_id ||
            (d as any).caseID ||
            ''
          );
          return docCaseId && String(docCaseId) === String(c.caseId);
        }),
      })),
    [cases, evidences, documents]
  );

  const allCasesWithEvidence = useMemo(
    () =>
      allCases.map(c => ({
        ...c,
        evidences: evidences.filter(e => String(e.caseId) === String(c.caseId)),
        documents: documents.filter(d => {
          const docCaseId = String(
            d.caseId ||
            d.case_id ||
            (d as any).caseID ||
            ''
          );
          return docCaseId && String(docCaseId) === String(c.caseId);
        }),
      })),
    [allCases, evidences, documents]
  );

  const assignmentsByCase = useMemo(() => {
    const map: Record<string, AssignedCase[]> = {};
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(id || '')
      );
    assignments.forEach((a: any) => {
      const rawCaseId = a.caseId || (a as any).case_id || (a as any).caseID;
      if (!rawCaseId) return;
      const baseId = String(rawCaseId).trim();
      const baseLower = baseId.toLowerCase();
      const keys = new Set<string>();
      if (baseLower) keys.add(baseLower);

      const cNumMatch = baseId.match(/^C-(\d+)$/i);
      if (cNumMatch) {
        const n = cNumMatch[1];
        keys.add(n.toLowerCase());
        keys.add(`c-${n}`.toLowerCase());
      } else if (/^\d+$/.test(baseId)) {
        keys.add(baseId.toLowerCase());
        keys.add(`c-${baseId}`.toLowerCase());
      }

      const assignmentNum = (a as any).caseNumber || (a as any).case_number;
      if (assignmentNum !== null && assignmentNum !== undefined && String(assignmentNum).trim()) {
        const n = String(assignmentNum).trim();
        if (/^\d+$/.test(n)) {
          keys.add(n.toLowerCase());
          keys.add(`c-${n}`.toLowerCase());
        }
      }

      if (isUuid(baseId)) {
        const match = allCases.find(c => {
          const ids = [
            (c as any).caseId,
            (c as any).id,
            (c as any).uuid,
            (c as any)._id,
          ]
            .filter(Boolean)
            .map((x: any) => String(x).trim().toLowerCase());
          return ids.includes(baseLower);
        });
        if (match) {
          const caseIdCandidates = [
            (match as any).caseId,
            (match as any).id,
            (match as any).uuid,
            (match as any)._id,
          ]
            .filter(Boolean)
            .map((x: any) => String(x).trim().toLowerCase());
          caseIdCandidates.forEach(k => k && keys.add(k));

          const num = (match as any).caseNumber || (match as any).case_number;
          if (num !== null && num !== undefined && String(num).trim()) {
            const n = String(num).trim();
            if (/^\d+$/.test(n)) {
              keys.add(n.toLowerCase());
              keys.add(`c-${n}`.toLowerCase());
            }
          }

          const caseIdText = String((match as any).caseId || '').trim();
          const caseIdTextLower = caseIdText.toLowerCase();
          if (caseIdTextLower.startsWith('c-')) {
            const stripped = caseIdTextLower.slice(2).trim();
            if (stripped) keys.add(stripped);
          }
        }
      } else if (baseLower.startsWith('c-')) {
        const stripped = baseLower.slice(2).trim();
        if (stripped) keys.add(stripped);
      }

      const record: AssignedCase = {
        assignmentId: Number((a as any).assignmentId || (a as any).assignment_id || (a as any).id || 0),
        caseId: baseId,
        userId: String(a.userId || (a as any).user_id || (a as any).userID || (a as any).investigatorId || ''),
      };

      keys.forEach(k => {
        if (!map[k]) map[k] = [];
        map[k].push(record);
      });
    });
    return map;
  }, [assignments, allCases]);

  const filteredCasesWithEvidence = useMemo(() => {
    const usernameLower = String(username || '').toLowerCase();

    const showOnlyAssigned =
      usernameLower === 'inv01' || usernameLower === 'inv02' || usernameLower === 'nardi';

    const isMineByAssignments = (c: any) => {
      const candidates: string[] = [];
      if (c.caseId) candidates.push(String(c.caseId).toLowerCase());
      if (c.id) candidates.push(String(c.id).toLowerCase());
      if (c.uuid) candidates.push(String(c.uuid).toLowerCase());
      if (c._id) candidates.push(String(c._id).toLowerCase());
      const num = c.caseNumber || (c as any).case_number;
      if (num) {
        candidates.push(String(num).toLowerCase());
        candidates.push(`c-${String(num).toLowerCase()}`);
      }
      if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) {
        candidates.push(c.caseId.slice(2).toLowerCase());
      }
      return candidates.some(k => {
        const list = assignmentsByCase[k];
        return Array.isArray(list) && list.some(a => isUserIdMatch((a as any).userId));
      });
    };

    const baseCases = showOnlyAssigned
      ? allCasesWithEvidence.filter(c => isMineByAssignments(c) || isMineByCaseEntity(c))
      : allCasesWithEvidence;

    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return baseCases;

    return baseCases.filter((c: any) => {
      const values = [
        c.caseId,
        c.id,
        c.uuid,
        c.caseNumber,
        c.case_number,
        c.title,
        c.location,
        c.caseType,
        c.currentStatus,
        c.description,
        c.caseDescription,
        c.case_description,
      ]
        .filter(v => v !== null && v !== undefined)
        .map(v => String(v).toLowerCase());

      return values.some(v => v.includes(q));
    });
  }, [
    allCasesWithEvidence,
    assignmentsByCase,
    currentUserId,
    isMineByCaseEntity,
    isUserIdMatch,
    searchQuery,
    userInfo?.name,
    userInfo?.sub,
    username,
  ]);

  const logsByCase = useMemo(() => {
    const map: Record<string, any[]> = {};
    investigatorLogs.forEach((log: any) => {
      const caseId = String((log as any).caseId || '');
      if (!caseId) return;
      if (!map[caseId]) map[caseId] = [];
      map[caseId].push(log);
    });
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) =>
        String((b as any).date || '').localeCompare(String((a as any).date || ''))
      );
    });
    return map;
  }, [investigatorLogs]);

  const handleStatusChange = (caseId: string, value: string) => {
    setStatusDrafts(prev => ({ ...prev, [caseId]: value }));
  };

  const handleSaveStatus = async (caseId: string) => {
    const targetCase = allCases.find(
      c => String((c as any).caseId || (c as any).id || '') === String(caseId)
    );
    if (!targetCase) {
      alert('Case not found');
      return;
    }
    const nextStatus = statusDrafts[caseId] || targetCase.currentStatus || 'In Progress';
    try {
      let resolvedCaseId = caseId;
      const isUuid = (id: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const rawTargetId = String((targetCase as any).caseId || (targetCase as any).id || '');
      if (isUuid(rawTargetId)) {
        resolvedCaseId = rawTargetId;
      } else if (isUuid(String((targetCase as any).uuid || '').trim())) {
        resolvedCaseId = String((targetCase as any).uuid).trim();
      } else if (!isUuid(caseId)) {
        const searchNum = String(caseId).replace(/^C-/i, '').trim();
        const aliasMatch = allCases.find(c => {
          const cId = String((c as any).caseId || (c as any).id || '');
          const cNum = String((c as any).caseNumber || (c as any).case_number || '').trim();
          return cNum === searchNum && isUuid(cId);
        });
        if (aliasMatch) {
          resolvedCaseId = String((aliasMatch as any).caseId || (aliasMatch as any).id || caseId);
        }
      }

      const normalizeStatusForApi = (value: string, sampleExisting?: string) => {
        const v = String(value || '').trim();
        const sample = String(sampleExisting || '').trim();
        const looksEnum =
          !!sample &&
          sample === sample.toUpperCase() &&
          /[A-Z]/.test(sample) &&
          !sample.includes(' ');
        if (!looksEnum) return v;
        return v.replace(/\s+/g, '_').toUpperCase();
      };

      let canonicalCase: any = null;
      try {
        const res = await api.get(`/cases/${encodeURIComponent(resolvedCaseId)}`);
        canonicalCase = res.data;
      } catch (e: any) {
        if (e?.response?.status === 404) {
          const num =
            (targetCase as any).caseNumber ??
            (targetCase as any).case_number ??
            (typeof rawTargetId === 'string' && /^C-\d+$/i.test(rawTargetId)
              ? Number(rawTargetId.replace(/^C-/i, ''))
              : null);
          if (num !== null && num !== undefined && String(num).trim()) {
            try {
              const listRes = await api.get('/cases');
              if (Array.isArray(listRes.data)) {
                const found = listRes.data.find((c: any) => String(c.caseNumber) === String(num));
                const foundId = found?.caseId || found?.id || found?.case_id;
                if (foundId && isUuid(String(foundId))) {
                  resolvedCaseId = String(foundId);
                  const res2 = await api.get(`/cases/${encodeURIComponent(resolvedCaseId)}`);
                  canonicalCase = res2.data;
                }
              }
            } catch (_) {}
          }
        }
      }

      const baseCase = canonicalCase && typeof canonicalCase === 'object' ? canonicalCase : targetCase;
      const apiStatus = normalizeStatusForApi(nextStatus, baseCase?.currentStatus);

      const payload: any = { ...(baseCase as any), currentStatus: apiStatus };
      delete payload.evidences;
      delete payload.documents;
      delete payload.isPlaceholder;

      try {
        await api.put(`/cases/${encodeURIComponent(resolvedCaseId)}`, payload);
      } catch (err: any) {
        if (err?.response?.status !== 500) throw err;
      }

      setAllCases(prev =>
        prev.map(c => {
          const ids = [
            (c as any).caseId,
            (c as any).id,
            (c as any).uuid,
            (c as any)._id,
          ]
            .filter(Boolean)
            .map((x: any) => String(x).trim());
          if (ids.includes(String(resolvedCaseId).trim()) || ids.includes(String(caseId).trim())) {
            return { ...(c as any), currentStatus: apiStatus };
          }
          return c;
        }),
      );
      setCases(prev =>
        prev.map(c => {
          const ids = [
            (c as any).caseId,
            (c as any).id,
            (c as any).uuid,
            (c as any)._id,
          ]
            .filter(Boolean)
            .map((x: any) => String(x).trim());
          if (ids.includes(String(resolvedCaseId).trim()) || ids.includes(String(caseId).trim())) {
            return { ...(c as any), currentStatus: apiStatus };
          }
          return c;
        }),
      );
      try {
        const raw = localStorage.getItem('cached_cases');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((c: any) => {
              const ids = [c?.caseId, c?.id, c?.uuid, c?._id].filter(Boolean).map((x: any) => String(x).trim());
              if (ids.includes(String(resolvedCaseId).trim()) || ids.includes(String(caseId).trim())) {
                return { ...c, currentStatus: apiStatus };
              }
              return c;
            });
            localStorage.setItem('cached_cases', JSON.stringify(updated));
          }
        }
      } catch (_) {}
      await loadData();
      alert('Case status updated');
    } catch (err) {
      console.error('Status update failed', err);
      alert('Status update failed');
    }
  };

  const handleEditEvidenceChange = (evidenceId: string, field: 'type' | 'description', value: string) => {
    setEditingEvidence(prev => ({
      ...prev,
      [evidenceId]: {
        type: field === 'type' ? value : prev[evidenceId]?.type || '',
        description: field === 'description' ? value : prev[evidenceId]?.description || '',
      },
    }));
  };

  const handleSaveEvidence = async (evidence: EvidenceItem) => {
    const draft = editingEvidence[evidence.evidenceId] || {
      type: evidence.type,
      description: evidence.description,
    };
    try {
      await api.put(`/evidences/${evidence.evidenceId}`, {
        evidenceId: evidence.evidenceId,
        caseId: evidence.caseId,
        type: draft.type,
        description: draft.description,
        collectedByUserId: evidence.collectedByUserId,
      });
      await loadData();
      alert('Evidence updated');
    } catch (err) {
      console.error('Update evidence failed', err);
      alert('Failed to update evidence');
    }
  };

  const handleNewEvidenceChange = (caseId: string, field: 'type' | 'description', value: string) => {
    setNewEvidenceDrafts(prev => ({
      ...prev,
      [caseId]: {
        ...(prev[caseId] || { type: '', description: '' }),
        [field]: value,
      },
    }));
  };

  const handleAddEvidence = async (caseId: string) => {
    if (!currentUserId) {
      alert('Investigator identity not resolved');
      return;
    }
    const draft = newEvidenceDrafts[caseId];
    if (!draft || !draft.type.trim() || !draft.description.trim()) {
      alert('Please provide both type and description for the new evidence.');
      return;
    }

    // Resolve UUID Strategy:
    let resolvedCaseId = caseId;
    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isUuid(caseId)) {
        // Find case in state by exact ID match
        const directMatch = allCases.find(c => String((c as any).caseId || (c as any).id || '') === String(caseId));
        if (directMatch && isUuid(String((directMatch as any).caseId || (directMatch as any).id || ''))) {
            resolvedCaseId = String((directMatch as any).caseId || (directMatch as any).id || caseId);
        } else if (directMatch && (directMatch as any).uuid && isUuid(String((directMatch as any).uuid))) {
            resolvedCaseId = String((directMatch as any).uuid);
        } else {
            // Find case by Case Number (fuzzy match)
            const searchNum = String(caseId).replace(/^C-/i, '').trim();
            const aliasMatch = allCases.find(c => {
                const cId = String((c as any).caseId || (c as any).id || '');
                const cNum = String((c as any).caseNumber || (c as any).case_number || '').trim();
                return cNum === searchNum && isUuid(cId);
            });
            if (aliasMatch) {
                resolvedCaseId = String((aliasMatch as any).caseId || (aliasMatch as any).id || caseId);
            }
        }
    }

    try {
      console.log('Creating evidence for case:', resolvedCaseId, '(Original:', caseId, ') User:', currentUserId);
      await api.post('/evidences', {
        evidenceId: crypto.randomUUID(),
        caseId: resolvedCaseId,
        type: draft.type,
        description: draft.description,
        collectedByUserId: currentUserId,
      });
      setNewEvidenceDrafts(prev => ({ ...prev, [caseId]: { type: '', description: '' } }));
      await loadData();
      alert('Evidence added successfully');
    } catch (err: any) {
      console.error('Create evidence failed', err);
      const msg = err.response?.data?.message || err.message || 'Failed to add evidence';
      alert(`Failed to add evidence: ${msg}`);
    }
  };

  const handleNewLogChange = (caseId: string, value: string) => {
    setNewLogDrafts(prev => ({
      ...prev,
      [caseId]: value,
    }));
  };

  const handleAddInvestigatorLog = async (caseId: string) => {
    if (!currentUserId) {
      alert('Investigator identity not resolved');
      return;
    }

    const details = newLogDrafts[caseId] || '';
    if (!details.trim()) {
      alert('Provide update details for the investigator log');
      return;
    }

    // Resolve UUID Strategy
    let resolvedCaseId = caseId;
    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isUuid(caseId)) {
        const directMatch = allCases.find(c => String((c as any).caseId || (c as any).id || '') === String(caseId));
        if (directMatch && isUuid(String((directMatch as any).caseId || (directMatch as any).id || ''))) {
            resolvedCaseId = String((directMatch as any).caseId || (directMatch as any).id || caseId);
        } else if (directMatch && (directMatch as any).uuid && isUuid(String((directMatch as any).uuid))) {
            resolvedCaseId = String((directMatch as any).uuid);
        } else {
            const searchNum = String(caseId).replace(/^C-/i, '').trim();
            const aliasMatch = allCases.find(c => {
                const cId = String((c as any).caseId || (c as any).id || '');
                const cNum = String((c as any).caseNumber || (c as any).case_number || '').trim();
                return cNum === searchNum && isUuid(cId);
            });
            if (aliasMatch) {
                resolvedCaseId = String((aliasMatch as any).caseId || (aliasMatch as any).id || caseId);
            }
        }
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      await api.post('/investigatorlogs', {
        investigatorId: currentUserId,
        caseId: resolvedCaseId,
        date: today,
        updateDetails: details.trim(),
      });
      setNewLogDrafts(prev => ({ ...prev, [caseId]: '' }));
      await loadData();
      alert('Investigator log added');
    } catch (err: any) {
      console.error('Create investigator log failed', err);
      const msg = err.response?.data?.message || err.message || 'Failed to add investigator log';
      alert(`Failed to add investigator log: ${msg}`);
    }
  };

  const handleGenerateReport = (c: any) => {
    try {
      const doc = new jsPDF();
      const lineHeight = 8;
      let y = 20;
      const maxWidth = 170;

      const rawPageSize: any =
        (doc as any).internal?.pageSize ||
        (doc as any).internal?.getPageSize?.() ||
        {};
      const pageHeight =
        (typeof rawPageSize.getHeight === 'function'
          ? rawPageSize.getHeight()
          : rawPageSize.height) || 842;
      const marginTop = 20;
      const marginBottom = 20;

      const writeLine = (text: string = '') => {
        const split = (doc as any).splitTextToSize;
        const lines =
          typeof split === 'function' ? split.call(doc, text, maxWidth) : [text];
        lines.forEach((l: string) => {
          if (y > pageHeight - marginBottom) {
            doc.addPage();
            y = marginTop;
          }
          doc.text(String(l ?? ''), 20, y);
          y += lineHeight;
        });
      };

      const formatDate = (value: any) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString();
      };

      const caseNumber = c.caseNumber || c.case_number || '';
      const registrationDate =
        c.registrationDate || c.registration_date || c.date || '';
      const description =
        c.caseDescription || c.case_description || c.description || '';

      const caseIdLabel = String(
        c.caseId || c.id || c.uuid || c._id || caseNumber || 'Unknown'
      );
      const idCandidates = new Set<string>();
      [c.caseId, c.id, c.uuid, c._id, caseNumber]
        .filter(v => v !== null && v !== undefined && String(v).trim())
        .forEach(v => idCandidates.add(String(v).trim().toLowerCase()));
      if (caseNumber !== null && caseNumber !== undefined && String(caseNumber).trim()) {
        const n = String(caseNumber).trim().toLowerCase();
        idCandidates.add(`c-${n}`);
      }

      writeLine(`Case Report: ${caseIdLabel}`);
      if (caseNumber) writeLine(`Case Number: ${caseNumber}`);
      writeLine(`Title: ${c.title || ''}`);
      writeLine(`Status: ${c.currentStatus || ''}`);
      writeLine(`Location: ${c.location || ''}`);
      writeLine(`Type: ${c.caseType || ''}`);
      if (registrationDate) {
        writeLine(`Registration Date: ${formatDate(registrationDate)}`);
      }
      writeLine('');
      writeLine('Case Description:');
      writeLine(description || 'NO DESCRIPTION');
      writeLine('');
      writeLine('Evidence:');

      const relatedEvidence =
        (c.evidences && c.evidences.length
          ? c.evidences
          : evidences.filter(e => {
              const evCaseId = String((e as any).caseId || '').trim().toLowerCase();
              return evCaseId && idCandidates.has(evCaseId);
            })) || [];

      if (relatedEvidence.length === 0) {
        writeLine('  None recorded');
      } else {
        relatedEvidence.forEach((e: any) => {
          writeLine(`  - ${e.type}: ${e.description}`);
        });
      }

      writeLine('');
      writeLine('Documents:');

      const relatedDocuments =
        (c.documents && c.documents.length
          ? c.documents
          : documents.filter(d => {
              const docCaseId = String(
                d.caseId || d.case_id || (d as any).caseID || ''
              )
                .trim()
                .toLowerCase();
              return docCaseId && idCandidates.has(docCaseId);
            })) || [];

      if (relatedDocuments.length === 0) {
        writeLine('  None attached');
      } else {
        relatedDocuments.forEach((d: any) => {
          const name =
            d.fileName ||
            d.file_name ||
            d.documentId ||
            d.document_id ||
            'UNNAMED FILE';
          const type = d.typeOfDocument || d.type_of_document || 'Document';
          const storage =
            d.locationOfTheStorage || d.location_of_the_storage || '';
          const dateLabel = d.date ? formatDate(d.date) : '';

          let line = `  - ${name} [${type}`;
          if (dateLabel) line += ` • ${dateLabel}`;
          line += ']';
          writeLine(line);

          if (storage) {
            writeLine(`    Location: ${storage}`);
          }
        });
      }

      const safeCaseLabel = Array.from(String(caseIdLabel || ''))
        .map(ch => {
          const code = ch.charCodeAt(0);
          const isControl = code >= 0 && code < 32;
          const isInvalid = isControl || /[<>:"/\\|?*]/.test(ch);
          return isInvalid ? '-' : ch;
        })
        .join('');
      doc.save(`CASE-${safeCaseLabel}-REPORT.pdf`);
    } catch (err: any) {
      console.error('Generate report failed', err);
      alert(
        err?.message ||
          err?.response?.data?.message ||
          'Failed to generate report. Please try again.'
      );
    }
  };

  const handleViewDocument = async (doc: any) => {
    const directPath = getDocumentPath(doc);
    const directUrl = buildAbsoluteUrl(directPath);
    const documentIdFromMeta = getDocumentId(doc);
    const documentIdFromPath = getDocumentIdFromPath(directPath);
    const documentId = documentIdFromMeta || documentIdFromPath;

    try {
      if (!documentId) {
        if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
          window.open(directUrl, '_blank');
          return;
        }
        alert('Unable to view document. File may not be available.');
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
      if (directUrl && !/\/api\/documents\//i.test(directUrl)) {
        try {
          window.open(directUrl, '_blank');
          return;
        } catch (_) {
        }
      }
      alert('Unable to view document. File may not be available.');
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
        alert('Unable to download document. File may not be available.');
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
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
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
      alert('Unable to download document. File may not be available.');
    }
  };

  const handleFileChange = (caseId: string, file: File | null) => {
    setSelectedFiles(prev => ({
      ...prev,
      [caseId]: file,
    }));
  };

  const handleUploadDocument = async (caseId: string) => {
    const selectedFile = selectedFiles[caseId];
    if (!selectedFile) {
      alert('Please select a file to upload.');
      return;
    }

    setUploadingCases(prev => ({ ...prev, [caseId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('caseId', caseId);
      formData.append('typeOfDocument', 'Case Document');
      formData.append('locationOfTheStorage', 'Case Files');

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSelectedFiles(prev => ({ ...prev, [caseId]: null }));
      await loadData();
      if (onRefresh) onRefresh();
      alert('Document uploaded successfully!');
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          'Failed to upload document. Please try again.'
      );
    } finally {
      setUploadingCases(prev => ({ ...prev, [caseId]: false }));
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="mt-4 text-[10px] tracking-[0.3em] uppercase text-blue-400 font-black">{t(language, 'syncingInvestigatorConsole')}</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-10 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-8 h-[calc(100vh-80px)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tight">
              {t(language, 'roleInvestigator')} <span className="text-blue-500">{t(language, 'console')}</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-3">
              {t(language, 'investigatorSubtitle')}
            </p>
          </div>
          <div className={`px-6 py-4 rounded-3xl border flex items-center gap-4 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-slate-700'}`}>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                {t(language, 'signedInAs')}
              </span>
              <span className="text-sm font-black">
                {userInfo?.name || t(language, 'roleInvestigator')} ({username})
              </span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                {t(language, 'language')}
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className={`h-9 px-3 rounded-2xl border text-[10px] font-black uppercase tracking-[0.25em] outline-none ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                <option value="en">EN</option>
                <option value="am">AM</option>
              </select>
              <button
                type="button"
                onClick={toggleTheme}
                className={`h-9 px-3 rounded-2xl border text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                  isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {themeLabel}
              </button>
            </div>
            <button
              type="button"
              onClick={() => useAuthStore.getState().logout()}
              className="ml-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] bg-red-600 hover:bg-red-500 text-white"
            >
              {t(language, 'logout')}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
            All Cases: {allCases.length} • Showing: {filteredCasesWithEvidence.length} • Active Assignments: {assignedCasesWithEvidence.length}
          </div>

          <div className={`flex items-center px-4 py-2 rounded-xl border transition-all w-full md:w-[420px] ${isLight ? 'bg-white border-slate-200 focus-within:border-blue-500/50' : 'bg-white/5 border-white/10 focus-within:border-blue-500/50'}`}>
            <input
              type="text"
              placeholder={t(language, 'searchCasesPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`bg-transparent border-none outline-none text-sm w-full font-bold uppercase tracking-widest ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-white/20'}`}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`ml-3 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.25em] border ${
                  isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                {t(language, 'clear')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
            {filteredCasesWithEvidence.map(c => {
            const caseKey = String(c.caseId || c.id || '');
            const statusDraft = statusDrafts[caseKey] || c.currentStatus || 'In Progress';
            const caseLogs = logsByCase[caseKey] || [];
            const candidates: string[] = [];
            if (c.caseId) candidates.push(String(c.caseId).toLowerCase());
            if (c.id) candidates.push(String(c.id).toLowerCase());
            if (c.uuid) candidates.push(String(c.uuid).toLowerCase());
            if (c._id) candidates.push(String(c._id).toLowerCase());
            const num = c.caseNumber || (c as any).case_number;
            if (num) {
              candidates.push(String(num).toLowerCase());
              candidates.push(`c-${String(num).toLowerCase()}`);
            }
            if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) {
              candidates.push(c.caseId.slice(2).toLowerCase());
            }
            const aList = candidates.map(k => assignmentsByCase[k]).find(v => v && v.length > 0) || [];
            const isAssignedToMe =
              aList.some(a => isUserIdMatch((a as any).userId)) || isMineByCaseEntity(c);
            const caseDetailsId = String(
              (c as any).uuid || c.caseId || c.id || (c as any)._id || ''
            ).trim();
            return (
              <motion.div
                key={c.caseId || c.id || Math.random()}
                className={`rounded-[1.75rem] p-6 shadow-2xl flex flex-col gap-4 relative overflow-hidden border ${
                  isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#020617] border-slate-800 text-white'
                }`}
                whileHover={{ borderColor: '#3b82f6', translateY: -4 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              >
                <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-blue-500/10 to-transparent" />
                <div className="flex justify-between items-start gap-4 relative">
                  <div className="space-y-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}>
                      {c.caseId || c.id || 'Unknown ID'}
                    </span>
                    <h2 className={`text-2xl font-black uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {c.title || 'Untitled Case'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                      Location: {c.location || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                      Assigned To: {isAssignedToMe ? (userInfo?.name || username || 'You') : 'Sara Tesfaye'}
                      {aList.length > 0 ? ` • Assignment ID: ${aList[0].assignmentId || '—'}` : ''}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                      Status
                    </div>
                    <select
                      value={statusDraft}
                      onChange={e => handleStatusChange(caseKey, e.target.value)}
                      className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase border outline-none ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900'
                          : 'bg-black/40 border-blue-500/40 text-white'
                      }`}
                    >
                      <option value="New">New</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Closed">Closed</option>
                      <option value="Total">Total</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSaveStatus(caseKey)}
                      className="mt-2 px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-500"
                    >
                      Save Status
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-2 relative">
                  <button
                    type="button"
                    onClick={() => setOpenCaseId(caseDetailsId || caseKey)}
                    className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase border transition-colors ${
                      isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                    }`}
                  >
                    View Case
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateReport(c)}
                    className="px-3 py-1 rounded-xl text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-500"
                  >
                    Generate Report
                  </button>
                </div>

                <div className={`mt-4 rounded-2xl border p-4 space-y-3 relative ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                }`}>
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                    Evidence Log
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {c.evidences && c.evidences.length > 0 ? (
                      c.evidences.map((e: EvidenceItem) => {
                        const draft = editingEvidence[e.evidenceId] || {
                          type: e.type || '',
                          description: e.description || '',
                        };

                        return (
                          <div
                            key={e.evidenceId}
                            className={`rounded-xl p-3 space-y-2 border ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#020617] border-slate-700'
                            }`}
                          >
                            {isAssignedToMe ? (
                              <>
                                <input
                                  className={`w-full bg-transparent border-b text-[11px] font-bold outline-none mb-1 ${
                                    isLight ? 'border-slate-200 text-slate-900' : 'border-slate-600 text-white'
                                  }`}
                                  value={draft.type}
                                  onChange={ev =>
                                    handleEditEvidenceChange(
                                      e.evidenceId,
                                      'type',
                                      ev.target.value
                                    )
                                  }
                                />
                                <textarea
                                  className={`w-full bg-transparent border rounded-lg text-[11px] outline-none p-2 ${
                                    isLight ? 'border-slate-200 text-slate-900' : 'border-slate-600 text-white'
                                  }`}
                                  rows={2}
                                  value={draft.description}
                                  onChange={ev =>
                                    handleEditEvidenceChange(
                                      e.evidenceId,
                                      'description',
                                      ev.target.value
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEvidence(e)}
                                  className="mt-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-500"
                                >
                                  Save Evidence
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="text-[11px] font-bold">
                                  {String(e.type || '').trim() || 'Evidence'}
                                </div>
                                <div className={`text-[11px] whitespace-pre-wrap break-words ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                  {String(e.description || '').trim() ||
                                    'No description'}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[10px] text-slate-500">
                        No evidence recorded for this case.
                      </div>
                    )}
                  </div>

                  <div className={`mt-3 border-t pt-3 space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                      Add Evidence
                    </div>
                    <input
                      className={`w-full border rounded-lg px-3 py-2 text-[11px] outline-none ${
                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/40 border-slate-600 text-white'
                      }`}
                      placeholder="Evidence Type (e.g., Physical, Digital)"
                      value={newEvidenceDrafts[caseKey]?.type || ''}
                      onChange={e =>
                        handleNewEvidenceChange(caseKey, 'type', e.target.value)
                      }
                    />
                    <textarea
                      className={`w-full border rounded-lg px-3 py-2 text-[11px] outline-none ${
                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/40 border-slate-600 text-white'
                      }`}
                      placeholder="Description of the evidence"
                      rows={2}
                      value={newEvidenceDrafts[caseKey]?.description || ''}
                      onChange={e =>
                        handleNewEvidenceChange(
                          caseKey,
                          'description',
                          e.target.value
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEvidence(caseKey)}
                      className="mt-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-500"
                    >
                      Save Evidence
                    </button>
                  </div>
                </div>

                  {isAssignedToMe ? (
                  <>
                    <div className={`mt-4 rounded-2xl border p-4 space-y-3 relative ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                        Investigator Log
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {caseLogs.length > 0 ? (
                          caseLogs.map((log: any, index: number) => (
                            <div
                              key={`${c.caseId}-${String((log as any).date || '')}-${index}`}
                              className={`rounded-xl p-3 space-y-1 border ${
                                isLight ? 'bg-white border-slate-200' : 'bg-[#020617] border-slate-700'
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
                                <span>{String((log as any).date || '')}</span>
                                <span>{String((log as any).investigatorId || '')}</span>
                              </div>
                              <div className={`text-[11px] ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                {String((log as any).updateDetails || '')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-slate-500">
                            No investigator updates for this case.
                          </div>
                        )}
                      </div>

                      <div className={`mt-3 border-t pt-3 space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                          Add Update
                        </div>
                        <textarea
                          className={`w-full border rounded-lg px-3 py-2 text-[11px] outline-none ${
                            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/40 border-slate-600 text-white'
                          }`}
                          placeholder="Investigator update details"
                          rows={2}
                          value={newLogDrafts[caseKey] || ''}
                          onChange={e =>
                            handleNewLogChange(
                              caseKey,
                              e.target.value
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleAddInvestigatorLog(caseKey)}
                          className="mt-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-500"
                        >
                          Save Update
                        </button>
                      </div>
                    </div>

                    <div className={`mt-4 rounded-2xl border p-4 space-y-3 relative ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                        Case Documents
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {c.documents && c.documents.length > 0 ? (
                          c.documents.map((doc: any) => (
                            <div
                              key={doc.documentId || doc.document_id}
                              className={`p-3 rounded-2xl border flex items-center justify-between ${
                                isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className={`text-[11px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {doc.fileName ||
                                    doc.file_name ||
                                    doc.documentId ||
                                    doc.document_id ||
                                    'UNNAMED FILE'}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  {doc.typeOfDocument ||
                                    doc.type_of_document ||
                                    'Document'}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewDocument(doc)}
                                  className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-blue-600/20 hover:bg-blue-600/40"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDocument(doc)}
                                  className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-600/20 hover:bg-emerald-600/40"
                                >
                                  Download
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-slate-500">
                            No documents uploaded for this case.
                          </div>
                        )}
                      </div>

                      <div className={`mt-3 border-t pt-3 space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                          Upload Document
                        </div>
                        <input
                          type="file"
                          className="w-full text-[10px] file:mr-2 file:px-2 file:py-1 file:text-[9px] file:font-black file:uppercase file:bg-blue-600 file:text-white file:rounded-lg"
                          onChange={e =>
                            handleFileChange(
                              caseKey,
                              e.target.files && e.target.files[0]
                                ? e.target.files[0]
                                : null
                            )
                          }
                        />
                        {selectedFiles[caseKey] && (
                          <div className="text-[9px] text-emerald-400">
                            Selected: {selectedFiles[caseKey]?.name}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUploadDocument(caseKey)}
                          disabled={
                            !selectedFiles[caseKey] || uploadingCases[caseKey]
                          }
                          className="mt-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed"
                        >
                          {uploadingCases[caseKey] ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  </>
                  ) : null}
              </motion.div>
            );
          })}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {openCaseId && (
          <motion.div
            key="case-details-overlay"
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex-1 overflow-y-auto">
              <CaseDetails
                caseId={openCaseId}
                embedded
                theme={isLight ? 'light' : 'dark'}
                onClose={() => setOpenCaseId(null)}
                onCaseUpdated={() => {
                  loadData();
                  if (onRefresh) onRefresh();
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setOpenCaseId(null)}
              className="absolute top-6 right-6 px-4 py-2 rounded-full text-[10px] font-black uppercase bg-red-600 hover:bg-red-500"
            >
              {t(language, 'close')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Investigator;
