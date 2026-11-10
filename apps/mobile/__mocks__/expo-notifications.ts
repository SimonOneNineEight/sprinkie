// Manual mock, auto-applied: the native notifications module cannot load in
// jest, and every Reminder test reads what the phone holds, so the stateful
// fake in src/testing/fakeNotifications.ts stands in for it everywhere.
import { expoNotifications } from '../src/testing/fakeNotifications';

export const {
  SchedulableTriggerInputTypes,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  getLastNotificationResponseAsync,
  clearLastNotificationResponse,
  setNotificationHandler,
} = expoNotifications;
