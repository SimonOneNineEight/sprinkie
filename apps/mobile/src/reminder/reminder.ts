import * as Notifications from 'expo-notifications';

import { localDateString } from '../calendar/monthMath';
import { versionedStore } from '../storage/versionedStore';

// The Reminder (GLOSSARY.md, spec #135): one daily local notification,
// scheduled by this phone (ADR-0002 amendment). This module owns all of it:
// the stored setting, notification permission, scheduling and cancelling.
// Screens go through ReminderProvider; nothing else touches
// expo-notifications.

export type ReminderTime = { hour: number; minute: number };
export type ReminderSetting = ReminderTime & { on: boolean };
/** iOS's answer: granted, may still be asked, or never asks again. */
export type ReminderPermission = 'granted' | 'askable' | 'blocked';
export type TurnOnResult = 'on' | 'refused' | 'blocked';
/** The notification's text, in the App Language at scheduling time. */
export type ReminderCopy = { title: string; body: string };
export type ReminderState = { setting: ReminderSetting; permission: ReminderPermission };

export const defaultSetting: ReminderSetting = { on: false, hour: 21, minute: 0 };

/** Today at `time`, for the time pickers, which hold a Date. */
export function timeAsDate({ hour, minute }: ReminderTime): Date {
  const at = new Date();
  at.setHours(hour, minute, 0, 0);
  return at;
}

/** The time of day a picked Date names. */
export function dateAsTime(date: Date): ReminderTime {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

// One Reminder per day, scheduled individually rather than as one repeating
// notification, so a single day can be left out. 60 stays well inside iOS's
// 64 pending notifications per app.
const runLength = 60;

// Per device, like the App Language override: forgotten when the session
// ends, so the next person on the phone starts with it off.
type Store = { v: 1; on: boolean; hour: number; minute: number };

const store = versionedStore<ReminderSetting>({
  key: 'reminder.v1',
  fallback: defaultSetting,
  decode: (envelope) => {
    const parsed = envelope as Store;
    const valid =
      parsed.v === 1 &&
      typeof parsed.on === 'boolean' &&
      Number.isInteger(parsed.hour) &&
      Number.isInteger(parsed.minute);
    return valid ? { on: parsed.on, hour: parsed.hour, minute: parsed.minute } : null;
  },
  encode: ({ on, hour, minute }) => ({ v: 1, on, hour, minute }),
});

// The last day this phone read as holding an Entry (#137), so a launch that
// cannot read today (offline) still leaves a written today without its
// Reminder. Only ever compared with today, so a past day reads as unwritten.
type WrittenDayEnvelope = { v: 1; day: string | null };

const writtenDayStore = versionedStore<string | null>({
  key: 'reminderWrittenDay.v1',
  fallback: null,
  decode: (envelope) => {
    const parsed = envelope as WrittenDayEnvelope;
    return parsed.v === 1 && (parsed.day === null || typeof parsed.day === 'string')
      ? parsed.day
      : null;
  },
  encode: (day) => ({ v: 1, day }),
});

/** Remembers whether `today` (YYYY-MM-DD) holds an Entry, as just read. */
export async function rememberToday(today: string, written: boolean): Promise<void> {
  if (written) await writtenDayStore.save(today);
  else if ((await writtenDayStore.load()) === today) await writtenDayStore.save(null);
}

/** `today` if it was last known to hold an Entry, for when it cannot be read. */
export async function lastKnownWritten(today: string): Promise<string | undefined> {
  return (await writtenDayStore.load()) === today ? today : undefined;
}

// Every operation rebuilds the pending run from scratch; run one at a time
// so a launch re-sync and a tap on the switch never interleave into
// duplicates.
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function permissionOf(answer: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (answer.granted) return 'granted';
  return answer.canAskAgain ? 'askable' : 'blocked';
}

async function readPermission(): Promise<ReminderPermission> {
  return permissionOf(await Notifications.getPermissionsAsync());
}

/** The next `runLength` daily firings strictly after now. */
function firings({ hour, minute }: ReminderTime): Date[] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  const offset = first.getTime() > now.getTime() ? 0 : 1;
  return Array.from(
    { length: runLength },
    (_, i) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + i, hour, minute),
  );
}

/**
 * `writtenDay` (YYYY-MM-DD) is today when today already holds an Entry
 * (#137): that day gets no Reminder. Any other day passed is never a firing.
 */
async function rebuild(
  state: ReminderState,
  copy: ReminderCopy,
  writtenDay?: string,
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.setting.on || state.permission !== 'granted') return;
  for (const date of firings(state.setting)) {
    if (localDateString(date) === writtenDay) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${localDateString(date)}`,
      content: { title: copy.title, body: copy.body, data: reminderMarker },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

/** Reads the setting and permission, and rebuilds the run to match them. */
export function resyncReminder(copy: ReminderCopy, writtenDay?: string): Promise<ReminderState> {
  return serially(async () => {
    const state = { setting: await store.load(), permission: await readPermission() };
    await rebuild(state, copy, writtenDay);
    return state;
  });
}

/**
 * Turns the Reminder on at `time`, asking iOS only if it still may. A refusal
 * at the prompt, or permission already blocked, leaves it off.
 */
export function turnOnReminder(
  time: ReminderTime,
  copy: ReminderCopy,
  writtenDay?: string,
): Promise<{ result: TurnOnResult; state: ReminderState }> {
  return serially(async () => {
    const setting = await store.load();
    let permission = await readPermission();
    if (permission === 'askable') {
      permission = permissionOf(await Notifications.requestPermissionsAsync());
      if (permission !== 'granted') {
        return { result: 'refused' as const, state: { setting, permission } };
      }
    }
    if (permission === 'blocked') {
      return { result: 'blocked' as const, state: { setting, permission } };
    }
    const state = { setting: { ...time, on: true }, permission };
    await store.save(state.setting);
    await rebuild(state, copy, writtenDay);
    return { result: 'on' as const, state };
  });
}

/** Turns the Reminder off and cancels every pending one; the time is kept. */
export function turnOffReminder(): Promise<ReminderState> {
  return serially(async () => {
    const state = {
      setting: { ...(await store.load()), on: false },
      permission: await readPermission(),
    };
    await store.save(state.setting);
    await Notifications.cancelAllScheduledNotificationsAsync();
    return state;
  });
}

/** Moves every pending Reminder to `time`. */
export function changeReminderTime(
  time: ReminderTime,
  copy: ReminderCopy,
  writtenDay?: string,
): Promise<ReminderState> {
  return serially(async () => {
    const state = {
      setting: { ...(await store.load()), ...time },
      permission: await readPermission(),
    };
    await store.save(state.setting);
    await rebuild(state, copy, writtenDay);
    return state;
  });
}

// What a Reminder carries, so a tap on it is told apart from any other
// notification (#140).
const reminderMarker = { kind: 'reminder' };

const isReminder = (response: Notifications.NotificationResponse | null) =>
  response?.notification.request.content.data?.kind === reminderMarker.kind;

/**
 * Shows a Reminder that arrives while Sprinkie is open as a banner, and calls
 * `onTap` for a tap on one: the tap that launched Sprinkie, or one while it
 * runs (#140). A handled tap is cleared so a later launch never replays it.
 * Returns the unsubscribe.
 */
export function watchReminders(onTap: () => void): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!isReminder(response)) return;
    Notifications.clearLastNotificationResponse();
    onTap();
  };
  handle(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

/** The session ended: cancel every Reminder and forget the setting. */
export function clearReminder(): Promise<void> {
  return serially(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await store.remove();
    await writtenDayStore.remove();
  });
}
