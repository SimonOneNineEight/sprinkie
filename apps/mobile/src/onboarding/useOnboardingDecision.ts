import { useEffect, useState } from 'react';

import type { Category } from '../api/client';
import { hasNoEntries } from '../reminder/firstEntryInvite';

import { markOnboardingDone, onboardingDone } from './onboardingMark';

export type OnboardingDecision = 'undecided' | 'show' | 'skip';

/**
 * Whether the Onboarding (#139) shows, decided once per launch: to a
 * zero-Entry account not yet done with it on this phone. Until /me
 * answers, a new account cannot be told from an existing one, so the
 * decision waits; a failed /me gives up for this launch and opens the
 * month view. An account seen holding Entries is marked done, so it never
 * waits again. `finish` marks the account done as page 4 is left.
 */
export function useOnboardingDecision(
  userId: string,
  world: 'pending' | 'ready' | 'failed',
  categories: Category[],
): { decision: OnboardingDecision; finish: () => void } {
  const [doneHere, setDoneHere] = useState<boolean | null>(null);
  const [decision, setDecision] = useState<OnboardingDecision>('undecided');
  useEffect(() => {
    let active = true;
    void onboardingDone(userId).then((done) => {
      if (active) setDoneHere(done);
    });
    return () => {
      active = false;
    };
  }, [userId]);
  if (decision === 'undecided') {
    if (doneHere === true || world === 'failed') {
      setDecision('skip');
    } else if (doneHere === false && world === 'ready') {
      setDecision(hasNoEntries(categories) ? 'show' : 'skip');
    }
  }
  const seenWithEntries =
    doneHere === false && world === 'ready' && categories.some((category) => category.inUse === true);
  useEffect(() => {
    if (seenWithEntries) void markOnboardingDone(userId);
  }, [seenWithEntries, userId]);
  const finish = () => {
    void markOnboardingDone(userId);
    setDecision('skip');
  };
  return { decision, finish };
}
