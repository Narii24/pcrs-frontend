// src/types/PcrsDocument.ts

export interface IPcrsDocument {
  documentId: string;           // Matches "DocumentID" in DB
  caseId: string;               // Matches "caseID" in DB
  typeOfDocument: string;       // Matches "type_of_document"
  documentUpload?: string;
  viewTheUploadedDocument?: string;
  date: string;                 // Matches LocalDate (YYYY-MM-DD)
  digitalFilePath: string;      // Matches "digital_file_path"
  fileName: string;             // Matches "file_name"
  locationOfTheStorage?: string;
}

export class PcrsDocument implements IPcrsDocument {
  documentId: string;
  caseId: string;
  typeOfDocument: string;
  digitalFilePath: string;
  fileName: string;
  date: string;

  constructor(data: Partial<IPcrsDocument>) {
    this.documentId = data.documentId || '';
    this.caseId = data.caseId || '';
    this.typeOfDocument = data.typeOfDocument || 'General';
    this.digitalFilePath = data.digitalFilePath || '';
    this.fileName = data.fileName || '';
    this.date = data.date || new Date().toISOString().split('T')[0];
  }
}