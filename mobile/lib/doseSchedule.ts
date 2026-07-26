import type { DashboardLog, Medication } from './api';

// Builds "today's doses" - every scheduled time for today, past/present/future,
// merged with whatever real medication_logs already exist so each slot shows
// its true status (matches the reference theme's Home screen "Today's doses"
// list). This is a read/act view of the day's plan; it's independent of the
// History tab, which keeps showing the full past record regardless of date -
// a dose taken today intentionally shows up in both places.
export type DoseSlot = {
  key: string;
  medicationId: string;
  medicationName: string;
  dosage?: string | null;
  time: string; // "HH:MM" - the originally *scheduled* time, for the doses list.
  // The time the next call will actually happen: the original scheduled
  // time, unless the dose has been snoozed to a later callback (snoozed_until),
  // in which case that later time is what's actually next - showing the
  // stale original time here was the bug where the hero card kept
  // displaying an already-passed clock time after a snooze pushed the real
  // callback later.
  nextCallAt: Date;
  // Slots carried over from a previous day (still pending/snoozed and never
  // resolved) show their original date instead of just today's time.
  label: string;
  status: 'taken' | 'missed' | 'pending' | 'snoozed' | 'upcoming';
  log?: DashboardLog;
  isToday: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeLabel(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildTodaysDoses(medications: Medication[], logs: DashboardLog[]): DoseSlot[] {
  const now = new Date();
  const todayDow = now.getDay(); // 0=Sunday..6=Saturday, matches days_of_week's convention
  const todayString = now.toDateString();

  // Index resolvable logs by medication + local calendar day + HH:MM, so each
  // scheduled slot can be matched back to the real row the scheduler created
  // for it (medication_logs.scheduled_for is set to that exact wall-clock
  // moment - see backend/app/scheduler.py).
  const logByKey = new Map<string, DashboardLog>();
  for (const log of logs) {
    const d = new Date(log.scheduled_for);
    logByKey.set(`${log.medication_id}|${d.toDateString()}|${timeLabel(d)}`, log);
  }

  const todaySlots: DoseSlot[] = [];

  for (const medication of medications) {
    if (!medication.active) continue;
    const days = medication.days_of_week ?? [];
    if (days.length && !days.includes(todayDow)) continue;

    for (const time of medication.scheduled_times) {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hours || 0, minutes || 0, 0, 0);

      const log = logByKey.get(`${medication.id}|${scheduled.toDateString()}|${time}`);
      // Due but the scheduler hasn't created the log yet is a sub-20-second
      // race - fold it into "upcoming" rather than inventing a third look
      // for a gap nobody will actually see in practice.
      const status: DoseSlot['status'] = log && !(log.status === 'pending' && scheduled > now) ? log.status : 'upcoming';

      const nextCallAt = status === 'snoozed' && log?.snoozed_until ? new Date(log.snoozed_until) : scheduled;

      todaySlots.push({
        key: log?.id ?? `${medication.id}-${time}`,
        medicationId: medication.id,
        medicationName: medication.name,
        dosage: medication.dosage,
        time,
        nextCallAt,
        label: time,
        status,
        log,
        isToday: true,
      });
    }
  }
  // Sorted by the *effective* next-call time, not the original scheduled
  // time - a dose snoozed to later than another still-pending dose should
  // no longer sort ahead of it.
  todaySlots.sort((a, b) => a.nextCallAt.getTime() - b.nextCallAt.getTime());

  // Anything still pending/snoozed from a previous day (a callback that never
  // got resolved) stays actionable rather than silently disappearing once
  // it's no longer "today" - shown first, labelled with its real date.
  const carriedOver: DoseSlot[] = logs
    .filter(
      (log) => (log.status === 'pending' || log.status === 'snoozed') && new Date(log.scheduled_for).toDateString() !== todayString
    )
    .map((log) => {
      const d = new Date(log.scheduled_for);
      const nextCallAt = log.status === 'snoozed' && log.snoozed_until ? new Date(log.snoozed_until) : d;
      return {
        key: log.id,
        medicationId: log.medication_id,
        medicationName: log.medication_name,
        time: timeLabel(d),
        nextCallAt,
        label: d.toLocaleString(),
        status: log.status,
        log,
        isToday: false,
      };
    });

  return [...carriedOver, ...todaySlots];
}

export function countDoneToday(slots: DoseSlot[]): { done: number; total: number } {
  const today = slots.filter((slot) => slot.isToday);
  return { done: today.filter((slot) => slot.status === 'taken').length, total: today.length };
}

// The next unresolved dose today, for the "NEXT CALL" hero card (reference
// theme's Home screen) - the earliest today's-slot that isn't already
// taken/missed. `todaySlots` is sorted by effective next-call time, so the
// first match here is genuinely the next one to actually happen.
export function getNextDose(slots: DoseSlot[]): DoseSlot | undefined {
  return slots.find((slot) => slot.isToday && (slot.status === 'pending' || slot.status === 'snoozed' || slot.status === 'upcoming'));
}

// "2h 15m" / "45m" style countdown to a real moment in time - only
// meaningful when that moment is still in the future.
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const diffMinutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
