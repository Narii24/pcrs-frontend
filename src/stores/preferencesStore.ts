import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';
export type LanguageCode = 'en' | 'am';

type TranslationKey =
  | 'systemActive'
  | 'globalSearchPlaceholder'
  | 'intelligenceAlerts'
  | 'clear'
  | 'caseUpdated'
  | 'newCase'
  | 'noAlerts'
  | 'logout'
  | 'dashboard'
  | 'newCases'
  | 'registerCase'
  | 'assignCases'
  | 'documentArchive'
  | 'justiceInformationSystem'
  | 'authorized'
  | 'language'
  | 'theme'
  | 'brightMode'
  | 'darkMode'
  | 'caseDeployment'
  | 'operationalHubTotalActivity'
  | 'all'
  | 'merged'
  | 'systemCommand'
  | 'new'
  | 'inProgress'
  | 'closed'
  | 'total'
  | 'noActiveDeploymentsFound'
  | 'analyze'
  | 'newCaseFile'
  | 'assignedCases'
  | 'exportSummary'
  | 'dailyIntelligenceExport'
  | 'todaysCaseSummary'
  | 'close'
  | 'noCaseActivityToday'
  | 'newToday'
  | 'inProgressToday'
  | 'closedToday'
  | 'totalCasesToday'
  | 'newCasesToday'
  | 'inProgressCasesToday'
  | 'closedCasesToday'
  | 'summaryZeroDetail'
  | 'statusLabel'
  | 'systemUplinkFailed'
  | 'retryConnection'
  | 'establishingEncryptedLink'
  | 'file'
  | 'caseNumber'
  | 'caseLabel'
  | 'analysisMode'
  | 'editSpecifics'
  | 'discardChanges'
  | 'syncing'
  | 'confirmGlobalSync'
  | 'operationalStatus'
  | 'subjectIdentification'
  | 'incidentLocation'
  | 'offenseClassification'
  | 'selectCaseType'
  | 'theft'
  | 'fraud'
  | 'assault'
  | 'cybercrime'
  | 'dateOfIncident'
  | 'notSpecified'
  | 'caseIntelligenceNarrative'
  | 'attachedDocuments'
  | 'uploadNewDocument'
  | 'upload'
  | 'uploading'
  | 'selected'
  | 'unnamedFile'
  | 'document'
  | 'viewDocument'
  | 'download'
  | 'noDocumentsAttached'
  | 'backToAdminConsole'
  | 'returnToHub'
  | 'caseUpdatedSuccessfully'
  | 'caseNotFound'
  | 'unableToLoadCaseData'
  | 'untitledCase'
  | 'noDescription'
  | 'systemGateway'
  | 'authorizingSession'
  | 'verifiedDatabaseRecords'
  | 'newIntelligenceCases'
  | 'filterNewCasesPlaceholder'
  | 'pendingDeployment'
  | 'deployed'
  | 'personnelDeployment'
  | 'systemRegistry'
  | 'activeDeployments'
  | 'pendingAssignments'
  | 'assigned'
  | 'unassigned'
  | 'documents'
  | 'searchAssignmentsPlaceholder'
  | 'searchUnassignedCasesPlaceholder'
  | 'searchDocumentsPlaceholder'
  | 'assignNew'
  | 'activeOperation'
  | 'unknown'
  | 'locLabel'
  | 'typeLabel'
  | 'leadInvestigator'
  | 'deployedStatus'
  | 'investigatorNotes'
  | 'noContactNumber'
  | 'noRecentActivityLogs'
  | 'saveUpdate'
  | 'modifyLead'
  | 'fullDossier'
  | 'lastUpdated'
  | 'noActiveAssignmentsFound'
  | 'noUnassignedCasesFound'
  | 'noAssignedCasesFound'
  | 'noCasesFound'
  | 'refreshRegistry'
  | 'noDocumentsFound'
  | 'caseRegistration'
  | 'backToCommand'
  | 'caseTitlePlaceholder'
  | 'locationPlaceholder'
  | 'narrativePlaceholder'
  | 'evidenceAttachment'
  | 'involvedParties'
  | 'namePlaceholder'
  | 'phonePlaceholder'
  | 'complainant'
  | 'suspect'
  | 'witness'
  | 'addPerson'
  | 'syncingToRegistry'
  | 'commitToRegistry'
  | 'atLeastOnePartyRequired'
  | 'caseRegisteredSuccessfully'
  | 'fileUploadFailed'
  | 'registryError'
  | 'documentArchiveTitle'
  | 'filterIntelligencePlaceholder'
  | 'addDocument'
  | 'documentIdLabel'
  | 'caseIdLabel'
  | 'titleLabel'
  | 'typeFileName'
  | 'storage'
  | 'actions'
  | 'unknownCase'
  | 'unknownStatus'
  | 'selectInvestigatorPlaceholder'
  | 'assignLabel'
  | 'assigningLabel'
  | 'generateLabel'
  | 'saveLabel'
  | 'pendingLabel'
  | 'viewLabel'
  | 'syncFailed'
  | 'retryLabel'
  | 'newDocumentUplink'
  | 'storageLocation'
  | 'typeofdocument'
  | 'documentTypeIdentification'
  | 'documentTypeForensicReport'
  | 'documentTypeLegalWarrant'
  | 'selectOrDragDocumentBinary'
  | 'abort'
  | 'submitEntry'
  | 'submitEntryFailed'
  | 'intelligenceAccessDeniedFileBinaryNotFound'
  | 'uplinkFailureCouldNotDownload'
  | 'missingSelection'
  | 'unitAssignedSuccessfully'
  | 'assignInvestigatorTitle'
  | 'caseDossierLabel'
  | 'selectCasePlaceholder'
  | 'investigatorLabel'
  | 'selectPersonnelPlaceholder'
  | 'confirmAssignment'
  | 'decryptingPersonnelDatabase'
  | 'personnelManagement'
  | 'supervisorAuthorizationTerminal'
  | 'officerIdentity'
  | 'currentClearance'
  | 'assignNewRole'
  | 'unknownOfficer'
  | 'selectRolePlaceholder'
  | 'roleInvestigator'
  | 'roleDeskOfficer'
  | 'roleSupervisor'
  | 'systemUpdateClearanceReassigned'
  | 'accessDeniedInsufficientPrivileges'
  | 'userDirectory'
  | 'searchByUserOrCaseIdPlaceholder'
  | 'addNewPersonnel'
  | 'personnelLabel'
  | 'assignedCaseLabel'
  | 'assignmentDateLabel'
  | 'activeLabel'
  | 'lockedLabel'
  | 'editLabel'
  | 'syncingPersonnelDatabase'
  | 'authorizePersonnelTitle'
  | 'firstNamePlaceholder'
  | 'lastNamePlaceholder'
  | 'usernamePlaceholder'
  | 'caseAssignmentCaseIdPlaceholder'
  | 'systemPasswordPlaceholder'
  | 'authorizeAccess'
  | 'keycloakCreationFailed'
  | 'personnelAuthorizedCaseAssigned'
  | 'evidenceVaultTitle'
  | 'searchIdOrCasePlaceholder'
  | 'registerIntelligence'
  | 'evidenceIdLabel'
  | 'caseIdPrefix'
  | 'evidenceTypeLabel'
  | 'intelligenceDescriptionLabel'
  | 'noIntelligenceRecordsFound'
  | 'registerIntelligenceTitle'
  | 'intelligenceTypeLabel'
  | 'fileAttachmentLabel'
  | 'clickToUploadIntelligenceFile'
  | 'describeCollectedIntelligencePlaceholder'
  | 'secureEntry'
  | 'intelligenceSecuredSuccessfully'
  | 'failedNoFileAttached'
  | 'failedServerTransmissionError'
  | 'intelligenceDirectory'
  | 'showingResultsFor'
  | 'scanningDatabase'
  | 'general'
  | 'noRecordsFound'
  | 'pageNotFound'
  | 'sorryPageNotFound'
  | 'goBackToDashboard'
  | 'evidenceManagement'
  | 'loadingEvidences'
  | 'noEvidenceRecordsFound'
  | 'view'
  | 'edit'
  | 'sessionExpiredOrUnauthorized'
  | 'caseNotFound404'
  | 'errorSavingData'
  | 'unableToViewDocument'
  | 'unableToDownloadDocument'
  | 'pleaseSelectFileToUpload'
  | 'documentUploadedSuccessfully'
  | 'failedToUploadDocument'
  | 'loadingCaseData'
  | 'idLabel'
  | 'seniorInvestigatorRankIV'
  | 'securityClearanceTitle'
  | 'clearanceLevelLabel'
  | 'departmentLabel'
  | 'caseStatisticsTitle'
  | 'activeCasesLabel'
  | 'totalClosuresLabel'
  | 'descriptionLabel'
  | 'collectedByLabel'
  | 'adminPanel'
  | 'pcrManagement'
  | 'cases'
  | 'users'
  | 'administrator'
  | 'console'
  | 'signedInAs'
  | 'filter'
  | 'searchCasesPlaceholder'
  | 'adminDashboardSubtitle'
  | 'adminCasesSubtitle'
  | 'adminAssignedSubtitle'
  | 'adminUsersSubtitle'
  | 'syncingSupervisorConsole'
  | 'syncingInvestigatorConsole'
  | 'supervisorSubtitle'
  | 'investigatorSubtitle'
  | 'totalCaseLoad'
  | 'completion'
  | 'actionRequired'
  | 'investigatorLoad'
  | 'searchByCaseTitleStatusPlaceholder'
  | 'caseNumberUpdated'
  | 'caseNumberUpdateFailed';

