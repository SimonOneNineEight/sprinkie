import { versionedStore } from '../storage/versionedStore';

// Whether an account is done with the Onboarding (#139) on this phone. Kept
// per account, so a second person signing in on the same phone still meets
// it, and per device, as the Reminder invite's mark is. An account is done
// once it reaches page 4's end (a save or 稍後再寫), or once it is seen
// holding Entries: existing Users never meet it, even after deleting every
// Entry. The mark outlives sign-out, so signing back in never replays it.

type Envelope = { v: 1; done: string[] };

const store = versionedStore<string[]>({
  key: 'onboarding.v1',
  fallback: [],
  decode: (envelope) => {
    const parsed = envelope as Envelope;
    return parsed.v === 1 && Array.isArray(parsed.done) ? parsed.done : null;
  },
  encode: (done) => ({ v: 1, done }),
});

export async function onboardingDone(userId: string): Promise<boolean> {
  return (await store.load()).includes(userId);
}

export async function markOnboardingDone(userId: string): Promise<void> {
  const done = await store.load();
  if (!done.includes(userId)) await store.save([...done, userId]);
}
