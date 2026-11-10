// The phone's notification system, faked (#135 Testing Decisions): the
// notifications counterpart of the mock API. `__mocks__/expo-notifications.ts`
// hands the app this module's `expoNotifications` in place of the native
// module, so every suite runs against it; tests drive and read it through
// `fakeNotifications`, as data: what permission iOS would answer, how often
// the system prompt showed, which Reminders the phone holds, and a tap.
//
// It models iOS where the app can tell: a refusal at the prompt leaves
// permission blocked (iOS never asks twice), a pending notification whose
// time has passed is no longer pending (it was delivered, and stays
// tappable in Notification Center until the test resets), and scheduling
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
type NotificationBehavior = {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};
type NotificationHandler = {
  handleNotification: (notification: NotificationResponse['notification']) => Promise<NotificationBehavior>;
};

const state = {
  permission: 'undetermined' as FakePermission,
  promptAnswer: 'allow' as 'allow' | 'deny',
  prompts: 0,
  pending: [] as ScheduledNotification[],
  responseListeners: [] as ResponseListener[],
  lastResponse: null as NotificationResponse | null,
  handler: null as NotificationHandler | null,
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
    state.handler = null;
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
  /**
   * The User taps a notification, pending or already delivered (still in
   * Notification Center), with Sprinkie closed, in the background or open.
   */
  tap(identifier: string) {
    const response: NotificationResponse = {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: notificationOf(identifier),
    };
    state.lastResponse = response;
    state.responseListeners.forEach((listener) => listener(response));
  },
  /**
   * A notification fires while Sprinkie is open: what iOS shows, as the app's
   * notification handler decides. With no handler, iOS shows nothing.
   */
  async arriveInForeground(identifier: string): Promise<{ banner: boolean; list: boolean }> {
    const behavior = await state.handler?.handleNotification(notificationOf(identifier));
    return { banner: behavior?.shouldShowBanner ?? false, list: behavior?.shouldShowList ?? false };
  },
};

function notificationOf(identifier: string): NotificationResponse['notification'] {
  const found = state.pending.find((n) => n.identifier === identifier);
  if (!found) throw new Error(`No notification ${identifier}`);
  return {
    date: found.date.getTime(),
    request: {
      identifier: found.identifier,
      content: { title: found.title, body: found.body, data: found.data },
      trigger: { type: 'date', value: found.date.getTime() },
    },
  };
}

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
  // Cancelling reaches only what has not fired yet: a delivered one stays in
  // Notification Center, where it can still be tapped.
  async cancelScheduledNotificationAsync(identifier: string) {
    state.pending = state.pending.filter((n) => n.identifier !== identifier || !notDelivered(n));
  },
  async cancelAllScheduledNotificationsAsync() {
    state.pending = state.pending.filter((n) => !notDelivered(n));
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
  clearLastNotificationResponse() {
    state.lastResponse = null;
  },
  setNotificationHandler(handler: NotificationHandler | null) {
    state.handler = handler;
  },
};
