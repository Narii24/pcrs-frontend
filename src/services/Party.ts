export interface Party {
  partyId: string;
  fullName: string;
  phoneNumber: number; // Must be number for Java Long
  partyType: string;
  caseId: string;
}

export const preparePartyForServer = (party: any): any => {
  return {
    partyId: party.partyId,
    fullName: (party.fullName || '').trim().toUpperCase(),
    // Convert string input to actual number for the Database
    phoneNumber: Number(party.phoneNumber) || 0,
    partyType: party.partyType,
    // Ensure caseId is passed correctly
    caseId: party.caseId 
  };
};