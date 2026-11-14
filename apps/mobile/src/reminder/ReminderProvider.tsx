import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { listEntries } from '../api/client';
import { localDateString } from '../calendar/monthMath';
import { useAppLanguage } from '../i18n/AppLanguageProvider';

import {
  type ReminderState,
  changeReminderTime,
  defaultSetting,
  lastKnownWritten,
  rememberToday,
  reminderSession,
  resyncReminder,
  turnOffReminder,
  turnOnReminder,
} from './reminder';
import { ReminderContext, type ReminderValue } from './useReminder';

// Mounted with the signed-in app, so mounting is a launch (or a sign-in):
// the run is rebuilt then, on every App Language change, and whenever the
// app returns to the foreground, where permission may have changed in the
// iOS Settings app. Ending the session is AppRoot's job (clearReminder).
//
// A day that already holds an Entry gets no Reminder (#137): every re-sync
// first asks the server for today's Entries, unfiltered, so a
// Draft never counts. HomeScreen re-syncs whenever today's Entries may have
// changed.
export function ReminderProvider({
  accessToken,
  children,
}: {
  accessToken: string;
  children: React.ReactNode;
}) {
  const { strings } = useAppLanguage();
  const copy = strings.reminder;
  const [state, setState] = useState<ReminderState | null>(null);
  // Today's date while today holds an Entry, as last read. Unreadable
  // (offline), it stays as this session last read it, or before any read
  // of today falls back to what this phone last knew of today, kept across
  // launches. The session's own read wins: the phone may have refused to
  // keep it.
  const writtenDay = useRef<string | undefined>(undefined);
  // The day this session last read, to tell whether it knows today.
  const readDay = useRef<string | undefined>(undefined);
  // Only the latest read lands, so a slow read from before a save cannot
  // bring today's Reminder back after a newer one silenced it.
  const reads = useRef(0);

  const readToday = useCallback(async () => {
    const read = ++reads.current;
    const session = reminderSession();
    const today = localDateString(new Date());
    try {
      const { entries } = await listEntries(accessToken, today);
      if (read === reads.current) {
        writtenDay.current = entries.length > 0 ? today : undefined;
        readDay.current = today;
        await rememberToday(session, today, entries.length > 0);
      }
    } catch {
      if (readDay.current !== today) {
        const known = await lastKnownWritten(today);
        if (read === reads.current && readDay.current !== today) writtenDay.current = known;
      }
    }
    return writtenDay.current;
  }, [accessToken]);

  const resync = useCallback(async () => {
    setState(await resyncReminder(copy, await readToday()));
  }, [copy, readToday]);

  useEffect(() => {
    let active = true;
    const sync = () =>
      readToday()
        .then((written) => resyncReminder(copy, written))
        .then((next) => {
          if (active) setState(next);
        }, Sentry.captureException);
    void sync();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void sync();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [copy, readToday]);

  const value = useMemo<ReminderValue>(() => {
    const setting = state?.setting ?? defaultSetting;
    const permission = state?.permission ?? 'askable';
    return {
      on: setting.on && permission === 'granted',
      blocked: permission === 'blocked',
      time: { hour: setting.hour, minute: setting.minute },
      turnOn: async (time = { hour: setting.hour, minute: setting.minute }) => {
        const { result, state: next } = await turnOnReminder(time, copy, writtenDay.current);
        setState(next);
        return result;
      },
      turnOff: async () => setState(await turnOffReminder()),
      changeTime: async (time) =>
        setState(await changeReminderTime(time, copy, writtenDay.current)),
      resync,
    };
  }, [state, copy, resync]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}
