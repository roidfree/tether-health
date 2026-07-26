import type { DashboardLog } from './api';

export const STATUS_KEYS = {
  taken: 'statusTaken',
  missed: 'statusMissed',
} as const;

export type PastLog = DashboardLog & { status: keyof typeof STATUS_KEYS };

// Anything responded to more than this many minutes after it was due counts
// as "late" rather than "on time" - matches the reference theme's History
// timeline distinguishing the two instead of a flat taken/missed split.
export const LATE_THRESHOLD_MINUTES = 15;

export function dayLabel(date: Date, t: (key: 'todayLabel' | 'yesterdayLabel') => string): string {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return t('todayLabel');
  if (diffDays === 1) return t('yesterdayLabel');
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export function minutesLate(log: PastLog): number {
  if (log.status !== 'taken' || !log.responded_at) return 0;
  return Math.round((new Date(log.responded_at).getTime() - new Date(log.scheduled_for).getTime()) / 60000);
}
