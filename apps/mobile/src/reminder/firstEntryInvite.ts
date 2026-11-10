import type { Category } from '../api/client';
import { versionedStore } from '../storage/versionedStore';

// The Reminder invite (#138) is offered once per phone, after a zero-Entry
// account's first save. The mark is per device and outlives the session, so
// a User who later deletes every Entry is not offered it again here.

type InviteEnvelope = { v: 1; shown: boolean };

const store = versionedStore<boolean>({
  key: 'reminderInvite.v1',
  fallback: false,
  decode: (envelope) => {
    const parsed = envelope as InviteEnvelope;
    return parsed.v === 1 && typeof parsed.shown === 'boolean' ? parsed.shown : null;
  },
  encode: (shown) => ({ v: 1, shown }),
});

/**
 * Whether the account had no Entries, read from /me before the save: a
 * Category with Entries reports in use (and cannot be deleted), so no
 * Category in use is exact. An unprovisioned world says nothing.
 */
export function hasNoEntries(categories: Category[]): boolean {
  return categories.length > 0 && categories.every((category) => category.inUse !== true);
}

/** Whether the invite has already been offered on this phone. */
export function firstEntryInviteShown(): Promise<boolean> {
  return store.load();
}

/** Marks the invite offered, as the sheet appears (or the line ends, with nothing to offer). */
export function markFirstEntryInviteShown(): Promise<void> {
  return store.save(true);
}
