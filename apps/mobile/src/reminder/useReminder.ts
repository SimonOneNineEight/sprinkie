import { createContext, useContext } from 'react';

import { type ReminderTime, type TurnOnResult, defaultSetting } from './reminder';

// What a screen sees of the Reminder (#135): its state and the five things
// it may ask for. ReminderProvider supplies it; nothing on screen touches the
// notifications module.
export type ReminderValue = {
  /** On only while the User set it on and iOS grants notifications. */
  on: boolean;
  /** iOS will not deliver nor ask again: notifications were refused or turned off. */
  blocked: boolean;
  time: ReminderTime;
  /** Asks iOS only if it still may; `time` defaults to the stored one (21:00). */
  turnOn: (time?: ReminderTime) => Promise<TurnOnResult>;
  turnOff: () => Promise<void>;
  changeTime: (time: ReminderTime) => Promise<void>;
  /** Rebuilds the pending run from the setting, permission and App Language. */
  resync: () => Promise<void>;
};

// Inert outside the signed-in app: screens rendered alone in tests see the
// Reminder off.
export const ReminderContext = createContext<ReminderValue>({
  on: false,
  blocked: false,
  time: defaultSetting,
  turnOn: async () => 'refused',
  turnOff: async () => {},
  changeTime: async () => {},
  resync: async () => {},
});

export function useReminder(): ReminderValue {
  return useContext(ReminderContext);
}
