import type { DashboardRow } from '@/lib/data/dashboard';

export type DashboardStatus = 'all' | 'confirmed' | 'checked' | 'unconfirmed';

export interface DashboardFilters {
  q: string;
  counter: number;
  status: DashboardStatus;
}

export function normalizeDashboardFilters(
  query: string | undefined,
  counterValue: string | undefined,
  statusValue: string | undefined,
): DashboardFilters {
  const counter = Number(counterValue);
  const status: DashboardStatus = ['confirmed', 'checked', 'unconfirmed'].includes(statusValue ?? '')
    ? (statusValue as DashboardStatus)
    : 'all';

  return {
    q: query?.trim().toUpperCase() ?? '',
    counter: Number.isInteger(counter) && counter >= 1 && counter <= 6 ? counter : 0,
    status,
  };
}

export function filterDashboardRows(rows: DashboardRow[], filters: DashboardFilters): DashboardRow[] {
  return rows.filter((row) => {
    const matchesQuery =
      !filters.q ||
      row.name.toUpperCase().includes(filters.q) ||
      row.organization.toUpperCase().includes(filters.q) ||
      String(row.bil) === filters.q;
    const matchesCounter = !filters.counter || row.counterNo === filters.counter;
    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'confirmed' && row.confirmed) ||
      (filters.status === 'checked' && row.checked && !row.confirmed) ||
      (filters.status === 'unconfirmed' && !row.confirmed);

    return matchesQuery && matchesCounter && matchesStatus;
  });
}
