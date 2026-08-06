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

export function getCounterRows(rows: LiveAttendanceRow[], counterNo: number): LiveAttendanceRow[] {
  return rows
    .filter((row) => row.counterNo === counterNo)
    .sort((left, right) => Number(right.confirmed) - Number(left.confirmed) || left.bil - right.bil);
}