const translations: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    systemActive: 'System Active',
    globalSearchPlaceholder: 'Global Intelligence Search...',
    intelligenceAlerts: 'Intelligence Alerts',
    clear: 'Clear',
    caseUpdated: 'Case Updated',
    newCase: 'New Case',
    noAlerts: 'No Alerts',
    logout: 'Logout',
    dashboard: 'Dashboard',
    newCases: 'New Cases',
    registerCase: 'Register Case',
    assignCases: 'Assign Cases',
    documentArchive: 'Document Archive',
    justiceInformationSystem: 'Justice Information System',
    authorized: 'Authorized',
    language: 'Language',
    theme: 'Theme',
    brightMode: 'Bright',
    darkMode: 'Dark',
    caseDeployment: 'CASE DEPLOYMENT',
    operationalHubTotalActivity: 'Operational Hub • Total Activity',
    all: 'All',
    merged: 'Merged',
    systemCommand: 'System Command',
    new: 'New',
    inProgress: 'In Progress',
    closed: 'Closed',
    total: 'Total',
    noActiveDeploymentsFound: 'No Active Deployments Found',
    analyze: 'Analyze',
    newCaseFile: 'New Case File',
    assignedCases: 'Assigned Cases',
    exportSummary: 'Export Summary',
    dailyIntelligenceExport: 'Daily Intelligence Export',
    todaysCaseSummary: "Today's Case Summary",
    close: 'Close',
    noCaseActivityToday: 'No case activity registered today',
    newToday: 'New Today',
    inProgressToday: 'In Progress Today',
    closedToday: 'Closed Today',
    totalCasesToday: 'Total Cases Today',
    newCasesToday: 'New Cases Today',
    inProgressCasesToday: 'In Progress Cases Today',
    closedCasesToday: 'Closed Cases Today',
    summaryZeroDetail: 'New, in progress, closed and total counters are all zero for today.',
    statusLabel: 'Status',
    systemUplinkFailed: 'System Uplink Failed',
    retryConnection: 'Retry Connection',
    establishingEncryptedLink: 'ESTABLISHING ENCRYPTED LINK...',
    file: 'FILE',
    caseNumber: 'Case #',
    caseLabel: 'Case',
    analysisMode: 'Analysis Mode',
    editSpecifics: 'Edit Specifics',
    discardChanges: 'Discard Changes',
    syncing: 'Syncing...',
    confirmGlobalSync: 'Confirm Global Sync',
    operationalStatus: 'Operational Status',
    subjectIdentification: 'Subject Identification',
    incidentLocation: 'Incident Location',
    offenseClassification: 'Offense Classification',
    selectCaseType: 'Select Case Type',
    theft: 'Theft',
    fraud: 'Fraud',
    assault: 'Assault',
    cybercrime: 'Cybercrime',
    dateOfIncident: 'Date of Incident',
    notSpecified: 'NOT SPECIFIED',
    caseIntelligenceNarrative: 'Case Intelligence & Narrative',
    attachedDocuments: 'Attached Documents',
    uploadNewDocument: 'Upload New Document',
    upload: 'Upload',
    uploading: 'Uploading...',
    selected: 'Selected',
    unnamedFile: 'UNNAMED FILE',
    document: 'Document',
    viewDocument: 'View Document',
    download: 'Download',
    noDocumentsAttached: 'No Documents Attached',
    backToAdminConsole: 'Back to Admin Console',
    returnToHub: 'Return to Hub',
    caseUpdatedSuccessfully: 'CASE UPDATED SUCCESSFULLY',
    caseNotFound: 'CASE NOT FOUND',
    unableToLoadCaseData: 'Unable to load case data. Please check the case ID.',
    untitledCase: 'UNTITLED CASE',
    noDescription: 'NO DESCRIPTION',
    systemGateway: 'System Gateway',
    authorizingSession: 'Authorizing Session...',
    verifiedDatabaseRecords: 'Verified Database Records',
    newIntelligenceCases: 'New Intelligence Cases',
    filterNewCasesPlaceholder: 'Filter new cases...',
    pendingDeployment: 'PENDING DEPLOYMENT',
    deployed: 'DEPLOYED',
    personnelDeployment: 'Personnel Deployment',
    systemRegistry: 'System Registry',
    activeDeployments: 'Active Deployments',
    pendingAssignments: 'Pending Assignments',
    assigned: 'Assigned',
    unassigned: 'Unassigned',
    documents: 'Documents',
    searchAssignmentsPlaceholder: 'SEARCH ASSIGNMENTS...',
    searchUnassignedCasesPlaceholder: 'SEARCH UNASSIGNED CASES...',
    searchDocumentsPlaceholder: 'SEARCH DOCUMENTS...',
    assignNew: 'Assign New',
    activeOperation: 'Active Operation',
    unknown: 'Unknown',
    locLabel: 'Loc',
    typeLabel: 'Type',
    leadInvestigator: 'Lead Investigator',
    deployedStatus: 'Deployed',
    investigatorNotes: 'Investigator & Notes',
    noContactNumber: 'No contact number recorded',
    noRecentActivityLogs: 'No recent activity logs recorded.',
    saveUpdate: 'Save Update',
    modifyLead: 'Modify Lead',
    fullDossier: 'Full Dossier →',
    lastUpdated: 'Last Updated',
    noActiveAssignmentsFound: 'No Active Assignments Found',
    noUnassignedCasesFound: 'No Unassigned Cases Found',
    noAssignedCasesFound: 'No Assigned Cases Found',
    noCasesFound: 'No cases found',
    refreshRegistry: 'Refresh Registry',
    noDocumentsFound: 'No Documents Found',
    caseRegistration: 'Case Registration',
    backToCommand: 'Back to Command',
    caseTitlePlaceholder: 'CASE TITLE',
    locationPlaceholder: 'LOCATION',
    narrativePlaceholder: 'NARRATIVE',
    evidenceAttachment: 'Evidence Attachment',
    involvedParties: 'Involved Parties',
    namePlaceholder: 'NAME',
    phonePlaceholder: 'PHONE',
    complainant: 'Complainant',
    suspect: 'Suspect',
    witness: 'Witness',
    addPerson: 'Add Person',
    syncingToRegistry: 'Syncing to Registry...',
    commitToRegistry: 'Commit to Registry',
    atLeastOnePartyRequired: 'AT LEAST ONE PARTY REQUIRED.',
    caseRegisteredSuccessfully: 'CASE REGISTERED SUCCESSFULLY',
    fileUploadFailed: 'File upload failed - check console for details',
    registryError: 'REGISTRY ERROR',
    documentArchiveTitle: 'Document Archive',
    filterIntelligencePlaceholder: 'Filter Intelligence...',
    addDocument: '+ Document',
    documentIdLabel: 'documentId',
    caseIdLabel: 'caseId',
    titleLabel: 'Title',
    typeFileName: 'type / File Name',
    storage: 'Storage',
    actions: 'Actions',
    unknownCase: 'UNKNOWN CASE',
    unknownStatus: 'Unknown Status',
    selectInvestigatorPlaceholder: 'Select Investigator...',
    assignLabel: 'Assign',
    assigningLabel: 'Assigning...',
    generateLabel: 'Gen',
    saveLabel: 'Save',
    pendingLabel: 'Pending...',
    viewLabel: 'View',
    syncFailed: 'Sync Failed',
    retryLabel: 'Retry',
    newDocumentUplink: 'New Document Uplink',
    storageLocation: 'storage location',
    typeofdocument: 'typeofdocument',
    documentTypeIdentification: 'Identification',
    documentTypeForensicReport: 'Forensic Report',
    documentTypeLegalWarrant: 'Legal Warrant',
    selectOrDragDocumentBinary: 'Select or Drag Document Binary',
    abort: 'Abort',
    submitEntry: 'Submit Entry',
    submitEntryFailed: 'Submit Entry Failed.',
    intelligenceAccessDeniedFileBinaryNotFound: 'Intelligence Access Denied: File binary not found.',
    uplinkFailureCouldNotDownload: 'Uplink Failure: Could not download document.',
    missingSelection: 'Missing Selection',
    unitAssignedSuccessfully: 'UNIT ASSIGNED SUCCESSFULLY',
    assignInvestigatorTitle: 'Assign Investigator',
    caseDossierLabel: 'Case Dossier',
    selectCasePlaceholder: '-- SELECT CASE --',
    investigatorLabel: 'Investigator',
    selectPersonnelPlaceholder: '-- SELECT PERSONNEL --',
    confirmAssignment: 'Confirm Assignment',
    decryptingPersonnelDatabase: 'Decrypting Personnel Database...',
    personnelManagement: 'Personnel Management',
    supervisorAuthorizationTerminal: 'Supervisor Authorization Terminal',
    officerIdentity: 'Officer Identity',
    currentClearance: 'Current Clearance',
    assignNewRole: 'Assign New Role',
    unknownOfficer: 'Unknown Officer',
    selectRolePlaceholder: 'Select Role...',
    roleInvestigator: 'Investigator',
    roleDeskOfficer: 'Desk Officer',
    roleSupervisor: 'Supervisor',
    systemUpdateClearanceReassigned: 'SYSTEM UPDATE: Clearance Level Reassigned.',
    accessDeniedInsufficientPrivileges: 'ACCESS DENIED: Insufficient Privileges.',
    userDirectory: 'User Directory',
    searchByUserOrCaseIdPlaceholder: 'SEARCH BY USER OR CASE ID...',
    addNewPersonnel: '+ Add New Personnel',
    personnelLabel: 'Personnel',
    assignedCaseLabel: 'Assigned Case',
    assignmentDateLabel: 'Assignment Date',
    activeLabel: 'Active',
    lockedLabel: 'Locked',
    editLabel: 'Edit',
    syncingPersonnelDatabase: 'Syncing Personnel Database...',
    authorizePersonnelTitle: 'Authorize Personnel',
    firstNamePlaceholder: 'FIRST NAME',
    lastNamePlaceholder: 'LAST NAME',
    usernamePlaceholder: 'USERNAME',
    caseAssignmentCaseIdPlaceholder: 'CASE ASSIGNMENT (CASE ID)',
    systemPasswordPlaceholder: 'SYSTEM PASSWORD',
    authorizeAccess: 'Authorize Access',
    keycloakCreationFailed: 'KEYCLOAK CREATION FAILED',
    personnelAuthorizedCaseAssigned: 'PERSONNEL AUTHORIZED & CASE ASSIGNED',
    evidenceVaultTitle: 'Evidence Vault',
    searchIdOrCasePlaceholder: 'SEARCH ID OR CASE...',
    registerIntelligence: '+ Register Intelligence',
    evidenceIdLabel: 'Evidence ID',
    caseIdPrefix: 'Case ID',
    evidenceTypeLabel: 'Evidence Type',
    intelligenceDescriptionLabel: 'Intelligence Description',
    noIntelligenceRecordsFound: 'No Intelligence Records Found',
    registerIntelligenceTitle: 'Register Intelligence',
    intelligenceTypeLabel: 'Intelligence Type',
    fileAttachmentLabel: 'File Attachment',
    clickToUploadIntelligenceFile: 'Click to Upload Intelligence File',
    describeCollectedIntelligencePlaceholder: 'DESCRIBE COLLECTED INTELLIGENCE...',
    secureEntry: 'Secure Entry',
    intelligenceSecuredSuccessfully: 'INTELLIGENCE SECURED SUCCESSFULLY',
    failedNoFileAttached: 'FAILED: NO FILE ATTACHED',
    failedServerTransmissionError: 'FAILED: SERVER TRANSMISSION ERROR',
    intelligenceDirectory: 'Intelligence Directory',
    showingResultsFor: 'Showing results for',
    scanningDatabase: 'Scanning Database...',
    general: 'GENERAL',
    noRecordsFound: 'No Records Found',
    pageNotFound: '404 - Page Not Found',
    sorryPageNotFound: 'Sorry, the page you are looking for does not exist.',
    goBackToDashboard: 'Go back to Dashboard',
    evidenceManagement: 'Evidence Management',
    loadingEvidences: 'Loading evidences...',
    noEvidenceRecordsFound: 'No evidence records found.',
    view: 'View',
    edit: 'Edit',
    sessionExpiredOrUnauthorized: 'ERROR: Session expired or Unauthorized. Please refresh the page and try again.',
    caseNotFound404: 'ERROR: Case not found (404). Refresh and try again.',
    errorSavingData: 'ERROR SAVING DATA',
    unableToViewDocument: 'Unable to view document. File may not be available.',
    unableToDownloadDocument: 'Unable to download document. File may not be available.',
    pleaseSelectFileToUpload: 'Please select a file to upload.',
    documentUploadedSuccessfully: 'Document uploaded successfully!',
    failedToUploadDocument: 'Failed to upload document. Please try again.',
    loadingCaseData: 'Loading Case Data...',
    idLabel: 'ID',
    seniorInvestigatorRankIV: 'Senior Investigator • Rank IV',
    securityClearanceTitle: 'Security Clearance',
    clearanceLevelLabel: 'Clearance Level',
    departmentLabel: 'Department',
    caseStatisticsTitle: 'Case Statistics',
    activeCasesLabel: 'Active Cases',
    totalClosuresLabel: 'Total Closures',
    descriptionLabel: 'Description',
    collectedByLabel: 'Collected By',
    adminPanel: 'Admin Panel',
    pcrManagement: 'PCR Management',
    cases: 'Cases',
    users: 'Users',
    administrator: 'Administrator',
    console: 'Console',
    signedInAs: 'Signed In As',
    filter: 'Filter',
    searchCasesPlaceholder: 'Search cases...',
    adminDashboardSubtitle: 'System statistics and case overview',
    adminCasesSubtitle: 'Total cases in the system',
    adminAssignedSubtitle: 'Assigned cases in the system',
    adminUsersSubtitle: 'Manage system users and permissions',
    syncingSupervisorConsole: 'SYNCING SUPERVISOR CONSOLE',
    syncingInvestigatorConsole: 'SYNCING INVESTIGATOR CONSOLE',
    supervisorSubtitle: 'Registered Case Registry • Investigator Assignment',
    investigatorSubtitle: 'Assigned Case Operations • Evidence Management • Field Reports',
    totalCaseLoad: 'Total Case Load',
    completion: 'Completion',
    actionRequired: 'Action Required',
    investigatorLoad: 'Investigator Load',
    searchByCaseTitleStatusPlaceholder: 'Search by case, title, status...',
    caseNumberUpdated: 'Case number updated',
    caseNumberUpdateFailed: 'Case number update failed',
  },
  am: {
    systemActive: 'ስርዓቱ ንቁ ነው',
    globalSearchPlaceholder: 'አለም አቀፍ ፍለጋ...',
    intelligenceAlerts: 'የመረጃ ማስጠንቀቂያዎች',
    clear: 'አጥፋ',
    caseUpdated: 'ጉዳይ ተዘምኗል',
    newCase: 'አዲስ ጉዳይ',
    noAlerts: 'ማስጠንቀቂያ የለም',
    logout: 'ውጣ',
    dashboard: 'ዳሽቦርድ',
    newCases: 'አዲስ ጉዳዮች',
    registerCase: 'ጉዳይ መመዝገብ',
    assignCases: 'ጉዳዮች መመደብ',
    documentArchive: 'የሰነድ ማህደር',
    justiceInformationSystem: 'የፍትህ መረጃ ስርዓት',
    authorized: 'ፈቃድ ያለው',
    language: 'ቋንቋ',
    theme: 'ገጽታ',
    brightMode: 'ብርሃን',
    darkMode: 'ጨለማ',
    caseDeployment: 'የጉዳይ ስራ ማስኬጃ',
    operationalHubTotalActivity: 'የስራ ማዕከል • ጠቅላላ እንቅስቃሴ',
    all: 'ሁሉም',
    merged: 'የተዋሃዱ',
    systemCommand: 'የስርዓት ትእዛዞች',
    new: 'አዲስ',
    inProgress: 'በሂደት ላይ',
    closed: 'የተዘጋ',
    total: 'ጠቅላላ',
    noActiveDeploymentsFound: 'ንቁ ጉዳዮች አልተገኙም',
    analyze: 'ተመርምር',
    newCaseFile: 'አዲስ የጉዳይ ፋይል',
    assignedCases: 'የተመደቡ ጉዳዮች',
    exportSummary: 'ማጠቃለያ ላክ',
    dailyIntelligenceExport: 'የዕለት ማጠቃለያ ላክ',
    todaysCaseSummary: 'የዛሬ የጉዳዮች ማጠቃለያ',
    close: 'ዝጋ',
    noCaseActivityToday: 'ዛሬ ምንም የጉዳይ እንቅስቃሴ አልተመዘገበም',
    newToday: 'ዛሬ አዲስ',
    inProgressToday: 'ዛሬ በሂደት ላይ',
    closedToday: 'ዛሬ የተዘጋ',
    totalCasesToday: 'የዛሬ ጠቅላላ ጉዳዮች',
    newCasesToday: 'የዛሬ አዲስ ጉዳዮች',
    inProgressCasesToday: 'የዛሬ በሂደት ላይ ጉዳዮች',
    closedCasesToday: 'የዛሬ የተዘጉ ጉዳዮች',
    summaryZeroDetail: 'ዛሬ አዲስ፣ በሂደት ላይ፣ የተዘጋ እና ጠቅላላ ቆጠራ ሁሉም ዜሮ ናቸው።',
    statusLabel: 'ሁኔታ',
    systemUplinkFailed: 'የስርዓት ግንኙነት አልተሳካም',
    retryConnection: 'ደግመው ሞክር',
    establishingEncryptedLink: 'የተመሰጠረ ግንኙነት በመጀመር ላይ...',
    file: 'ፋይል',
    caseNumber: 'የጉዳይ ቁጥር',
    caseLabel: 'ጉዳይ',
    analysisMode: 'የትንታኔ ሁኔታ',
    editSpecifics: 'ዝርዝር አስተካክል',
    discardChanges: 'ለውጦችን ተው',
    syncing: 'በማስመሳሰል ላይ...',
    confirmGlobalSync: 'ማስመሳሰል አረጋግጥ',
    operationalStatus: 'የስራ ሁኔታ',
    subjectIdentification: 'የጉዳይ ርዕስ',
    incidentLocation: 'የክስተት ቦታ',
    offenseClassification: 'የወንጀል አይነት',
    selectCaseType: 'የጉዳይ አይነት ምረጥ',
    theft: 'ስርቆት',
    fraud: 'ማጭበርበር',
    assault: 'ጥቃት',
    cybercrime: 'የሳይበር ወንጀል',
    dateOfIncident: 'የክስተቱ ቀን',
    notSpecified: 'አልተጠቀሰም',
    caseIntelligenceNarrative: 'የጉዳይ መረጃ እና ትርኢት',
    attachedDocuments: 'የተያያዙ ሰነዶች',
    uploadNewDocument: 'አዲስ ሰነድ ጫን',
    upload: 'ጫን',
    uploading: 'በመጫን ላይ...',
    selected: 'የተመረጠ',
    unnamedFile: 'ያልተሰየመ ፋይል',
    document: 'ሰነድ',
    viewDocument: 'ሰነድ ክፈት',
    download: 'አውርድ',
    noDocumentsAttached: 'ምንም ሰነድ አልተያያዘም',
    backToAdminConsole: 'ወደ አስተዳዳሪ መቆጣጠሪያ ተመለስ',
    returnToHub: 'ወደ ዳሽቦርድ ተመለስ',
    caseUpdatedSuccessfully: 'ጉዳዩ በተሳካ ሁኔታ ተዘምኗል',
    caseNotFound: 'ጉዳይ አልተገኘም',
    unableToLoadCaseData: 'የጉዳይ መረጃ መጫን አልተቻለም። እባክዎ መለያውን ያረጋግጡ።',
    untitledCase: 'ርዕስ ያልተሰጠ ጉዳይ',
    noDescription: 'መግለጫ የለም',
    systemGateway: 'የስርዓት መግቢያ',
    authorizingSession: 'ማረጋገጫ በሂደት ላይ...',
    verifiedDatabaseRecords: 'የተረጋገጡ የመረጃ ቋት መዝገቦች',
    newIntelligenceCases: 'አዲስ የመረጃ ጉዳዮች',
    filterNewCasesPlaceholder: 'አዲስ ጉዳዮችን አጣራ...',
    pendingDeployment: 'ምደባ በመጠባበቅ ላይ',
    deployed: 'ተመድቧል',
    personnelDeployment: 'የሰራተኞች ምደባ',
    systemRegistry: 'የስርዓት መዝገብ',
    activeDeployments: 'ንቁ ምደባዎች',
    pendingAssignments: 'በመጠባበቅ ላይ ምደባዎች',
    assigned: 'ተመድቧል',
    unassigned: 'ያልተመደበ',
    documents: 'ሰነዶች',
    searchAssignmentsPlaceholder: 'ምደባዎችን ፈልግ...',
    searchUnassignedCasesPlaceholder: 'ያልተመደቡ ጉዳዮችን ፈልግ...',
    searchDocumentsPlaceholder: 'ሰነዶችን ፈልግ...',
    assignNew: 'አዲስ መመደብ',
    activeOperation: 'ንቁ ኦፕሬሽን',
    unknown: 'ያልታወቀ',
    locLabel: 'ቦታ',
    typeLabel: 'አይነት',
    leadInvestigator: 'ዋና መርማሪ',
    deployedStatus: 'ተመድቧል',
    investigatorNotes: 'መርማሪ እና ማስታወሻ',
    noContactNumber: 'የመገናኛ ቁጥር አልተመዘገበም',
    noRecentActivityLogs: 'ምንም የቅርብ እንቅስቃሴ መዝገብ የለም።',
    saveUpdate: 'ማሻሻያ አስቀምጥ',
    modifyLead: 'መሪ ቀይር',
    fullDossier: 'ሙሉ መረጃ →',
    lastUpdated: 'መጨረሻ የተዘመነ',
    noActiveAssignmentsFound: 'ንቁ ምደባዎች አልተገኙም',
    noUnassignedCasesFound: 'ያልተመደቡ ጉዳዮች አልተገኙም',
    noAssignedCasesFound: 'የተመደቡ ጉዳዮች አልተገኙም',
    noCasesFound: 'ምንም ጉዳዮች አልተገኙም',
    refreshRegistry: 'መዝገቡን አድስ',
    noDocumentsFound: 'ሰነዶች አልተገኙም',
    caseRegistration: 'ጉዳይ መመዝገብ',
    backToCommand: 'ወደ ትእዛዝ ተመለስ',
    caseTitlePlaceholder: 'የጉዳይ ርዕስ',
    locationPlaceholder: 'ቦታ',
    narrativePlaceholder: 'ትርኢት',
    evidenceAttachment: 'የማስረጃ ተያያዥ',
    involvedParties: 'ተሳታፊ አካላት',
    namePlaceholder: 'ስም',
    phonePlaceholder: 'ስልክ',
    complainant: 'ከሳሽ',
    suspect: 'ተጠርጣሪ',
    witness: 'ምስክር',
    addPerson: 'ሰው ጨምር',
    syncingToRegistry: 'ወደ መዝገብ በማስመሳሰል ላይ...',
    commitToRegistry: 'ወደ መዝገብ አስገባ',
    atLeastOnePartyRequired: 'ቢያንስ አንድ ተሳታፊ ያስፈልጋል።',
    caseRegisteredSuccessfully: 'ጉዳዩ በተሳካ ሁኔታ ተመዝግቧል',
    fileUploadFailed: 'ፋይል መጫን አልተሳካም፤ ኮንሶል ይመልከቱ',
    registryError: 'የመዝገብ ስህተት',
    documentArchiveTitle: 'የሰነድ ማህደር',
    filterIntelligencePlaceholder: 'መረጃ አጣራ...',
    addDocument: '+ ሰነድ',
    documentIdLabel: 'የሰነድ መለያ',
    caseIdLabel: 'የጉዳይ መለያ',
    titleLabel: 'ርዕስ',
    typeFileName: 'አይነት / ፋይል ስም',
    storage: 'ማከማቻ',
    actions: 'እርምጃዎች',
    unknownCase: 'ያልታወቀ ጉዳይ',
    unknownStatus: 'ያልታወቀ ሁኔታ',
    selectInvestigatorPlaceholder: 'መርማሪ ይምረጡ...',
    assignLabel: 'መመደብ',
    assigningLabel: 'በመመደብ ላይ...',
    generateLabel: 'ፍጠር',
    saveLabel: 'አስቀምጥ',
    pendingLabel: 'በመጠባበቅ ላይ...',
    viewLabel: 'አሳይ',
    syncFailed: 'ማመሳሰል አልተሳካም',
    retryLabel: 'ደግመው ሞክር',
    newDocumentUplink: 'አዲስ የሰነድ ጭነት',
    storageLocation: 'የማከማቻ ቦታ',
    typeofdocument: 'የሰነድ አይነት',
    documentTypeIdentification: 'መለያ',
    documentTypeForensicReport: 'ፎሬንሲክ ሪፖርት',
    documentTypeLegalWarrant: 'ሕጋዊ ፈቃድ',
    selectOrDragDocumentBinary: 'ሰነድ ይምረጡ ወይም ይጎትቱ',
    abort: 'ተው',
    submitEntry: 'አስገባ',
    submitEntryFailed: 'መላክ አልተሳካም።',
    intelligenceAccessDeniedFileBinaryNotFound: 'መዳረሻ ተከልክሏል፡ ፋይሉ አልተገኘም።',
    uplinkFailureCouldNotDownload: 'መውረድ አልተቻለም።',
    missingSelection: 'ምርጫ ይጎድላል',
    unitAssignedSuccessfully: 'ምደባ በተሳካ ሁኔታ ተፈጽሟል',
    assignInvestigatorTitle: 'መርማሪ መመደብ',
    caseDossierLabel: 'የጉዳይ ፋይል',
    selectCasePlaceholder: '-- ጉዳይ ምረጥ --',
    investigatorLabel: 'መርማሪ',
    selectPersonnelPlaceholder: '-- ሰራተኛ ምረጥ --',
    confirmAssignment: 'ምደባ አረጋግጥ',
    decryptingPersonnelDatabase: 'የሰራተኞች መረጃ በመፍታት ላይ...',
    personnelManagement: 'የሰራተኞች አስተዳደር',
    supervisorAuthorizationTerminal: 'የአስተዳዳሪ ፍቃድ መስኮት',
    officerIdentity: 'የሰራተኛ መለያ',
    currentClearance: 'ያለው የፍቃድ ደረጃ',
    assignNewRole: 'አዲስ ሚና መመደብ',
    unknownOfficer: 'ያልታወቀ ሰራተኛ',
    selectRolePlaceholder: 'ሚና ምረጥ...',
    roleInvestigator: 'መርማሪ',
    roleDeskOfficer: 'የጽ/ቤት ባለሙያ',
    roleSupervisor: 'አስተዳዳሪ',
    systemUpdateClearanceReassigned: 'የስርዓት ማሻሻያ፡ የፍቃድ ደረጃ ተቀይሯል።',
    accessDeniedInsufficientPrivileges: 'መዳረሻ ተከልክሏል፡ በቂ ፍቃድ የለም።',
    userDirectory: 'የተጠቃሚ ማውጫ',
    searchByUserOrCaseIdPlaceholder: 'በተጠቃሚ ወይም በጉዳይ መለያ ፈልግ...',
    addNewPersonnel: '+ አዲስ ሰራተኛ ጨምር',
    personnelLabel: 'ሰራተኞች',
    assignedCaseLabel: 'የተመደበ ጉዳይ',
    assignmentDateLabel: 'የምደባ ቀን',
    activeLabel: 'ንቁ',
    lockedLabel: 'ተቆልፏል',
    editLabel: 'አስተካክል',
    syncingPersonnelDatabase: 'የሰራተኞች መረጃ በማስመሳሰል ላይ...',
    authorizePersonnelTitle: 'ሰራተኛ ፍቃድ መስጠት',
    firstNamePlaceholder: 'የመጀመሪያ ስም',
    lastNamePlaceholder: 'የአባት ስም',
    usernamePlaceholder: 'የተጠቃሚ ስም',
    caseAssignmentCaseIdPlaceholder: 'የጉዳይ ምደባ (መለያ)',
    systemPasswordPlaceholder: 'የስርዓት የይለፍ ቃል',
    authorizeAccess: 'መዳረሻ ፍቃድ ስጥ',
    keycloakCreationFailed: 'ኪክሎክ ፍጠር አልተሳካም',
    personnelAuthorizedCaseAssigned: 'ሰራተኛ ተፈቅዷል እና ጉዳይ ተመድቧል',
    evidenceVaultTitle: 'የማስረጃ ማህደር',
    searchIdOrCasePlaceholder: 'በመለያ ወይም በጉዳይ ፈልግ...',
    registerIntelligence: '+ መረጃ መመዝገብ',
    evidenceIdLabel: 'የማስረጃ መለያ',
    caseIdPrefix: 'የጉዳይ መለያ',
    evidenceTypeLabel: 'የማስረጃ አይነት',
    intelligenceDescriptionLabel: 'የመረጃ መግለጫ',
    noIntelligenceRecordsFound: 'የመረጃ መዝገቦች አልተገኙም',
    registerIntelligenceTitle: 'መረጃ መመዝገብ',
    intelligenceTypeLabel: 'የመረጃ አይነት',
    fileAttachmentLabel: 'ፋይል ተያያዥ',
    clickToUploadIntelligenceFile: 'የመረጃ ፋይል ለመጫን ይጫኑ',
    describeCollectedIntelligencePlaceholder: 'የተሰበሰበ መረጃ ይግለጹ...',
    secureEntry: 'አስገባ',
    intelligenceSecuredSuccessfully: 'መረጃ በተሳካ ሁኔታ ተመዝግቧል',
    failedNoFileAttached: 'አልተሳካም፡ ፋይል አልተያያዘም',
    failedServerTransmissionError: 'አልተሳካም፡ የሰርቨር ስህተት',
    intelligenceDirectory: 'የመረጃ ማውጫ',
    showingResultsFor: 'ውጤቶች ለ',
    scanningDatabase: 'ዳታቤዝ በመፈተሽ ላይ...',
    general: 'አጠቃላይ',
    noRecordsFound: 'መዝገቦች አልተገኙም',
    pageNotFound: '404 - ገጹ አልተገኘም',
    sorryPageNotFound: 'ይቅርታ፣ የፈለጉት ገጽ አልተገኘም።',
    goBackToDashboard: 'ወደ ዳሽቦርድ ተመለስ',
    evidenceManagement: 'የማስረጃ አስተዳደር',
    loadingEvidences: 'ማስረጃዎች በመጫን ላይ...',
    noEvidenceRecordsFound: 'የማስረጃ መዝገቦች የሉም።',
    view: 'ክፈት',
    edit: 'አስተካክል',
    sessionExpiredOrUnauthorized: 'ስህተት፡ ሴሽኑ አብቅቷል ወይም ፍቃድ የለም። እባክዎ ገጹን ያድሱ እና ደግመው ይሞክሩ።',
    caseNotFound404: 'ስህተት፡ ጉዳይ አልተገኘም (404)። ያድሱ እና ደግመው ይሞክሩ።',
    errorSavingData: 'መረጃ በማስቀመጥ ላይ ስህተት',
    unableToViewDocument: 'ሰነዱን ማየት አልተቻለም። ፋይሉ ሊያልቅ ይችላል።',
    unableToDownloadDocument: 'ሰነዱን ማውረድ አልተቻለም። ፋይሉ ሊያልቅ ይችላል።',
    pleaseSelectFileToUpload: 'ለመጫን ፋይል ይምረጡ።',
    documentUploadedSuccessfully: 'ሰነድ በተሳካ ሁኔታ ተጫኗል!',
    failedToUploadDocument: 'ሰነድ መጫን አልተሳካም። እባክዎ ደግመው ይሞክሩ።',
    loadingCaseData: 'የጉዳይ መረጃ በመጫን ላይ...',
    idLabel: 'መለያ',
    seniorInvestigatorRankIV: 'ከፍተኛ መርማሪ • ደረጃ IV',
    securityClearanceTitle: 'የደህንነት ፍቃድ',
    clearanceLevelLabel: 'የፍቃድ ደረጃ',
    departmentLabel: 'ክፍል',
    caseStatisticsTitle: 'የጉዳይ ስታቲስቲክስ',
    activeCasesLabel: 'ንቁ ጉዳዮች',
    totalClosuresLabel: 'ጠቅላላ የተዘጉ',
    descriptionLabel: 'መግለጫ',
    collectedByLabel: 'የሰበሰበው',
    adminPanel: 'አድሚን ማእከል',
    pcrManagement: 'PCR አስተዳደር',
    cases: 'ጉዳዮች',
    users: 'ተጠቃሚዎች',
    administrator: 'አስተዳዳሪ',
    console: 'ማእከል',
    signedInAs: 'ገብተዋል እንደ',
    filter: 'አጣራ',
    searchCasesPlaceholder: 'ጉዳዮችን ፈልግ...',
    adminDashboardSubtitle: 'የስርዓቱ ስታቲስቲክስ እና የጉዳይ እይታ',
    adminCasesSubtitle: 'በስርዓቱ ውስጥ ያሉ ጉዳዮች',
    adminAssignedSubtitle: 'በስርዓቱ ውስጥ የተመደቡ ጉዳዮች',
    adminUsersSubtitle: 'ተጠቃሚዎችን እና ፍቃዶችን አስተዳድር',
    syncingSupervisorConsole: 'የአስተዳዳሪ ማእከል በማስመሳሰል ላይ...',
    syncingInvestigatorConsole: 'የመርማሪ ማእከል በማስመሳሰል ላይ...',
    supervisorSubtitle: 'የተመዘገበ ጉዳይ መዝገብ • መርማሪ መመደብ',
    investigatorSubtitle: 'የተመደበ ጉዳይ ኦፕሬሽን • ማስረጃ አስተዳደር • የመስክ ሪፖርቶች',
    totalCaseLoad: 'ጠቅላላ የጉዳይ መጠን',
    completion: 'መጠናቀቅ',
    actionRequired: 'እርምጃ ያስፈልጋል',
    investigatorLoad: 'የመርማሪ ጫና',
    searchByCaseTitleStatusPlaceholder: 'በጉዳይ፣ ርዕስ ወይም ሁኔታ ፈልግ...',
    caseNumberUpdated: 'የጉዳይ ቁጥር ተዘምኗል',
    caseNumberUpdateFailed: 'የጉዳይ ቁጥር ማዘመን አልተሳካም',
  },
};

export const t = (language: LanguageCode, key: TranslationKey) => {
  return translations[language]?.[key] ?? translations.en[key];
};

interface PreferencesState {
  theme: ThemeMode;
  language: LanguageCode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: LanguageCode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'en',
      setTheme: theme => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLanguage: language => set({ language }),
    }),
    {
      name: 'pcrs_preferences',
      version: 1,
      partialize: state => ({ theme: state.theme, language: state.language }),
    },
  ),
);
