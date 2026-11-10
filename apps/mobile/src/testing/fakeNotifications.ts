// The phone's notification system, faked (#135 Testing Decisions): the
// notifications counterpart of the mock API. `__mocks__/expo-notifications.ts`
// hands the app this module's `expoNotifications` in place of the native
// module, so every suite runs against it; tests drive and read it through
// `fakeNotifications`, as data: what permission iOS would answer, how often
// the system prompt showed, which Reminders the phone holds, and a tap.
//
// It models iOS where the app can tell: a refusal at the prompt leaves
// permission blocked (iOS never asks twice), a pending notification whose
// time has passed is no longer pending (it was delivered), and scheduling
// under an identifier already pending replaces it.

/** What iOS would answer about notification permission. */
export type FakePermission = 'undetermined' | 'granted' | 'blocked';

/** One pending notification, as a test reads it. */
export type ScheduledNotification = {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  date: Date;
};

type NotificationResponse = {
  actionIdentifier: string;
  notification: {
    date: number;
    request: {
      identifier: string;
      content: { title: string; body: string; data: Record<string, unknown> };
      trigger: unknown;
    };
  };
};
type ResponseListener = (response: NotificationResponse) => void;

const state = {
  permission: 'undetermined' as FakePermission,
  promptAnswer: 'allow' as 'allow' | 'deny',
  prompts: 0,
  pending: [] as ScheduledNotification[],
  responseListeners: [] as ResponseListener[],
  lastResponse: null as NotificationResponse | null,
};

const notDelivered = (n: ScheduledNotification) => n.date.getTime() > Date.now();

function permissionResponse() {
  const granted = state.permission === 'granted';
  return {
    status: granted ? 'granted' : state.permission === 'blocked' ? 'denied' : 'undetermined',
    granted,
    canAskAgain: state.permission !== 'blocked',
    expires: 'never' as const,
  };
}

export const fakeNotifications = {
  /** A fresh phone: permission never asked, nothing pending, no taps. */
  reset() {
    state.permission = 'undetermined';
    state.promptAnswer = 'allow';
    state.prompts = 0;
    state.pending = [];
    state.responseListeners = [];
    state.lastResponse = null;
  },
  setPermission(permission: FakePermission) {
    state.permission = permission;
  },
  /** How the User answers the system prompt, should it show. */
  answerPromptWith(answer: 'allow' | 'deny') {
    state.promptAnswer = answer;
  },
  /** How many times the system permission prompt has shown. */
  prompts() {
    return state.prompts;
  },
  /** The notifications still pending on the phone, soonest first. */
  scheduled(): ScheduledNotification[] {
    return state.pending.filter(notDelivered).sort((a, b) => a.date.getTime() - b.date.getTime());
  },
  /** The User taps a pending notification. */
  tap(identifier: string) {
    const tapped = state.pending.find((n) => n.identifier === identifier);
    if (!tapped) throw new Error(`No pending notification ${identifier}`);
    const response: NotificationResponse = {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: {
        date: tapped.date.getTime(),
        request: {
          identifier: tapped.identifier,
          content: { title: tapped.title, body: tapped.body, data: tapped.data },
          trigger: { type: 'date', value: tapped.date.getTime() },
        },
      },
    };
    state.lastResponse = response;
    state.responseListeners.forEach((listener) => listener(response));
  },
};

let generatedIds = 0;

// The slice of expo-notifications' surface the app calls, same names and
// shapes. Extend it here when the app needs more of the module.
export const expoNotifications = {
  SchedulableTriggerInputTypes: { DATE: 'date' } as const,

  async getPermissionsAsync() {
    return permissionResponse();
  },
  async requestPermissionsAsync() {
    if (state.permission === 'undetermined') {
      state.prompts += 1;
      state.permission = state.promptAnswer === 'allow' ? 'granted' : 'blocked';
    }
    return permissionResponse();
  },
  async scheduleNotificationAsync(request: {
    identifier?: string;
    content: { title?: string; body?: string; data?: Record<string, unknown> };
    trigger: { type: string; date: Date | number };
  }) {
    if (request.trigger.type !== 'date') {
      throw new Error(`The fake only models date triggers, got ${request.trigger.type}`);
    }
    const identifier = request.identifier ?? `generated-${++generatedIds}`;
    state.pending = state.pending.filter((n) => n.identifier !== identifier);
    state.pending.push({
      identifier,
      title: request.content.title ?? '',
      body: request.content.body ?? '',
      data: request.content.data ?? {},
      date: new Date(request.trigger.date),
    });
    return identifier;
  },
  async cancelScheduledNotificationAsync(identifier: string) {
    state.pending = state.pending.filter((n) => n.identifier !== identifier);
  },
  async cancelAllScheduledNotificationsAsync() {
    state.pending = [];
  },
  async getAllScheduledNotificationsAsync() {
    return fakeNotifications.scheduled().map((n) => ({
      identifier: n.identifier,
      content: { title: n.title, body: n.body, data: n.data },
      trigger: { type: 'date', value: n.date.getTime() },
    }));
  },
  addNotificationResponseReceivedListener(listener: ResponseListener) {
    state.responseListeners.push(listener);
    return {
      remove() {
        state.responseListeners = state.responseListeners.filter((l) => l !== listener);
      },
    };
  },
  getLastNotificationResponse() {
    return state.lastResponse;
  },
  async getLastNotificationResponseAsync() {
    return state.lastResponse;
  },
};
