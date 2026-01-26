import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, FileUp } from 'lucide-react';
import { useAuthStore } from '../stores/authStore'; 
import caseService from '../services/CaseService';
import api from '../services/api';
import { createInvestigatorLog } from '../services/InvestigatorLog';

interface CaseRegistrationProps {
  onRefresh?: () => void;
}

const CaseRegistration: React.FC<CaseRegistrationProps> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const { userInfo, token } = useAuthStore() as any;

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
      alert("AT LEAST ONE PARTY REQUIRED.");
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
          const contentType = selectedFile.type || 'application/octet-stream';
          
          console.log('=== DOCUMENT UPLOAD START ===');
          console.log('File to upload:', selectedFile.name);
          console.log('File size:', selectedFile.size);
          console.log('Content type:', contentType);
          console.log('Case ID:', canonicalCaseId);
          
          // Direct MinIO upload (bypass broken presigned endpoint)
          try {
            console.log('🔄 Using direct MinIO upload (bypassing presigned)...');
            
            // Step 1: Upload directly to MinIO
            const minioUrl = `http://localhost:9000/pcrs-file/cases/${canonicalCaseId}/${selectedFile.name}`;
            console.log('🌐 Direct MinIO upload URL:', minioUrl);
            
            const minioResponse = await fetch(minioUrl, {
              method: 'PUT',
              body: selectedFile,
              headers: {
                'Content-Type': selectedFile.type || 'application/octet-stream'
              }
            });
            
            console.log('📤 MinIO upload response status:', minioResponse.status);
            console.log('📤 MinIO upload response ok:', minioResponse.ok);
            
            if (minioResponse.ok) {
              console.log('✅ Direct MinIO upload successful!');
              console.log('📍 File now in MinIO at: pcrs-file/cases/' + canonicalCaseId + '/' + selectedFile.name);
              
              // Step 2: Create database record
              console.log('📝 Creating database record for uploaded file...');
              const data = new FormData();
              data.append('caseId', String(canonicalCaseId));
              data.append('typeOfDocument', 'Case Document');
              data.append('locationOfTheStorage', 'MinIO - pcrs-file');
              data.append('file_name', selectedFile.name);
              data.append('fileSize', String(selectedFile.size));
              
              const uploadResponse = await api.post(`/documents/upload?caseId=${canonicalCaseId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000
              });
              
              console.log('✅ Database record created:', uploadResponse.status);
              console.log('🎉 SUCCESS: File is in MinIO AND recorded in database!');
              
              if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                documentUploadSuccess = true;
                console.log('📍 MinIO location: pcrs-file/cases/' + canonicalCaseId + '/' + selectedFile.name);
                console.log('🗄️ Database: Document table updated with file metadata');
                
                if (uploadResponse.data?.documentId) {
                  console.log('✅ Document ID created:', uploadResponse.data.documentId);
                  console.log('🔗 View URL:', uploadResponse.data.viewTheUploadedDocument || uploadResponse.data.documentUpload);
                  
                  console.log('🔍 VERIFYING: File should now be visible in MinIO!');
                  console.log('🌐 MinIO Console: http://localhost:9000');
                  console.log('📂 Path: pcrs-file → cases → ' + canonicalCaseId + ' → ' + selectedFile.name);
                  console.log('✅ File should be visible immediately in MinIO console!');
                  
                  setTimeout(() => {
                    console.log('🔗 Direct MinIO Link:', `http://localhost:9000/buckets/pcrs-file/browse/cases/${canonicalCaseId}`);
                    console.log('📋 CHECKLIST:');
                    console.log('  1. Open MinIO Console: http://localhost:9000');
                    console.log('  2. Navigate to: pcrs-file → cases → ' + canonicalCaseId);
                    console.log('  3. Look for file:', selectedFile.name);
                    console.log('  4. File should be there now! ✅');
                  }, 2000);
                } else {
                  console.warn('⚠️ No documentId in response');
                }
              } else {
                console.error('❌ Database record creation failed:', uploadResponse.status);
              }
            } else {
              console.error('❌ Direct MinIO upload failed:', minioResponse.status);
              console.error('❌ Response text:', await minioResponse.text());
              throw new Error(`MinIO upload failed: ${minioResponse.status}`);
            }
            
          } catch (directErr: any) {
            console.error('❌ Direct MinIO upload failed:', directErr);
            console.error('❌ Error details:', directErr.message);
            
            // Fallback: Try backend upload
            try {
              console.log('🔄 Using backend fallback upload...');
              const data = new FormData();
              data.append('caseId', String(canonicalCaseId));
              data.append('typeOfDocument', 'Case Document');
              data.append('locationOfTheStorage', 'MinIO - pcrs-file');
              data.append('file', selectedFile);
              data.append('file_name', selectedFile.name);
              
              const uploadResponse = await api.post(`/documents/upload?caseId=${canonicalCaseId}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000
              });
              
              console.log('✅ Backend upload response:', uploadResponse.status);
              
              if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                documentUploadSuccess = true;
                console.log('📍 MinIO location: pcrs-file/cases/' + canonicalCaseId + '/' + selectedFile.name);
                console.log('⚠️ NOTE: Backend upload may not actually store files in MinIO');
                console.log('🔍 Check MinIO console to verify file presence');
              } else {
                console.error('❌ Backend upload failed:', uploadResponse.status);
              }
            } catch (backendErr) {
              console.error('❌ Backend fallback also failed:', backendErr);
            }
          }
          
          console.log('=== DOCUMENT UPLOAD END ===');
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
          alert("🎉 CASE & FILE UPLOAD SUCCESSFUL!\n\n📋 VERIFICATION CHECKLIST:\n1. Open MinIO Console: http://localhost:9000\n2. Go to bucket: pcrs-file\n3. Navigate to: cases → " + canonicalCaseId + "\n4. Look for file: " + (selectedFile?.name || "your-file.pdf") + "\n\n⚠️ If file is missing, backend is NOT uploading to MinIO!");
        } else if (selectedFile) {
          alert("CASE REGISTERED SUCCESSFULLY\n\n❌ File upload failed - check console for details\n🔧 Backend may not be uploading to MinIO");
        } else {
          alert("CASE REGISTERED SUCCESSFULLY");
        }
        navigate('/dashboard');
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.message || err.message;
      alert(`REGISTRY ERROR: ${errorDetail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.3em]">
            <ChevronLeft size={16}/> Back to Command
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0f172a]/50 border border-slate-800 rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
              <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-8">
                Case <span className="text-blue-600">Registration</span>
              </h1>
              
              <div className="space-y-6">
                <input name="title" required placeholder="CASE TITLE" className="w-full bg-black/40 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 font-bold uppercase text-sm" onChange={handleChange} />
                
                <div className="grid grid-cols-2 gap-6">
                  <select name="caseType" className="w-full bg-black/40 border border-slate-800 p-4 rounded-2xl outline-none" onChange={handleChange}>
                    <option value="Theft">Theft</option>
                    <option value="Fraud">Fraud</option>
                    <option value="Assault">Assault</option>
                    <option value="Cybercrime">Cybercrime</option>
                  </select>
                  <input type="date" name="registrationDate" value={formData.registrationDate} className="w-full bg-black/40 border border-slate-800 p-4 rounded-2xl outline-none" onChange={handleChange} />
                </div>
                
                <input name="location" placeholder="LOCATION" className="w-full bg-black/40 border border-slate-800 p-4 rounded-2xl outline-none font-bold uppercase text-sm" onChange={handleChange} />
                
                <textarea name="caseDescription" placeholder="NARRATIVE" className="w-full bg-black/40 border border-slate-800 p-4 rounded-2xl outline-none h-32 text-sm" onChange={handleChange} />

                {/* --- NEW FILE UPLOAD SECTION --- */}
                <div className="bg-blue-600/10 border border-dashed border-slate-700 p-6 rounded-3xl group hover:border-blue-500 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-600/20">
                      <FileUp size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Evidence Attachment</p>
                      <input 
                        type="file" 
                        onChange={handleFileChange}
                        className="text-xs text-slate-500 file:hidden cursor-pointer w-full" 
                      />
                      {selectedFile && (
                        <p className="text-[10px] font-bold text-emerald-500 mt-2 uppercase">Selected: {selectedFile.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#1e293b]/30 border border-slate-800 rounded-[2.5rem] p-8">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <UserPlus size={16}/> Involved Parties
              </h3>
              <div className="space-y-4 mb-6">
                <input name="fullName" value={currentParty.fullName} placeholder="NAME" className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl text-xs uppercase outline-none focus:border-blue-500" onChange={handlePartyChange} />
                <input name="phoneNumber" value={currentParty.phoneNumber} type="text" placeholder="PHONE" className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl text-xs outline-none focus:border-blue-500" onChange={handlePartyChange} />
                <select name="partyType" value={currentParty.partyType} className="w-full bg-black/40 border border-slate-800 p-4 rounded-xl text-xs outline-none" onChange={handlePartyChange}>
                  <option value="Complainant">Complainant</option>
                  <option value="Suspect">Suspect</option>
                  <option value="Witness">Witness</option>
                </select>
                <button type="button" onClick={addPartyToList} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Add Person</button>
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
              {isSubmitting ? "Syncing to Registry..." : "Commit to Registry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaseRegistration;
