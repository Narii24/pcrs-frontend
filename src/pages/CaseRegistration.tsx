import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, FileUp } from 'lucide-react';
import { useAuthStore } from '../stores/authStore'; 
import { usePreferencesStore, t } from '../stores/preferencesStore';
import caseService from '../services/CaseService';
import api from '../services/api';
import { createInvestigatorLog } from '../services/InvestigatorLog';
import { getPresignedUpload, presignEnabled, recordDocument } from '../services/storageService';

interface CaseRegistrationProps {
  onRefresh?: () => void;
}

const CaseRegistration: React.FC<CaseRegistrationProps> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const { userInfo, token } = useAuthStore() as any;
  const { language } = usePreferencesStore();

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    caseType: 'Theft',
    caseDescription: '',
    location: '',
    registrationDate: new Date().toISOString().split('T')[0],
  });

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Parties State
  const [parties, setParties] = useState<any[]>([]);
  const [currentParty, setCurrentParty] = useState({
    fullName: '',
    partyType: 'Complainant',
    phoneNumber: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handlePartyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCurrentParty({ ...currentParty, [e.target.name]: e.target.value });
  };

  const addPartyToList = () => {
    if (!currentParty.fullName || !currentParty.phoneNumber) return;
    setParties([...parties, { ...currentParty }]);
    setCurrentParty({ fullName: '', partyType: 'Complainant', phoneNumber: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parties.length === 0) {
      alert(t(language, 'atLeastOnePartyRequired'));
      return;
    }

    setIsSubmitting(true);

    // Generate a temporary caseId, but prefer whatever the backend returns
    const generatedCaseId = `C-${Date.now().toString().slice(-6)}`;

    // 1. Create Case Payload
    const casePayload = {
      caseId: generatedCaseId,
      title: formData.title.toUpperCase(),
      caseType: formData.caseType,
      caseDescription: formData.caseDescription,
      location: formData.location.toUpperCase(),
      currentStatus: "Registered",
      registrationDate: formData.registrationDate,
      registeredBy: { 
        userId: userInfo?.userId || "U003" 
      } 
    };

    try {
      // 2. Submit Case to Database
      const caseRes = await caseService.createCase(casePayload);
      console.log("Create Case Response:", caseRes);

      // Canonical caseId as saved by backend (fallback to generated)
      const savedCase = caseRes.data || {};
      const canonicalCaseId =
        savedCase.caseId ||
        savedCase.case_id ||
        casePayload.caseId;
        
      console.log("Canonical Case ID:", canonicalCaseId);

      // Small delay to ensure DB consistency for subsequent requests
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Helper for retrying requests with timeout handling
      const retryRequest = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            console.log(`Attempt ${i + 1}/${retries} for ${fn.name || 'API request'}`);
            const result = await Promise.race([
              fn(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 second timeout
              )
            ]);
            console.log(`Attempt ${i + 1} successful`);
            return result;
          } catch (err: any) {
            console.warn(`Attempt ${i + 1} failed:`, err.message);
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        throw new Error(`All ${retries} attempts failed`);
      };

      let documentUploadSuccess = false;

      if (caseRes.status === 200 || caseRes.status === 201) {

        try {
          const investigatorUsername =
            (userInfo && (userInfo.username || userInfo.preferred_username || userInfo.sub)) ||
            'SYSTEM';
          
          // FIX: Generate a unique ID for the log entry to avoid PK collisions
          // Append the actual user to the details since backend uses this ID as the PK
          const uniqueLogId = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          await retryRequest(() => createInvestigatorLog({
            investigatorId: uniqueLogId,
            caseId: String(canonicalCaseId),
            date: new Date().toISOString().split('T')[0],
            updateDetails: `Case registered in system. [User: ${investigatorUsername}]`,
          }));
        } catch (logErr) {
          console.error('Failed to create default investigator log', logErr);
        }
        
        if (selectedFile) {
          const file = selectedFile;
          const contentType = file.type || 'application/octet-stream';

          try {
            if (presignEnabled()) {
              const presign = await getPresignedUpload({
                caseId: String(canonicalCaseId),
                fileName: file.name,
                contentType,
              });

              const putRes = await fetch(presign.url, {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body: file,
              });

              if (!putRes.ok) {
                throw new Error(`MinIO upload failed: ${putRes.status}`);
              }

              await recordDocument({
                caseId: String(canonicalCaseId),
                objectKey: presign.key,
                typeOfDocument: 'Case Document',
                locationOfTheStorage: 'MinIO - pcrs-file',
                originalName: file.name,
                size: file.size,
                contentType,
              });

              documentUploadSuccess = true;
            } else {
              throw new Error('MinIO presign disabled');
            }
          } catch (_) {
            try {
              const data = new FormData();
              data.append('caseId', String(canonicalCaseId));
              data.append('typeOfDocument', 'Case Document');
              data.append('locationOfTheStorage', 'MinIO - pcrs-file');
              data.append('file', file);

              const uploadResponse = await api.post('/documents/upload', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
              });

              if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                documentUploadSuccess = true;
              }
            } catch (_) {
            }
          }
        }

        // 4. Linked Parties - Simplified and more reliable
        console.log('=== PARTY CREATION START ===');
        console.log('Number of parties to create:', parties.length);
        console.log('Parties data:', parties);
        
        let partySuccessCount = 0;
        let partyFailureCount = 0;
        
        for (const p of parties) {
          try {
            const partyData = {
              partyId: `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              caseId: String(canonicalCaseId),
              fullName: p.fullName.toUpperCase(),
              phoneNumber: String(p.phoneNumber),
              partyType: p.partyType
            };
            
            console.log('Creating party:', partyData);
            
            // Try direct API call first (more reliable)
            const partyResponse = await api.post('/parties', partyData, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000 // 10 second timeout
            });
            
            console.log('Party creation response:', partyResponse.status, partyResponse.data);
            
            if (partyResponse.status === 200 || partyResponse.status === 201) {
              console.log('✅ Party created successfully:', p.fullName);
              partySuccessCount++;
            } else {
              console.error('❌ Party creation failed:', partyResponse.status);
              partyFailureCount++;
            }
            
          } catch (partyErr: any) {
            console.error('❌ Party creation error for', p.fullName, ':', partyErr.message);
            partyFailureCount++;
            
            // Try one more time with different approach
            try {
              console.log('🔄 Retrying party creation for:', p.fullName);
              const retryResponse = await fetch('http://localhost:8081/api/parties', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  partyId: `P-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  caseId: String(canonicalCaseId),
                  fullName: p.fullName.toUpperCase(),
                  phoneNumber: String(p.phoneNumber),
                  partyType: p.partyType
                })
              });
              
              if (retryResponse.ok) {
                console.log('✅ Party created on retry:', p.fullName);
                partySuccessCount++;
              } else {
                console.error('❌ Party retry also failed:', retryResponse.status);
              }
            } catch (retryErr) {
              console.error('❌ Party retry failed:', retryErr);
            }
          }
        }
        
        console.log(`=== PARTY CREATION SUMMARY ===`);
        console.log(`✅ Successful: ${partySuccessCount}`);
        console.log(`❌ Failed: ${partyFailureCount}`);
        console.log('=== PARTY CREATION END ===');

        if (onRefresh) onRefresh(); 
        if (selectedFile && documentUploadSuccess) {
          alert(`${t(language, 'caseRegisteredSuccessfully')}\n\n✅ ${t(language, 'uploading')} ${selectedFile?.name || ''}\n\n📋 VERIFICATION CHECKLIST:\n1. Open MinIO Console: http://localhost:9001\n2. Go to bucket: pcrs-file\n3. Navigate to: cases → ${canonicalCaseId}\n4. Look for file: ${selectedFile?.name || "your-file.pdf"}`);
        } else if (selectedFile) {
          alert(`${t(language, 'caseRegisteredSuccessfully')}\n\n❌ ${t(language, 'fileUploadFailed')}`);
        } else {
          alert(t(language, 'caseRegisteredSuccessfully'));
        }
        navigate('/dashboard');
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      alert(`${t(language, 'registryError')}: ${errorDetail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--pcrs-bg)] text-[color:var(--pcrs-text)] p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em]">
            <ChevronLeft size={16}/> {t(language, 'backToCommand')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[color:var(--pcrs-surface)] border border-[color:var(--pcrs-border)] rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
              <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-8">
                {language === 'en' ? (
                  <>
                    Case <span className="text-blue-600">Registration</span>
                  </>
                ) : (
                  <span className="text-blue-600">{t(language, 'caseRegistration')}</span>
                )}
              </h1>
              
              <div className="space-y-6">
                <input name="title" required placeholder={t(language, 'caseTitlePlaceholder')} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-2xl outline-none focus:border-blue-500 font-bold uppercase text-sm text-[color:var(--pcrs-text)]" onChange={handleChange} />
                
                <div className="grid grid-cols-2 gap-6">
                  <select name="caseType" className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-2xl outline-none text-[color:var(--pcrs-text)]" onChange={handleChange}>
                    <option value="Theft">{t(language, 'theft')}</option>
                    <option value="Fraud">{t(language, 'fraud')}</option>
                    <option value="Assault">{t(language, 'assault')}</option>
                    <option value="Cybercrime">{t(language, 'cybercrime')}</option>
                  </select>
                  <input type="date" name="registrationDate" value={formData.registrationDate} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-2xl outline-none text-[color:var(--pcrs-text)]" onChange={handleChange} />
                </div>
                
                <input name="location" placeholder={t(language, 'locationPlaceholder')} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-2xl outline-none font-bold uppercase text-sm text-[color:var(--pcrs-text)]" onChange={handleChange} />
                
                <textarea name="caseDescription" placeholder={t(language, 'narrativePlaceholder')} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-2xl outline-none h-32 text-sm text-[color:var(--pcrs-text)]" onChange={handleChange} />

                {/* --- NEW FILE UPLOAD SECTION --- */}
                <div className="bg-blue-600/10 border border-dashed border-slate-700 p-6 rounded-3xl group hover:border-blue-500 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-600/20">
                      <FileUp size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">{t(language, 'evidenceAttachment')}</p>
                      <input 
                        type="file" 
                        onChange={handleFileChange}
                        className="text-xs text-slate-500 file:hidden cursor-pointer w-full" 
                      />
                      {selectedFile && (
                        <p className="text-[10px] font-bold text-emerald-500 mt-2 uppercase">{t(language, 'selected')}: {selectedFile.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[color:var(--pcrs-surface)] border border-[color:var(--pcrs-border)] rounded-[2.5rem] p-8">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <UserPlus size={16}/> {t(language, 'involvedParties')}
              </h3>
              <div className="space-y-4 mb-6">
                <input name="fullName" value={currentParty.fullName} placeholder={t(language, 'namePlaceholder')} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-xl text-xs uppercase outline-none focus:border-blue-500 text-[color:var(--pcrs-text)]" onChange={handlePartyChange} />
                <input name="phoneNumber" value={currentParty.phoneNumber} type="text" placeholder={t(language, 'phonePlaceholder')} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-xl text-xs outline-none focus:border-blue-500 text-[color:var(--pcrs-text)]" onChange={handlePartyChange} />
                <select name="partyType" value={currentParty.partyType} className="w-full bg-[color:var(--pcrs-surface-2)] border border-[color:var(--pcrs-border)] p-4 rounded-xl text-xs outline-none text-[color:var(--pcrs-text)]" onChange={handlePartyChange}>
                  <option value="Complainant">{t(language, 'complainant')}</option>
                  <option value="Suspect">{t(language, 'suspect')}</option>
                  <option value="Witness">{t(language, 'witness')}</option>
                </select>
                <button type="button" onClick={addPartyToList} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">{t(language, 'addPerson')}</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {parties.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase truncate">{p.fullName} ({p.partyType})</p>
                    <button type="button" onClick={() => setParties(parties.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            
            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
              {isSubmitting ? t(language, 'syncingToRegistry') : t(language, 'commitToRegistry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseRegistration;
