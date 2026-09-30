// Package purge runs the account purge (#15): permanent deletion of every
// deactivated account whose 30-day grace has elapsed, cascading through
// Entries, Categories, and stored photo files. Run by cmd/purge on a
// schedule; a run interrupted midway finishes on the next one, because every
// cascade step is idempotent.
package purge

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
)

// ObjectStore is the storage slice the purge needs; storage.Client satisfies
// it.
type ObjectStore interface {
	Remove(ctx context.Context, paths []string) error
}

// GracePeriod is how long a deactivated account survives before the purge:
// domain policy, so it lives here rather than in the cmd shim.
const GracePeriod = 30 * 24 * time.Hour

// Run purges every account deactivated before the cutoff and returns how
// many. The caller picks the cutoff (now minus GracePeriod in cmd/purge;
// tests pass a future cutoff to stand in for elapsed time).
func Run(ctx context.Context, queries dbgen.Querier, store ObjectStore, cutoff time.Time) (int, error) {
	due, err := queries.ListPurgeDue(ctx, pgtype.Timestamptz{Time: cutoff, Valid: true})
	if err != nil {
		return 0, err
	}
	for _, userID := range due {
		if err := purgeOne(ctx, queries, store, userID); err != nil {
			return 0, err
		}
	}
	return len(due), nil
}

func purgeOne(ctx context.Context, queries dbgen.Querier, store ObjectStore, userID string) error {
	photoRows, err := queries.ListUserPhotoPaths(ctx, userID)
	if err != nil {
		return err
	}
	paths := make([]string, 0, len(photoRows)*2)
	for _, row := range photoRows {
		paths = append(paths, row.ObjectPath, row.ThumbPath)
	}
	// Purge is erasure, so a failed object removal aborts before any row
	// disappears: the paths stay recorded and the next run retries. (Removing
	// rows first would orphan the files in the bucket forever.)
	if err := store.Remove(ctx, paths); err != nil {
		return err
	}

	entries, err := queries.PurgeUserEntries(ctx, userID)
	if err != nil {
		return err
	}
	children, err := queries.PurgeUserChildCategories(ctx, userID)
	if err != nil {
		return err
	}
	parents, err := queries.PurgeUserParentCategories(ctx, userID)
	if err != nil {
		return err
	}
	if _, err := queries.PurgeUserColorRecents(ctx, userID); err != nil {
		return err
	}
	if _, err := queries.PurgeUserJournal(ctx, userID); err != nil {
		return err
	}

	// The durable trail records what the cascade covered — written before the
	// user row goes, because deleting that row removes the account from
	// ListPurgeDue and an unwritten audit line would never be retried. A crash
	// between the two leaves the account due once more; the rerun writes a
	// second, all-zero line, which honestly records the interruption.
	scope, _ := json.Marshal(map[string]int64{
		"photos":     int64(len(photoRows)),
		"entries":    entries,
		"categories": children + parents,
	})
	if err := queries.InsertAccountAudit(ctx, dbgen.InsertAccountAuditParams{
		UserID: userID,
		Event:  "purged",
		Scope:  scope,
	}); err != nil {
		return err
	}
	_, err = queries.PurgeUserRow(ctx, userID)
	return err
}
