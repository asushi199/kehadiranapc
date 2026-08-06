export interface LiveAttendanceRow {
  participantId: string;
  bil: number;
  counterNo: number;
  name: string;
  organization: string;
  seatNo: number;
  checked: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
}

export function getConfirmedRows(rows: LiveAttendanceRow[]): LiveAttendanceRow[] {
  return rows
    .filter((row) => row.confirmed)
    .sort((left, right) => left.bil - right.bil);
}
