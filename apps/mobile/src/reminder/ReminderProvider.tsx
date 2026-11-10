import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAppLanguage } from '../i18n/AppLanguageProvider';

import {
  type ReminderState,
  changeReminderTime,
  defaultSetting,
  resyncReminder,
  turnOffReminder,
  turnOnReminder,
} from './reminder';
import { ReminderContext, type ReminderValue } from './useReminder';

// Mounted with the signed-in app, so mounting is a launch (or a sign-in):
// the run is rebuilt then, on every App Language change, and whenever the
// app returns to the foreground, where permission may have changed in the
// iOS Settings app. Ending the session is AppRoot's job (clearReminder).
export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const { strings } = useAppLanguage();
  const copy = strings.reminder;
  const [state, setState] = useState<ReminderState | null>(null);

  const resync = useCallback(async () => {
    setState(await resyncReminder(copy));
  }, [copy]);

  useEffect(() => {
    let active = true;
    const sync = () =>
      resyncReminder(copy).then((next) => {
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
  }, [copy]);

  const value = useMemo<ReminderValue>(() => {
    const setting = state?.setting ?? defaultSetting;
    const permission = state?.permission ?? 'askable';
    return {
      on: setting.on && permission === 'granted',
      blocked: setting.on && permission === 'blocked',
      time: { hour: setting.hour, minute: setting.minute },
      turnOn: async (time = { hour: setting.hour, minute: setting.minute }) => {
        const { result, state: next } = await turnOnReminder(time, copy);
        setState(next);
        return result;
      },
      turnOff: async () => setState(await turnOffReminder()),
      changeTime: async (time) => setState(await changeReminderTime(time, copy)),
      resync,
    };
  }, [state, copy, resync]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}
