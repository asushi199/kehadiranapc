const NAME_SEPARATOR_PATTERN = /\s+/g;
const IC_SEPARATOR_PATTERN = /[\s-]/g;

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('ms-MY')
    .replace(/['’‘]/g, '')
    .replace(/@/g, ' A ')
    .replace(/\bA\s*\/\s*([LP])\b/g, 'A$1')
    .replace(NAME_SEPARATOR_PATTERN, ' ');
}

export function normalizeIc(value: string): string {
  return value.replace(IC_SEPARATOR_PATTERN, '');
}

export function isCompleteIc(value: string): boolean {
  return /^\d{12}$/.test(normalizeIc(value));
}

export function maskIc(last4: string): string {
  return `******-**-${last4}`;
}
