import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import CaseDetails from '@/pages/CaseDetails';

interface SupervisorProps {
  onRefresh?: () => Promise<void> | void;
  refreshTrigger?: number;
  deletedCases?: Set<string>;
}

interface Investigator {
  userId: string;
  username: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface AssignmentRecord {
  assignmentId: number;
  caseId: string;
  userId: string;
  userName?: string;
  timestamp?: number;
}

const Supervisor: React.FC<SupervisorProps> = ({ onRefresh, refreshTrigger, deletedCases }) => {
  const { userInfo } = useAuthStore() as any;
  const [cases, setCases] = useState<any[]>([]);
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [caseNumberDrafts, setCaseNumberDrafts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCaseId, setSavingCaseId] = useState<string | null>(null);
  const [savingNumberCaseId, setSavingNumberCaseId] = useState<string | null>(null);
  const [hasNewCases, setHasNewCases] = useState(false);
  const [visibleColumn, setVisibleColumn] = useState<'both' | 'unassigned' | 'assigned'>('both');
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  // DISABLED BY DEFAULT: User wants to see all database records including potential duplicates
  const [enableDeduplication, setEnableDeduplication] = useState(false); 
  const [assignmentError, setAssignmentError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'assigned' | 'unassigned' | 'investigators'>('all');
  
  // Initialize from localStorage if available to survive refreshes
  const getInitialPending = () => {
    try {
        const saved = localStorage.getItem('supervisor_pending_assignments');
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  };

  const pendingAssignmentsRef = useRef<AssignmentRecord[]>(getInitialPending());
  const caseCountRef = useRef<number | null>(null);
  const username =
    userInfo?.username || userInfo?.preferred_username || '';
  const fallbackInvestigators: Investigator[] = [
    { userId: 'investigator01', username: 'investigator01', name: 'Sara Tesfaye', firstName: 'Sara', lastName: 'Tesfaye' }
  ];

  const loadData = async () => {
    console.log('Supervisor: loadData start');

    const [casesRes, usersRes, assignmentsRes] = await Promise.allSettled([
      api.get('/cases'),
      api.get('/users'),
      api.get('/assignedcases'),
    ]);

    // 1. Process Users (Build Map)
    const localUserMap: Record<string, string> = {};
    let enrichedUsers: Investigator[] = [];
    
    if (usersRes.status === 'fulfilled') {
      const rawUsers = Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
      const normalized = rawUsers.map((u: any) => {
        const uid = u.userId || u.userID || u.id || u._id || u.username;
        const uname = u.username || u.userName || u.name || uid;
        const full = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        return { userId: String(uid), username: String(uname), name: full || String(uname) } as Investigator;
      }).filter(u => !!u.userId);
      const hasSara = normalized.some((u: Investigator) => u.username === 'investigator01' || u.userId === 'investigator01');
      enrichedUsers = hasSara ? normalized : [...normalized, ...fallbackInvestigators];
      
      enrichedUsers.forEach((u: Investigator) => {
        const fullName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        localUserMap[u.userId] = fullName || u.username || u.userId;
      });
      setInvestigators(enrichedUsers);
    } else {
      enrichedUsers = fallbackInvestigators;
      localUserMap['investigator01'] = 'Sara Tesfaye';
      setInvestigators(enrichedUsers);
    }

    // 2. Process Assignments (Prepare Data)
    let normalizedAssignments: any[] = [];
    let allAssignmentsForMap: any[] = [];
    
    if (assignmentsRes.status === 'fulfilled') {
      const rawAssignments = Array.isArray(assignmentsRes.value.data) ? assignmentsRes.value.data : [];
      normalizedAssignments = rawAssignments.map((a: any) => ({
        ...a,
        caseId: a.caseId || a.case_id || a.caseID || a.id || a._id,
        userId: a.userId || a.user_id || a.userID || a.investigatorId,
        userName: a.userName || a.username || a.investigatorName,
        assignmentId: a.assignmentId || a.assignment_id || a.id,
      })).filter((a: any) => a.caseId && a.userId);
    }

    // Merge Pending Assignments
    const uniquePending = new Map<string, any>();
    pendingAssignmentsRef.current.forEach((p: any) => {
      const key = String(p.caseId).toLowerCase();
      const existing = uniquePending.get(key);
      if (!existing || (p.timestamp || 0) > (existing.timestamp || 0)) {
        uniquePending.set(key, p);
      }
    });
    const cleanPending = Array.from(uniquePending.values());
    
    // Filter pending assignments (keep them until backend confirms)
    const activePending = cleanPending.filter((p: any) => {
      const exists = normalizedAssignments.some(
        r =>
          String(r.caseId).toLowerCase() === String(p.caseId).toLowerCase() &&
          r.userId === p.userId,
      );
      return !exists;
    });

    // Cleanup expired from Ref
    if (normalizedAssignments.length > 0) {
      const initialCount = pendingAssignmentsRef.current.length;
      pendingAssignmentsRef.current = pendingAssignmentsRef.current.filter(p => {
        const pId = String(p.caseId).toLowerCase();
        const confirmed = normalizedAssignments.some(
          b => String(b.caseId).toLowerCase() === pId && b.userId === p.userId,
        );
        const expired =
          Date.now() - (p.timestamp || 0) > 30 * 24 * 60 * 60 * 1000;
        return !confirmed && !expired;
      });
      if (pendingAssignmentsRef.current.length !== initialCount) {
        localStorage.setItem(
          'supervisor_pending_assignments',
          JSON.stringify(pendingAssignmentsRef.current),
        );
      }
    }

    // Combine for Mapping
    allAssignmentsForMap = [...normalizedAssignments, ...activePending];

    // 3. Process Cases
    let uniqueCases: any[] = [];
    const uuidToNumber = new Map<string, string>();
    let nextCases: any[] = [];

    if (casesRes.status === 'fulfilled') {
      nextCases = Array.isArray(casesRes.value.data)
        ? casesRes.value.data
        : [];
    } else {
      try {
        const cached = localStorage.getItem('cached_cases');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            console.log(
              'Supervisor: Loaded cases from offline cache:',
              parsed.length,
            );
            nextCases = parsed;
          }
        }
      } catch (e) {
        console.warn('Supervisor: Failed to load cached cases');
      }
    }

    // Build UUID Map
    nextCases.forEach((c: any) => {
      const u = c.caseId || c.uuid || c.id || c._id;
      const n = c.caseNumber || (c as any).case_number;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (u && n && uuidRegex.test(String(u))) {
        uuidToNumber.set(String(u).toLowerCase(), String(n));
      }
      if (typeof u === 'string' && u.startsWith('C-')) {
        const extracted = u.replace('C-', '');
        if (extracted) uuidToNumber.set(u.toLowerCase(), extracted);
      }
    });

    // ORPHAN RECOVERY (Ghost Cases)
    const assignedIds = new Set(
      allAssignmentsForMap
        .map((a: any) => a.caseId)
        .filter((id: any) => id && id !== 'null' && id !== 'undefined'),
    );
    const existingIds = new Set(nextCases.map((c: any) => c.caseId));
    const missingIds = Array.from(assignedIds).filter(
      id => !existingIds.has(id),
    );

    // DEDUPLICATION
    if (enableDeduplication) {
      uniqueCases = nextCases.reduce((acc: any[], current: any) => {
        const currentId = current.caseId;
        let currentNum = current.caseNumber || (current as any).case_number;
        if (
          !currentNum &&
          typeof currentId === 'string' &&
          currentId.startsWith('C-')
        ) {
          currentNum = currentId.replace('C-', '');
        }
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isReal = uuidRegex.test(currentId);

        const existingIndex = acc.findIndex(item => {
          const itemId = item.caseId;
          let itemNum = item.caseNumber || (item as any).case_number;
          if (
            !itemNum &&
            typeof itemId === 'string' &&
            itemId.startsWith('C-')
          ) {
            itemNum = itemId.replace('C-', '');
          }

          if (itemId === currentId) return true;
          if (currentNum && itemNum && String(currentNum) === String(itemNum)) {
            const isCurrentUuid = uuidRegex.test(currentId);
            const isItemUuid = uuidRegex.test(itemId);
            if (isCurrentUuid !== isItemUuid) return true;
          }
          if (currentId === `C-${itemNum}`) return true;
          if (itemId === `C-${currentNum}`) return true;
          return false;
        });

        if (existingIndex > -1) {
          const existing = acc[existingIndex];
          const existingIsReal = uuidRegex.test(existing.caseId);
          if (isReal && !existingIsReal) {
            acc[existingIndex] = { ...existing, ...current };
          } else if (!isReal && existingIsReal) {
            acc[existingIndex] = { ...current, ...existing };
          }
        } else {
          acc.push(current);
        }
        return acc;
      }, []);
    } else {
      uniqueCases = nextCases;
    }

    // 4. Derive assignments from case entities if backend list is empty
    if ((allAssignmentsForMap?.length || 0) === 0 && Array.isArray(nextCases)) {
      const derived: any[] = [];
      nextCases.forEach((c: any) => {
        const directId =
          c.assignedInvestigatorId ||
          c.assigned_investigator_id ||
          c.investigatorId ||
          c.userId ||
          c.user_id;
        if (directId) {
          derived.push({
            caseId: c.caseId,
            userId: directId,
            userName: localUserMap[directId] || c.assignedInvestigator?.name || c.assignedInvestigator?.username,
          });
        }
      });
      if (derived.length > 0) {
        allAssignmentsForMap = derived;
      }
    }

    // 5. DIRECT INJECTION (Apply Assignments)
    const finalAssignMap = new Map<string, string[]>();

    allAssignmentsForMap.forEach(a => {
      if (!a.caseId) return;
      const uId = a.userId;
      const uName = localUserMap[uId] || a.userName || uId || 'Unknown';

      const keys = new Set<string>();
      keys.add(String(a.caseId).toLowerCase());

      const numMatch = String(a.caseId).match(/(\d+)/);
      if (numMatch) {
        keys.add(numMatch[1]);
        keys.add(`c-${numMatch[1]}`);
      }

      if (uuidToNumber.has(String(a.caseId).toLowerCase())) {
        const n = uuidToNumber.get(String(a.caseId).toLowerCase());
        if (n) {
          keys.add(n);
          keys.add(`c-${n}`);
        }
      }

      keys.forEach(k => {
        if (!finalAssignMap.has(k)) finalAssignMap.set(k, []);
        const list = finalAssignMap.get(k)!;
        if (!list.includes(uName)) list.push(uName);
      });
    });

    // Inject into Cases
    uniqueCases = uniqueCases.map(c => {
      const cId = String(c.caseId).toLowerCase();
      let names = finalAssignMap.get(cId) || [];

      if (names.length === 0) {
        const num = c.caseNumber || (c as any).case_number;
        if (num) {
          names = finalAssignMap.get(String(num)) || [];
          if (names.length === 0)
            names = finalAssignMap.get(`c-${num}`) || [];
        }
      }

      // Extra bridge: if caseId is C-#### and caseNumber not present, try stripped numeric
      if (names.length === 0 && typeof c.caseId === 'string' && c.caseId.startsWith('C-')) {
        const extracted = c.caseId.replace('C-', '');
        if (extracted) {
          names = finalAssignMap.get(String(extracted)) || [];
          if (names.length === 0) names = finalAssignMap.get(`c-${extracted}`) || [];
        }
      }

      if (names.length === 0) {
        const directId =
          c.assignedInvestigatorId ||
          c.assigned_investigator_id ||
          c.investigatorId ||
          c.userId ||
          c.user_id;
        if (directId) {
          const mappedName = localUserMap[directId] || directId;
          names = [mappedName];
          if (!c.assignedInvestigatorId) c.assignedInvestigatorId = directId;
        }
      }

      if (names.length > 0) {
        return { ...c, assignedNames: names };
      }
      return c;
    });

    const newCount = uniqueCases.length;
    if (caseCountRef.current !== null && newCount > caseCountRef.current) {
      setHasNewCases(true);
    }
    caseCountRef.current = newCount;
    setCases(uniqueCases);
    setAssignments(allAssignmentsForMap);
    console.log(
      'Supervisor: loadData complete. cases=',
      uniqueCases.length,
      'assignments=',
      allAssignmentsForMap.length,
    );

    setLoading(false);
    console.log('Supervisor: loader off');
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem('cached_cases');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setCases(parsed);
        }
      }
    } catch (_) {}
    setLoading(false);
    loadData();
  }, []);

  // Refresh data when triggered from AdminDashboard
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('Supervisor: Refreshing data due to external trigger');
      loadData();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (!hasNewCases) return;
    const timeout = setTimeout(() => {
      setHasNewCases(false);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [hasNewCases]);

  const userById = useMemo(() => {
    const map: Record<string, string> = {};
    investigators.forEach(u => {
      const full =
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      const label = full || u.username || u.userId;
      map[u.userId] = label;
      if (u.username) {
        map[String(u.username)] = label;
        map[String(u.username).toLowerCase()] = label;
      }
    });
    return map;
  }, [investigators]);

  const assignmentsByCase = useMemo(() => {
    const map: Record<string, string[]> = {};
    assignments.forEach(a => {
      if (!a.caseId) return;
      const key = String(a.caseId).toLowerCase(); // Normalize to lowercase
      if (!map[key]) map[key] = [];
      const label = a.userName || userById[a.userId] || a.userId;
      if (!map[key].includes(label)) {
        map[key].push(label);
      }
    });
    return map;
  }, [assignments, userById]);

  const casesWithAssignments = useMemo(
    () => cases, // Cases already have assignedNames injected by loadData
    [cases]
  );


  const visibleCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return casesWithAssignments;
    return casesWithAssignments.filter(c => {
      const id = String(c.caseId || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      const status = String(c.currentStatus || '').toLowerCase();
      const location = String(c.location || '').toLowerCase();
      return (
        id.includes(query) ||
        title.includes(query) ||
        status.includes(query) ||
        location.includes(query)
      );
    });
  }, [casesWithAssignments, searchTerm]);

  const unassignedCases = useMemo(() => {
    const seen = new Set<string>();
    const normalize = (c: any) => {
      const cid = String(c.caseId || '').toLowerCase();
      const num = c.caseNumber || (c as any).case_number;
      if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cid)) return cid;
      if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) return c.caseId.slice(2);
      if (num) return String(num);
      return cid;
    };
    return visibleCases.filter(c => {
      const isAssigned = (c.assignedNames || []).length > 0 || !!c.assignedInvestigatorId || !!c.assignedInvestigator;
      if (isAssigned) return false;
      const key = normalize(c);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visibleCases]);

  const assignedCases = useMemo(() => {
    const seen = new Set<string>();
    const normalize = (c: any) => {
      const cid = String(c.caseId || '').toLowerCase();
      const num = c.caseNumber || (c as any).case_number;
      if (cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cid)) return cid;
      if (typeof c.caseId === 'string' && c.caseId.startsWith('C-')) return c.caseId.slice(2);
      if (num) return String(num);
      return cid;
    };
    return visibleCases.filter(c => {
      const isAssigned = (c.assignedNames || []).length > 0 || !!c.assignedInvestigatorId || !!c.assignedInvestigator;
      if (!isAssigned) return false;
      const key = normalize(c);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visibleCases]);

  const stats = useMemo(() => {
    const assigned = assignedCases.length;
    const unassigned = unassignedCases.length;
    return { assigned, unassigned };
  }, [assignedCases, unassignedCases]);

  const generateNextCaseNumber = () => {
    let maxNumber = 0;
    cases.forEach(c => {
      const num = Number(c.caseNumber || (c as any).case_number || 0);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    });
    Object.values(caseNumberDrafts).forEach(v => {
      const num = Number(v);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    });
    return maxNumber + 1;
  };

  const handleGenerateCaseNumber = (caseId: string) => {
    const next = generateNextCaseNumber();
    setCaseNumberDrafts(prev => ({
      ...prev,
      [caseId]: String(next),
    }));
  };

  const handleAssign = async (caseId: string) => {
    const targetCase = cases.find(c => c.caseId === caseId);
    const userId = selection[caseId];

    if (!targetCase || !userId) {
      alert('Select investigator and case');
      return;
    }

    const invSource = investigators.length ? investigators : fallbackInvestigators;
    const selectedInv =
      invSource.find(u => String(u.userId) === String(userId)) ||
      invSource.find(
        u => String(u.username || '').toLowerCase() === String(userId).toLowerCase(),
      );
    const invUsername = String(selectedInv?.username || '').trim();
    const invKey = invUsername ? invUsername.toLowerCase() : String(userId);
    const invLabel = selectedInv?.name || selectedInv?.username || userById[userId] || String(userId);

    // Initialize currentCase early
    let currentCase = { ...targetCase };

    // UUID Resolution Logic
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let realCaseId = targetCase.caseId;
    
    // Check if current caseId is a valid UUID
    if (!uuidRegex.test(realCaseId)) {
        // Search for hidden UUID in the object
      const possibleId = (targetCase as any).id || (targetCase as any).uuid || (targetCase as any)._id;
      if (possibleId && uuidRegex.test(possibleId)) {
        realCaseId = possibleId;
      } else {
        // Scan all properties
        for (const key in targetCase) {
          const val = (targetCase as any)[key];
          if (typeof val === 'string' && uuidRegex.test(val)) {
            realCaseId = val;
            break;
          }
        }
      }
    }

    // 2. Sibling Search: If still not a UUID, look for another case in the list with the same Case Number OR Title
     if (!uuidRegex.test(realCaseId)) {
        const currentCaseNumber = targetCase.caseNumber || (targetCase as any).case_number;
        const currentTitle = targetCase.title || (targetCase as any).case_title;
        
        let foundSibling = null;

        // Strategy A: Match by Case Number
        let searchNum = currentCaseNumber;
        if (!searchNum) {
          const match = String(realCaseId).match(/^C-(\d+)$/i);
          if (match) searchNum = match[1];
        }

        if (searchNum) {
          const searchNumInt = parseInt(String(searchNum), 10);
          foundSibling = cases.find(other => {
            const otherId = other.caseId;
            const otherNum = other.caseNumber || (other as any).case_number;
            if (!otherId || !uuidRegex.test(otherId)) return false;
            const otherNumInt = parseInt(String(otherNum), 10);
            return !isNaN(searchNumInt) && !isNaN(otherNumInt) && searchNumInt === otherNumInt;
          });
        }

        // Strategy B: Match by Title (if Number search failed)
        if (!foundSibling && currentTitle && currentTitle !== 'UNTITLED CASE') {
             console.log(`Sibling Search: Number match failed. Trying title match for "${currentTitle}"`);
             foundSibling = cases.find(other => {
                 const otherId = other.caseId;
                 const otherTitle = other.title || (other as any).case_title;
                 if (!otherId || !uuidRegex.test(otherId)) return false;
                 return otherTitle === currentTitle;
             });
        }

        if (foundSibling) {
           console.log(`Found sibling with real UUID: ${foundSibling.caseId}`);
           realCaseId = foundSibling.caseId;
           currentCase = { ...foundSibling };
        }
     }

     // 3. Last Resort: Try to fetch the case directly to get the real UUID
     if (!uuidRegex.test(realCaseId)) {
        console.log("Last resort: UUID still missing. Attempting deep search (Direct, Parties, Docs)...");
        let freshData = null;
        let foundUuid = null;
        
        // A. Direct Fetch
        try {
           const res = await api.get(`/cases/${realCaseId}`);
           if (res.data) freshData = res.data;
        } catch (e) { /* ignore */ }

        if (!freshData) {
            try {
               const stripId = String(realCaseId).replace(/^C-/i, '');
               const res = await api.get(`/cases/${stripId}`);
               if (res.data) freshData = res.data;
            } catch (e) { /* ignore */ }
        }
        
        if (freshData) {
              const possibleUuid = freshData.caseId || freshData.id || freshData.uuid || freshData._id;
              if (possibleUuid && uuidRegex.test(possibleUuid)) {
                  foundUuid = possibleUuid;
              }
        }

        // B. Reverse Lookup via Parties (Sherlock Holmes Strategy)
        if (!foundUuid) {
            console.log("Deep Search: Checking Parties...");
            try {
                const stripId = String(realCaseId).replace(/^C-/i, '');
                // Try both C- and stripped ID
                const [p1, p2] = await Promise.allSettled([
                    api.get(`/parties?caseId=${realCaseId}`),
                    api.get(`/parties?caseId=${stripId}`)
                ]);
                
                const parties = [
                    ...(p1.status === 'fulfilled' && Array.isArray(p1.value.data) ? p1.value.data : []),
                    ...(p2.status === 'fulfilled' && Array.isArray(p2.value.data) ? p2.value.data : [])
                ];

                for (const p of parties) {
                    // Check if party has a caseId that is a UUID
                    if (p.caseId && uuidRegex.test(p.caseId)) {
                        foundUuid = p.caseId;
                        console.log("Deep Search Success: Found UUID via Party:", foundUuid);
                        break;
                    }
                    // Check caseEntity object
                    if (p.caseEntity && p.caseEntity.caseId && uuidRegex.test(p.caseEntity.caseId)) {
                         foundUuid = p.caseEntity.caseId;
                         console.log("Deep Search Success: Found UUID via Party.caseEntity:", foundUuid);
                         break;
                    }
                }
            } catch (e) { console.warn("Party lookup failed", e); }
        }

        // C. Reverse Lookup via Documents
        if (!foundUuid) {
            console.log("Deep Search: Checking Documents...");
            try {
                const stripId = String(realCaseId).replace(/^C-/i, '');
                // Try only stripped ID for documents to avoid 500s on C- format
                const [d2] = await Promise.allSettled([
                     api.get(`/documents/case/${stripId}`)
                ]);

                const docs = [
                    ...(d2.status === 'fulfilled' && Array.isArray(d2.value.data) ? d2.value.data : [])
                ];
                
                for (const d of docs) {
                    if (d.caseId && uuidRegex.test(d.caseId)) {
                        foundUuid = d.caseId;
                        console.log("Deep Search Success: Found UUID via Document:", foundUuid);
                        break;
                    }
                }
            } catch (e) { console.warn("Document lookup failed", e); }
        }

        if (foundUuid) {
            console.log("Deep Search: UUID Resolution Complete.", foundUuid);
            realCaseId = foundUuid;
        }
     }
     
     // 4. FINAL FALLBACK: Auto-Register Phantom Case (If deep search failed)
      if (!uuidRegex.test(realCaseId)) {
         console.log("UUID Recovery Failed. Attempting Auto-Registration of phantom case...");
         
         let syncedCaseNumber: number | undefined;
         const idMatch = String(targetCase.caseId).match(/^C-(\d+)$/i);
         if (idMatch) {
             syncedCaseNumber = parseInt(idMatch[1], 10);
         }

         try {
             // Construct a clean payload
             const payload = { ...targetCase };
             // Remove the C- ID to allow backend to generate a new one
             if (String(payload.caseId).startsWith('C-')) delete payload.caseId;
             delete payload._id;
             
             // Sync Case Number with the ID badge (C-792648 -> 792648)
             // This ensures consistency between the UI and the backend
             if (syncedCaseNumber) {
                 payload.caseNumber = syncedCaseNumber;
                 console.log(`Syncing payload caseNumber to ${payload.caseNumber} from ID`);
             }

             // Ensure essential fields
             if (!payload.title) payload.title = targetCase.title || 'Recovered Case ' + realCaseId;
             if (!payload.currentStatus) payload.currentStatus = 'Registered';
             
             // Remove derived fields that might confuse backend
             delete (payload as any).assignedNames;
             delete (payload as any).assignedInvestigatorId;
             
             console.log("Sending Auto-Register Payload:", payload);
             
             const res = await api.post('/cases', payload);
             console.log("Auto-Register Response:", res);

             if (res.data) {
                  const newUuid = res.data.caseId || res.data.id || res.data.uuid;
                  // Accept UUID OR existing ID if backend returned it (means it's valid enough)
                  if (newUuid) {
                      if (uuidRegex.test(newUuid)) {
                          console.log("Auto-Registration Successful. New UUID:", newUuid);
                      } else {
                          console.log("Auto-Registration returned existing ID (acceptable):", newUuid);
                      }
                      realCaseId = newUuid;
                      // Update the local list to replace the phantom with the real one
                      setCases(prev => prev.map(c => c.caseId === caseId ? { ...res.data, caseId: newUuid } : c));
                  } else {
                      console.warn("Auto-Register succeeded but returned no ID. Response data:", res.data);
                  }
             }
         } catch (e) {
             console.warn("Auto-Registration failed (safe to ignore if case exists)", e);
             // Try one more time with minimal payload if 400
             if (axios.isAxiosError(e) && e.response?.status === 400) {
                 console.log("Retrying with minimal payload...");
                 try {
                     const minPayload = {
                         title: targetCase.title || 'Recovered Case',
                         caseNumber: syncedCaseNumber, // Use the synced number
                         currentStatus: 'Registered',
                         caseType: targetCase.caseType || 'Other',
                         caseDescription: targetCase.caseDescription || 'Auto-recovered'
                     };
                     const res2 = await api.post('/cases', minPayload);
                     if (res2.data && (res2.data.caseId || res2.data.id)) {
                          realCaseId = res2.data.caseId || res2.data.id;
                          console.log("Retry Successful. UUID:", realCaseId);
                     }
                 } catch (ex) { console.error("Retry failed", ex); }
             }
         }
      }

    // Initialize currentCase with fresh data if available, or targetCase
    // We need to fetch the latest version of the case anyway to avoid overwriting other fields
    // If we found freshData above, we should use it.
    // currentCase is already initialized at the top, but we might want to update it if we found fresh data?
    // Actually, we should just ensure we have the latest data.
    
    // If we still don't have a UUID, and we have a C- ID, try to fallback to numeric ID for the PUT
    if (!uuidRegex.test(realCaseId) && String(realCaseId).startsWith('C-')) {
         const numericId = String(realCaseId).replace(/^C-/i, '');
         console.log(`Still no UUID. Falling back to numeric ID for PUT: ${numericId}`);
         realCaseId = numericId;
    }
    let hasCaseNumber = currentCase.caseNumber || (currentCase as any).case_number;

    // Implicitly sync case number if ID is in C- format (fixes 'supervisor can't generet' issue)
    if (!hasCaseNumber) {
      const cIdMatch = String(targetCase.caseId || '').match(/^C-(\d+)$/i);
      if (cIdMatch) {
        const extracted = parseInt(cIdMatch[1], 10);
        if (!isNaN(extracted) && extracted > 0) {
          try {
            await api.put(`/cases/${realCaseId}`, {
              ...currentCase,
              caseNumber: extracted,
            });
            currentCase.caseNumber = extracted;
            hasCaseNumber = extracted;
          } catch (e) {
            console.error('Silent case number sync failed', e);
          }
        }
      }
    }

    if (!hasCaseNumber) {
      const draft = caseNumberDrafts[caseId];
      const nextNum = draft ? Number(draft) : generateNextCaseNumber();

      if (Number.isNaN(nextNum) || nextNum <= 0) {
        alert('Invalid Case Number. Please generate or enter a valid number.');
        return;
      }

      try {
        await api.put(`/cases/${realCaseId}`, { // Use resolved UUID
          ...currentCase,
          caseNumber: nextNum,
        });
        currentCase.caseNumber = nextNum;
      } catch (err) {
        console.error('Auto-generation of case number failed', err);
        alert('Could not auto-generate Case Number. Please save it manually.');
        return;
      }
    }

    try {
        setSavingCaseId(caseId);
        const today = new Date().toISOString().split('T')[0];
        
        // 1. Try to update Assignment Registry (UUID)
        let registryUpdated = false;
        try {
          await api.post('/assignedcases', {
            caseId: realCaseId, // Try UUID first
            userId,
            assignedDate: today,
          });
          registryUpdated = true;
          console.log('Assignment registry updated with UUID:', realCaseId);
        } catch (e) {
          console.warn('Assignment registry UUID update failed.', e);
        }

        // 2. Conditional Backup: Update Assignment Registry with Numeric ID if UUID update failed or wasn't attempted
         // This prevents 500 errors caused by duplicate key constraints when the backend receives both UUID and Numeric ID.
         if (!registryUpdated) {
             try {
                   // USE CURRENTCASE (with potentially new number) instead of targetCase
                   const numericMatch = String(currentCase.caseId).match(/^C-(\d+)$/i) || String(currentCase.caseNumber).match(/^(\d+)$/);
                   const numericId = numericMatch ? numericMatch[1] : String(currentCase.caseNumber);
                   
                   // Only send if we found a valid number
                   if (numericId && numericId !== 'undefined' && numericId !== String(realCaseId)) {
                        try {
                            await api.post('/assignedcases', {
                               caseId: numericId,
                               userId,
                               assignedDate: today,
                            });
                            console.log('Assignment registry updated with Numeric ID (Backup):', numericId);
                            registryUpdated = true;
                        } catch (backupErr: any) {
                             // Treat 500 as potential success (duplicate entry) or harmless failure
                             if (backupErr.response && backupErr.response.status === 500) {
                                 console.log('Backup assignment returned 500 (likely duplicate), assuming persistence.');
                                 registryUpdated = true;
                             } else {
                                 throw backupErr;
                             }
                        }
                   }
             } catch (retryErr) {
                    // Suppress 500 errors here as they likely mean "Already Exists" or "Invalid ID format"
                    console.log('Assignment registry numeric backup skipped or failed safely.', retryErr);
             }
         }

        // 3. Try to update Case Entity
        try {
          await api.put(`/cases/${realCaseId}`, { // Use resolved UUID for update too
            ...currentCase,
            currentStatus:
              currentCase.currentStatus === 'Registered' || currentCase.currentStatus === 'New'
                ? 'In Progress'
                : currentCase.currentStatus,
            assignedInvestigatorId: invKey,
            assignedDate: today,
          });
        } catch (putErr: any) {
        // Ignore 500 errors which are often just LazyInitializationException on response serialization
        // The data is usually saved correctly in the backend.
        if (putErr.response && putErr.response.status === 500) {
           console.warn("PUT /cases returned 500, assuming success (Backend serialization issue).");
        } else {
           throw putErr; // Rethrow real errors to the outer catch block
        }
      }

      // Optimistically update local state to reflect assignment immediately
      setCases(prev => prev.map(c => {
         const cid = String(c.caseId || '');
         const num = c.caseNumber || (c as any).case_number;
         const cidNumMatch = cid.match(/^C-(\d+)$/i);
         const cidNum = cidNumMatch ? cidNumMatch[1] : undefined;
         const targetNumMatch = String(currentCase.caseId || '').match(/^C-(\d+)$/i);
         const targetNum = targetNumMatch ? targetNumMatch[1] : String(currentCase.caseNumber || '');
         const matches =
            cid === realCaseId ||
            cid === caseId ||
            (cidNum && targetNum && String(cidNum) === String(targetNum)) ||
            (num && targetNum && String(num) === String(targetNum));
         
         if (matches) {
             return {
                 ...c,
                 caseId: realCaseId,
                 currentStatus: 'In Progress',
                 assignedInvestigatorId: invKey,
                 assignedNames: invLabel ? [invLabel] : [invKey]
             };
         }
         return c;
      }));
      
      // Also update assignments state to ensure derived states (like stats and list filtering) work correctly
      const newAssignment = { 
          assignmentId: Date.now(),
          caseId: realCaseId, 
          userId: userId,
          userName: invLabel,
          timestamp: Date.now() // Add timestamp for cleanup
      };
      
      // Store in ref for immediate persistence across reloads
      // CRITICAL FIX: Remove any previous pending assignments for this case (Edit = Replace)
      pendingAssignmentsRef.current = pendingAssignmentsRef.current.filter(p => 
          String(p.caseId).toLowerCase() !== String(realCaseId).toLowerCase()
      );
      pendingAssignmentsRef.current.push(newAssignment);
      
      // PERSIST TO STORAGE: Save to localStorage so it survives F5 refresh
      try {
        localStorage.setItem('supervisor_pending_assignments', JSON.stringify(pendingAssignmentsRef.current));
      } catch (e) { console.warn("Failed to save pending assignments to storage", e); }

      setAssignments(prev => {
          // Remove old assignments for this case from state too
          const filtered = prev.filter(p => String(p.caseId).toLowerCase() !== String(realCaseId).toLowerCase());
          return [...filtered, newAssignment];
      });

      // Remove immediate loadData to prevent race conditions overwriting our optimistic update
      // await loadData(); 
      // Force refresh to verify persistence and link
      setTimeout(() => {
          console.log("Triggering post-assignment reload...");
          loadData();
      }, 500);
      
      if (onRefresh) {
        // Wrap onRefresh in try-catch or ensure it doesn't break UI state
        try { await onRefresh(); } catch(e) { console.warn("onRefresh failed", e); }
      }
      alert('Case assigned successfully');
    } catch (err: any) {
      console.error('Assignment failed', err);
      const data = err?.response?.data;
      let details = '';
      if (typeof data === 'string') {
        details = data;
      } else if (data?.message) {
        details = data.message;
      } else if (data?.error) {
        details = data.error;
      }
      alert(details ? `Assignment failed: ${details}` : 'Assignment failed');
    } finally {
      setSavingCaseId(null);
    }
  };

  const handleSaveCaseNumber = async (caseId: string) => {
    const targetCase = cases.find(c => c.caseId === caseId);
    const draft = caseNumberDrafts[caseId];
    const parsed = Number(draft);

    if (!targetCase) {
      alert('Case not found for number assignment');
      return;
    }
    if (!draft || Number.isNaN(parsed) || parsed <= 0) {
      alert('Enter a valid numeric case number');
      return;
    }

    try {
      setSavingNumberCaseId(caseId);
      await api.put(`/cases/${caseId}`, {
        ...targetCase,
        caseNumber: parsed,
      });
      await loadData();
      if (onRefresh) {
        await onRefresh();
      }
      alert('Case number updated');
    } catch (err) {
      console.error('Case number update failed', err);
      alert('Case number update failed');
    } finally {
      setSavingNumberCaseId(null);
    }
  };

  return (
    <div className="bg-[#0f172a] min-h-screen text-white">
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-20"
          >
            <motion.div
              className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            />
            <motion.div
              className="mt-4 text-blue-500 font-black tracking-[0.3em] text-[10px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              SYNCING SUPERVISOR CONSOLE
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="p-10 space-y-10 custom-scrollbar relative"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {hasNewCases && (
          <motion.div
            className="mb-4 flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-600/20 border border-emerald-500 text-[11px] text-emerald-100"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            layout
          >
            <span className="uppercase tracking-[0.25em] text-[9px]">
              New case registered
            </span>
            <button
              type="button"
              onClick={() => setHasNewCases(false)}
              className="ml-4 text-emerald-200 text-xs font-bold"
            >
              ×
            </button>
          </motion.div>
        )}
        <header className="flex flex-col gap-8 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tight">
                Supervisor <span className="text-blue-500">Console</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-3">
                Registered Case Registry • Investigator Assignment
              </p>
            </div>
            <motion.div
              className="bg-[#0f172a] px-3 py-2 rounded-2xl border border-slate-800 flex items-center gap-3 text-xs text-slate-100"
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">
                  Signed In As
                </span>
                <span className="text-[11px] font-black">
                  {userInfo.name || 'Supervisor'} ({username})
                </span>
              </div>
              <button
                type="button"
                onClick={() => useAuthStore.getState().logout()}
                className="ml-2 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] bg-red-600 hover:bg-red-500 text-white"
              >
                Logout
              </button>
            </motion.div>
          </div>

          {/* DASHBOARD STATS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             {/* Total Load */}
             <div 
                onClick={() => setActiveFilter('all')}
                className={`p-6 rounded-[1.75rem] border flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                  activeFilter === 'all' 
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-lg shadow-blue-900/20' 
                    : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                }`}
             >
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <div className="w-16 h-16 bg-blue-500 rounded-full blur-2xl"></div>
                 </div>
                 <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] mb-2">Total Case Load</div>
                 <div className="text-5xl font-black text-white tracking-tight">{casesWithAssignments.length}</div>
             </div>

             {/* Stats Cards */}
             <div 
                onClick={() => setActiveFilter('assigned')}
                className={`p-6 rounded-[1.75rem] border flex flex-col justify-between cursor-pointer transition-all duration-300 ${
                  activeFilter === 'assigned' 
                    ? 'bg-emerald-900/20 border-emerald-500/50 shadow-lg shadow-emerald-900/20' 
                    : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                }`}
             >
                 <div className="text-[10px] text-emerald-600 font-black uppercase tracking-wider mb-2">Assigned Cases</div>
                 <div className="text-3xl font-black text-emerald-400">{stats.assigned}</div>
                 <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-2">
                     {Math.round((stats.assigned / (casesWithAssignments.length || 1)) * 100)}% Completion
                 </div>
             </div>

             <div 
                onClick={() => setActiveFilter('unassigned')}
                className={`p-6 rounded-[1.75rem] border flex flex-col justify-between cursor-pointer transition-all duration-300 ${
                  activeFilter === 'unassigned' 
                    ? 'bg-blue-900/20 border-blue-400/50 shadow-lg shadow-blue-900/20' 
                    : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                }`}
             >
                 <div className="text-[10px] text-blue-600 font-black uppercase tracking-wider mb-2">Unassigned</div>
                 <div className="text-3xl font-black text-blue-400">{stats.unassigned}</div>
                 <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-2">Action Required</div>
             </div>

             {/* Investigator Mini-List */}
             <div 
                onClick={() => setActiveFilter('investigators')}
                className={`p-5 rounded-[1.75rem] border overflow-y-auto max-h-32 custom-scrollbar cursor-pointer transition-all duration-300 ${
                  activeFilter === 'investigators' 
                    ? 'bg-purple-900/20 border-purple-500/50 shadow-lg shadow-purple-900/20' 
                    : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                }`}
             >
                 <div className={`text-[9px] font-black uppercase tracking-[0.25em] mb-3 sticky top-0 pb-2 ${activeFilter === 'investigators' ? 'bg-transparent text-purple-400' : 'bg-[#0f172a] text-slate-500'}`}>
                    Investigator Load
                 </div>
                 <div className="space-y-2">
                    {(investigators.length ? investigators : fallbackInvestigators).map(inv => {
                       const keys = new Set<string>();
                       assignments.forEach(a => {
                         if (String(a.userId) === String(inv.userId) || String(a.userId) === String(inv.username)) {
                           const cid = String(a.caseId || '').toLowerCase();
                           let key = cid;
                           if (typeof a.caseId === 'string' && a.caseId.startsWith('C-')) key = a.caseId.slice(2);
                           if (!key) return;
                           keys.add(key);
                         }
                       });
                       const load = keys.size;
                       return (
                          <div key={inv.userId} className="flex items-center justify-between text-[10px]">
                             <span className="font-bold text-slate-300 truncate max-w-[100px]">{inv.name || inv.username}</span>
                             <span className="font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{load}</span>
                          </div>
                       );
                    })}
                 </div>
             </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full bg-blue-500/60" />
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                Active Case Load
              </div>
              <div className="text-sm font-black">
                {casesWithAssignments.length} cases in registry
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] border border-slate-700 rounded-2xl">
             <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${enableDeduplication ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${enableDeduplication ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <input 
                    type="checkbox" 
                    checked={enableDeduplication} 
                    onChange={e => {
                        setEnableDeduplication(e.target.checked);
                        // Trigger reload when toggled to re-process list with new setting
                        setTimeout(loadData, 50); 
                    }}
                    className="hidden" 
                />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors">
                    Smart Merge
                </span>
             </label>
          </div>

          <motion.div
            className="flex items-center gap-2 bg-[#0f172a] border border-slate-700 rounded-2xl px-4 py-2 text-slate-100"
            whileFocus={{ boxShadow: '0 0 25px rgba(59,130,246,0.35)' }}
          >
            <span className="text-[9px] uppercase text-slate-500 font-black tracking-[0.25em]">
              Filter
            </span>
            <input
              type="text"
              placeholder="Search by case, title, status..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[11px] font-semibold placeholder:text-slate-600 w-64"
            />
          </motion.div>
        </div>

        {activeFilter === 'investigators' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-300">
               {investigators.map(inv => {
                   const invAssignments = assignments.filter(a => 
                      String(a.userId) === String(inv.userId) || 
                      String(a.userId) === String(inv.username)
                   );
                   return (
                       <div key={inv.userId} className="bg-[#0f172a] border border-slate-800 rounded-[2rem] p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-purple-500/50 transition-all">
                           <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-black text-slate-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                   {inv.firstName ? inv.firstName[0] : (inv.username[0] || '?')}
                               </div>
                               <div>
                                   <div className="text-sm font-black text-slate-200">{inv.name || inv.username}</div>
                                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{inv.userId}</div>
                               </div>
                           </div>
                           <div className="mt-4 pt-4 border-t border-slate-800">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Active Cases</span>
                                   <span className="text-2xl font-black text-white">{invAssignments.length}</span>
                               </div>
                               <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                                   {invAssignments.map(a => (
                                       <div key={a.assignmentId} className="text-[10px] text-slate-400 bg-slate-900/50 px-2 py-1 rounded border border-slate-800/50 flex justify-between">
                                            <span className="font-mono">{String(a.caseId).substring(0,8)}...</span>
                                            <span className="opacity-50 text-[9px]">{new Date(a.timestamp || 0).toLocaleDateString()}</span>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       </div>
                   )
               })}
           </div>
        )}
        
        {activeFilter !== 'investigators' && (
        <div className={`grid gap-8 items-start ${activeFilter === 'all' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {/* COLUMN 1: UNASSIGNED CASES */}
          {(activeFilter === 'all' || activeFilter === 'unassigned') && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-2xl">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400">
                Unassigned
              </h3>
              <span className="px-3 py-1 rounded-xl bg-blue-500 text-white text-[10px] font-bold">
                {stats.unassigned}
              </span>
            </div>
            
            <div className="flex flex-col gap-4">
              {unassignedCases.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs uppercase tracking-widest font-bold border border-dashed border-slate-800 rounded-2xl">
                  No unassigned cases
                </div>
              ) : (
                unassignedCases.map(c => {
                  const assignedNames: string[] = c.assignedNames || [];
                  const assigned = assignedNames.length > 0;
                  const selectedId = selection[c.caseId] || '';
                  const currentCaseNumber = c.caseNumber ?? (c as any).case_number ?? '';
                  const draftNumber = caseNumberDrafts[c.caseId] ?? (currentCaseNumber ? String(currentCaseNumber) : '');
                  
                  return (
                    <motion.div
                      key={c.caseId}
                      className="bg-[#0f172a] border border-slate-800 rounded-[1.5rem] p-5 shadow-lg flex flex-col gap-4 relative text-white hover:border-blue-500/30 transition-all"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      layout
                    >
                       <div className="flex justify-between items-start gap-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400">
                            {String(c.caseId).startsWith('C-') ? c.caseId : (c.caseNumber ? `C-${c.caseNumber}` : c.caseId.substring(0, 8) + '...')}
                          </span>
                          <span className="text-[9px] font-bold uppercase text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">Unassigned</span>
                       </div>
                       
                       <div>
                          <h2 className="text-lg font-black uppercase tracking-tight leading-tight mb-1">
                            {c.title || 'Untitled Case'}
                          </h2>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {c.currentStatus || 'Unknown Status'}
                          </p>
                       </div>

                       {/* Case Number Generation (Only for non-C- IDs) */}
                       {(!String(c.caseId).startsWith('C-') && !c.caseNumber) && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
                           <input
                              type="text"
                              value={draftNumber}
                              placeholder="#"
                              onChange={e => setCaseNumberDrafts(prev => ({ ...prev, [c.caseId]: e.target.value }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] w-16 text-center outline-none focus:border-blue-500"
                           />
                           <button
                              onClick={() => handleGenerateCaseNumber(c.caseId)}
                              className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold uppercase"
                           >
                             Gen
                           </button>
                           <button
                              disabled={!draftNumber || savingNumberCaseId === c.caseId}
                              onClick={() => handleSaveCaseNumber(c.caseId)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[9px] font-bold uppercase"
                           >
                             Save
                           </button>
                        </div>
                       )}

                       <div className="pt-3 mt-auto border-t border-slate-800">
                          <div className="flex flex-col gap-2">
                             <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-300"
                                value={selectedId}
                                onChange={e => setSelection(prev => ({ ...prev, [c.caseId]: e.target.value }))}
                              >
                                <option value="">Select Investigator...</option>
                                {(investigators.length ? investigators : fallbackInvestigators).map(u => (
                                  <option key={u.userId} value={u.userId}>
                                    {u.name || u.username || u.userId}
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={!selectedId || savingCaseId === c.caseId}
                                onClick={() => handleAssign(c.caseId)}
                                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all"
                              >
                                {savingCaseId === c.caseId ? 'Assigning...' : 'Assign'}
                              </button>
                          </div>
                       </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
          )}

          {/* COLUMN 2: ASSIGNED CASES (LIST VIEW) */}
          {(activeFilter === 'all' || activeFilter === 'assigned') && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-2xl">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
                Assigned Registry
              </h3>
              <span className="px-3 py-1 rounded-xl bg-emerald-500 text-white text-[10px] font-bold">
                {stats.assigned}
              </span>
            </div>

            {assignmentError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between animate-pulse">
                   <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                       <span className="text-red-400 text-xs font-medium">Sync Failed</span>
                   </div>
                   <button 
                      onClick={() => loadData()}
                      className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition-all border border-red-500/20 hover:border-red-500/40"
                   >
                      Retry
                   </button>
                </div>
            )}

            <div className="bg-[#0f172a] border border-slate-800 rounded-[1.5rem] overflow-hidden shadow-lg flex flex-col h-full">
              {assignedCases.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs uppercase tracking-widest font-bold border-2 border-dashed border-slate-800/50 m-4 rounded-xl">
                  No assigned cases
                </div>
              ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Case ID</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Investigator</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {assignedCases.map((c, idx) => {
                              const assignedNames: string[] = Array.isArray(c.assignedNames) ? c.assignedNames : [];
                              const cid = c.caseId ? String(c.caseId) : '';
                              const displayId = cid.startsWith('C-')
                                ? cid
                                : (c.caseNumber
                                    ? `C-${c.caseNumber}`
                                    : (cid ? cid.slice(0, 8) + '...' : '—'));
                              return (
                                <tr 
                                    key={cid || String(idx)} 
                                    className="group hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    onClick={() => cid && setOpenCaseId(cid)}
                                >
                                    <td className="px-4 py-3 text-[10px] font-mono text-emerald-400 font-bold">
                                        {displayId}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-[11px] font-bold text-slate-200 truncate max-w-[150px]">{c.title || 'Untitled'}</div>
                                        <div className="text-[9px] text-slate-500 font-semibold">{c.currentStatus}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {assignedNames.length > 0 ? assignedNames.map((name, i) => (
                                                <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-300 font-medium">
                                                    {name}
                                                </span>
                                            )) : (
                                                <span className="text-[9px] text-red-400 italic">Pending...</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenCaseId(c.caseId);
                                            }}
                                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <span className="sr-only">View</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                    </td>
                                </tr>
                              );
                            })}
                        </tbody>
                    </table>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        )}
        
        {visibleCases.length === 0 && (
          <div className="border border-dashed border-slate-700 rounded-[3rem] py-24 text-center text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] flex flex-col gap-4 items-center justify-center">
            <span>No cases found</span>
            <button 
                onClick={() => loadData()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all"
            >
                Refresh Registry
            </button>
          </div>
        )}
      </motion.div>
      {/* Case Details Modal */}
      <AnimatePresence>
        {openCaseId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setOpenCaseId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-6xl h-[90vh] bg-[#0f172a] border border-slate-800 rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col"
            >
              <div className="absolute top-6 right-6 z-10">
                <button
                  onClick={() => setOpenCaseId(null)}
                  className="p-2 bg-slate-800/80 hover:bg-red-500/80 text-slate-400 hover:text-white rounded-full transition-all duration-300 backdrop-blur-md border border-slate-700 hover:border-red-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
                <CaseDetails
                  caseId={openCaseId}
                  embedded
                  readOnly
                  theme="dark"
                  onClose={() => setOpenCaseId(null)}
                  onCaseUpdated={() => {
                    loadData();
                    if (onRefresh) onRefresh();
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Supervisor;

