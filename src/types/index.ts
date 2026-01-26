export interface UserDTO {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  createdAt: string; // ISO string for LocalDateTime
  isActive: boolean;
}

export interface CaseDTO {
  caseId: string;
  caseNumber: number;
  title: string;
  registrationDate: string; // ISO string for LocalDate
  caseType: string;
  caseDescription: string;
  currentStatus: string;
  location: string;
  registeredByUserId: string;
  assignedInvestigatorId: string | null;
}

export interface DocumentDTO {
  documentId: string;
  caseId: string;
  typeOfDocument: string;
  documentUpload: string;
  viewTheUploadedDocument: string;
  date: string; // ISO string
  digitalFilePath: string;
  fileName: string;
  locationOfTheStorage: string;
}

export interface EvidenceDTO {
  evidenceId: string;
  caseId: string;
  type: string;
  description: string;
  collectedByUserId: string;
}

export interface InvestigatorLogDTO {
  investigatorId: string;
  caseId: string;
  date: string; // ISO string
  updateDetails: string;
}

export interface PartyDTO {
  partyId: string;
  caseId: string;
  fullName: string;
  phoneNumber: number;
  partyType: string;
}

export interface AssignedCaseDTO {
  assignmentId: number;
  caseId: string;
  userId: string;
  assignedDate: string; // ISO string
}

// For Keycloak user info (from JWT claims)
export interface UserInfo {
  sub: string; // userId
  preferred_username: string;
  name: string;
  roles: string[]; // e.g., ['ADMIN']
}