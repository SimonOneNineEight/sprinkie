import * as Notifications from 'expo-notifications';

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

// Every operation rebuilds the pending run from scratch; run one at a time
// so a launch re-sync and a tap on the switch never interleave into
// duplicates.
let queue: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function readPermission(): Promise<ReminderPermission> {
  const answer = await Notifications.getPermissionsAsync();
  if (answer.granted) return 'granted';
  return answer.canAskAgain ? 'askable' : 'blocked';
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

function dayKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

async function rebuild(state: ReminderState, copy: ReminderCopy): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.setting.on || state.permission !== 'granted') return;
  for (const date of firings(state.setting)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `reminder-${dayKey(date)}`,
      content: { title: copy.title, body: copy.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

/** Reads the setting and permission, and rebuilds the run to match them. */
export function resyncReminder(copy: ReminderCopy): Promise<ReminderState> {
  return serially(async () => {
    const state = { setting: await store.load(), permission: await readPermission() };
    await rebuild(state, copy);
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
): Promise<{ result: TurnOnResult; state: ReminderState }> {
  return serially(async () => {
    const setting = await store.load();
    let permission = await readPermission();
    if (permission === 'askable') {
      const answer = await Notifications.requestPermissionsAsync();
      permission = answer.granted ? 'granted' : answer.canAskAgain ? 'askable' : 'blocked';
      if (permission !== 'granted') {
        return { result: 'refused' as const, state: { setting, permission } };
      }
    }
    if (permission === 'blocked') {
      return { result: 'blocked' as const, state: { setting, permission } };
    }
    const state = { setting: { ...time, on: true }, permission };
    await store.save(state.setting);
    await rebuild(state, copy);
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
export function changeReminderTime(time: ReminderTime, copy: ReminderCopy): Promise<ReminderState> {
  return serially(async () => {
    const state = {
      setting: { ...(await store.load()), ...time },
      permission: await readPermission(),
    };
    await store.save(state.setting);
    await rebuild(state, copy);
    return state;
  });
}

/** The session ended: cancel every Reminder and forget the setting. */
export function clearReminder(): Promise<void> {
  return serially(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await store.remove();
  });
}
