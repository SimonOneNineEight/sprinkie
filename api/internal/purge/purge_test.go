package purge_test

// Fault injection only: the real cascade runs in the server package's
// TestPurgeCascadesEverything against local Supabase. A live Postgres cannot
// fail on exactly one cascade step, so each error branch gets a stub that
// fails on cue. The embedded interface stays nil: purge.Run must never call
// anything these overrides don't cover.

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/purge"
)

type failQ struct {
	dbgen.Querier
	failOn string
}

func (f failQ) err(step string) error {
	if f.failOn == step {
		return errors.New("boom")
	}
	return nil
}

func (f failQ) ListPurgeDue(context.Context, pgtype.Timestamptz) ([]string, error) {
	return []string{"11111111-1111-1111-1111-111111111111"}, f.err("due")
}
func (f failQ) ListUserPhotoPaths(context.Context, string) ([]dbgen.ListUserPhotoPathsRow, error) {
	return []dbgen.ListUserPhotoPathsRow{{ObjectPath: "u/e/a.jpg", ThumbPath: "u/e/a_thumb.jpg"}},
		f.err("photos")
}
func (f failQ) PurgeUserEntries(context.Context, string) (int64, error) {
	return 1, f.err("entries")
}
func (f failQ) PurgeUserChildCategories(context.Context, string) (int64, error) {
	return 1, f.err("children")
}
func (f failQ) PurgeUserParentCategories(context.Context, string) (int64, error) {
	return 1, f.err("parents")
}
func (f failQ) PurgeUserColorRecents(context.Context, string) (int64, error) {
	return 0, f.err("recents")
}
func (f failQ) PurgeUserJournal(context.Context, string) (int64, error) {
	return 1, f.err("journal")
}
func (f failQ) PurgeUserRow(context.Context, string) (int64, error) {
	return 1, f.err("user")
}
func (f failQ) InsertAccountAudit(context.Context, dbgen.InsertAccountAuditParams) error {
	return f.err("audit")
}

type stubStore struct{ err error }

func (s stubStore) Remove(context.Context, []string) error { return s.err }

func TestRunFailsClosedOnEachStep(t *testing.T) {
	for _, step := range []string{
		"due", "photos", "entries", "children", "parents", "recents", "journal", "user", "audit",
	} {
		t.Run(step, func(t *testing.T) {
			_, err := purge.Run(t.Context(), failQ{failOn: step}, stubStore{}, time.Now())
			if err == nil {
				t.Fatalf("step %q: err = nil, want failure", step)
			}
		})
	}
}

func TestRunCounts(t *testing.T) {
	purged, err := purge.Run(t.Context(), failQ{}, stubStore{}, time.Now())
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	if purged != 1 {
		t.Fatalf("purged = %d, want 1", purged)
	}
}

func TestRunAbortsBeforeRowsWhenObjectRemovalFails(t *testing.T) {
	// Erasure means the files go first: a storage failure must leave every
	// row (and the account's due status) intact for the next run.
	_, err := purge.Run(t.Context(), failQ{}, stubStore{err: errors.New("boom")}, time.Now())
	if err == nil {
		t.Fatal("err = nil, want the storage failure to abort the purge")
	}
}
