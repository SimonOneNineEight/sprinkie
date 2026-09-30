package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/logging"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
)

// testDatabaseURL returns the local Supabase database, overridable for CI.
func testDatabaseURL() string {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return url
	}
	return "postgresql://postgres:postgres@127.0.0.1:55322/postgres"
}

func testPool(t *testing.T, url string) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func discardLogger() *slog.Logger {
	return logging.New(io.Discard)
}

func TestRequestsAreLoggedAsJSONWithRequestID(t *testing.T) {
	var buf bytes.Buffer
	ts := httptest.NewServer(server.New(logging.New(&buf), testPool(t, testDatabaseURL()), auth.NewVerifier(testJWKSURL()), testStore()))
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	resp.Body.Close()

	var logLine map[string]any
	if err := json.Unmarshal(buf.Bytes(), &logLine); err != nil {
		t.Fatalf("access log is not one JSON line: %v\nlog: %q", err, buf.String())
	}
	if logLine["method"] != "GET" {
		t.Errorf("method = %v, want GET", logLine["method"])
	}
	if logLine["route"] != "/health" {
		t.Errorf("route = %v, want /health", logLine["route"])
	}
	if logLine["status"] != float64(http.StatusOK) {
		t.Errorf("status = %v, want 200", logLine["status"])
	}
	if ms, ok := logLine["duration_ms"].(float64); !ok || ms <= 0 {
		t.Errorf("duration_ms = %v, want a positive number", logLine["duration_ms"])
	}
	if id, ok := logLine["request_id"].(string); !ok || id == "" {
		t.Errorf("request_id = %v, want a non-empty string", logLine["request_id"])
	}
}

func TestHealthzReportsUnavailableWhenDatabaseUnreachable(t *testing.T) {
	// A pool is created lazily, so pointing one at a closed port only fails
	// when the handler runs its query.
	var buf bytes.Buffer
	ts := httptest.NewServer(server.New(logging.New(&buf), testPool(t, "postgresql://postgres:postgres@127.0.0.1:1/postgres"), auth.NewVerifier(testJWKSURL()), testStore()))
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Message == "" {
		t.Error("message is empty, want an explanation")
	}
	// The failure must be observable by operators, not swallowed into the 503.
	if log := buf.String(); !strings.Contains(log, `"level":"ERROR"`) || !strings.Contains(log, "database") {
		t.Errorf("no ERROR log line about the database failure, got: %q", log)
	}
}

func TestHealthzReportsOKWithSchemaVersion(t *testing.T) {
	ts := httptest.NewServer(server.New(discardLogger(), testPool(t, testDatabaseURL()), auth.NewVerifier(testJWKSURL()), testStore()))
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var health struct {
		Status        string `json:"status"`
		SchemaVersion int    `json:"schemaVersion"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if health.Status != "ok" {
		t.Errorf("status = %q, want %q", health.Status, "ok")
	}
	if health.SchemaVersion != 1 {
		t.Errorf("schemaVersion = %d, want 1", health.SchemaVersion)
	}
}
