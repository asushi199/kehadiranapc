import type { AttendanceStatus, ConfirmationSource } from '@/types/database';

export type ParticipantCheckStatus = 'Belum Semak' | 'Telah Semak' | 'Hadir Disahkan';

export interface PublicSearchSuggestion {
  selectionToken: string;
  name: string;
  organization: string;
  icLast4: string;
}

export interface PublicParticipantResult {
  lookupToken: string;
  name: string;
  organization: string;
  bil: number;
  seatNo: number;
  counterNo: number;
  maskedIc: string;
  status: ParticipantCheckStatus;
  confirmedAt: string | null;
}

export interface AdminParticipantRow {
  participantId: string;
  bil: number;
  name: string;
  organization: string;
  seatNo: number;
  counterNo: number;
  firstLookupAt: string | null;
  attendanceStatus: AttendanceStatus;
  attendanceConfirmedAt: string | null;
  confirmationSource: ConfirmationSource | null;
}
