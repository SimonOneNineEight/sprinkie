package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/purge"
)

func deactivate(t *testing.T, ts *httptest.Server, token string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/me", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE /me: %v", err)
	}
	return resp
}

func TestDeactivationBlocksEverythingButMe(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	mustCreateEntry(t, ts, token, "2026-06-01", me.Categories[0].ID)

	resp := deactivate(t, ts, token)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("deactivate status = %d, want 204", resp.StatusCode)
	}
	// Idempotent: a second deactivation is still a quiet 204.
	again := deactivate(t, ts, token)
	again.Body.Close()
	if again.StatusCode != http.StatusNoContent {
		t.Errorf("repeat deactivate status = %d, want 204", again.StatusCode)
	}

	// Every route but POST /me answers 403 from here on.
	blocked := listEntries(t, ts, token, "2026-06-01")
	blocked.Body.Close()
	if blocked.StatusCode != http.StatusForbidden {
		t.Errorf("entries status = %d, want 403", blocked.StatusCode)
	}
	monthResp := getMonth(t, ts, token, "2026-06")
	monthResp.Body.Close()
	if monthResp.StatusCode != http.StatusForbidden {
		t.Errorf("month status = %d, want 403", monthResp.StatusCode)
	}
}

func reactivate(t *testing.T, ts *httptest.Server, token string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/me/reactivate", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /me/reactivate: %v", err)
	}
	return resp
}

func TestReactivationWithinGrace(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	mustCreateEntry(t, ts, token, "2026-06-02", me.Categories[0].ID)

	deactivate(t, ts, token).Body.Close()

	// A session restore is not a reactivation: the app provisions on every
	// launch, so /me must refuse, or any signed-in device would silently
	// cancel the deletion.
	refused := postMe(t, ts, token)
	refused.Body.Close()
	if refused.StatusCode != http.StatusForbidden {
		t.Fatalf("provision while deactivated = %d, want 403", refused.StatusCode)
	}

	// The deliberate restore brings the world back intact.
	restoredWorld := reactivate(t, ts, token)
	if restoredWorld.StatusCode != http.StatusOK {
		t.Fatalf("reactivate status = %d, want 200", restoredWorld.StatusCode)
	}
	back := decodeMe(t, restoredWorld)
	if back.JournalID != me.JournalID {
		t.Fatalf("journal changed across reactivation: %q then %q", me.JournalID, back.JournalID)
	}
	restored := listEntries(t, ts, token, "2026-06-02")
	defer restored.Body.Close()
	if restored.StatusCode != http.StatusOK {
		t.Fatalf("entries after reactivation = %d, want 200", restored.StatusCode)
	}

	// The audit trail recorded both sides of the round trip.
	events := auditEvents(t, tokenSub(t, token))
	if !containsEvent(events, "deactivated") || !containsEvent(events, "reactivated") {
		t.Errorf("audit events = %v, want deactivated and reactivated", events)
	}
}

func TestPurgeCascadesEverything(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	created := decodeEntry(t, createEntry(t, ts, token, map[string]string{
		"date": "2026-06-03", "categoryId": me.Categories[0].ID, "content": "x",
	}))
	objectPath, thumbPath := uploadedPair(t, ts, token, created.ID)
	registered := registerPhotos(t, ts, token, created.ID, []map[string]string{
		{"objectPath": objectPath, "thumbPath": thumbPath},
	})
	registered.Body.Close()
	if registered.StatusCode != http.StatusCreated {
		t.Fatalf("register photo status = %d, want 201", registered.StatusCode)
	}

	deactivate(t, ts, token).Body.Close()

	// The cutoff is the purge's clock: a future cutoff makes the fresh
	// deactivation due, standing in for the 30-day grace elapsing.
	queries := dbgen.New(testPool(t, testDatabaseURL()))
	purged, err := purge.Run(t.Context(), queries, testStore(), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if purged == 0 {
		t.Fatalf("purge ran on %d accounts, want at least 1", purged)
	}

	// The world is gone: signing in again provisions a fresh one.
	fresh := decodeMe(t, postMe(t, ts, token))
	if fresh.JournalID == me.JournalID {
		t.Errorf("journal survived the purge")
	}
	if len(fresh.Categories) != 5 {
		t.Errorf("fresh world has %d categories, want the 5 seeds", len(fresh.Categories))
	}
	empty := decodeMonth(t, getMonth(t, ts, token, "2026-06"))
	if len(empty.Days) != 0 {
		t.Errorf("entries survived the purge: %+v", empty.Days)
	}
	// The stored photo file is gone too: signing its path fails.
	if _, err := testStore().SignDownloads(t.Context(), []string{objectPath}, time.Minute); err == nil {
		t.Errorf("purged photo object still signable: %s", objectPath)
	}

	// The audit trail survives the purge and records the cascade scope.
	events := auditEvents(t, tokenSub(t, token))
	if !containsEvent(events, "purged") {
		t.Errorf("audit events = %v, want purged", events)
	}
}

func auditEvents(t *testing.T, userID string) []string {
	t.Helper()
	rows, err := dbgen.New(testPool(t, testDatabaseURL())).ListAccountAudit(t.Context(), userID)
	if err != nil {
		t.Fatalf("list audit: %v", err)
	}
	events := make([]string, len(rows))
	for i, row := range rows {
		events[i] = row.Event
	}
	return events
}

func containsEvent(events []string, event string) bool {
	for _, e := range events {
		if e == event {
			return true
		}
	}
	return false
}
