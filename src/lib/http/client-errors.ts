export const networkErrorMessage = 'Sambungan rangkaian terputus. Semak internet dan cuba lagi.';

export function getClientErrorMessage(error: unknown, fallback = 'Tindakan gagal. Cuba lagi.'): string {
  if (error instanceof TypeError) return networkErrorMessage;
  return error instanceof Error ? error.message : fallback;
}
