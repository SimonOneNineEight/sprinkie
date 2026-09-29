package server_test

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/SimonOneNineEight/sprinkie/api/internal/config"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
)

// freeAddr reserves a free TCP port and releases it for the server to claim.
func freeAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	addr := l.Addr().String()
	l.Close()
	return addr
}

func TestRunServesHealthzUntilContextCancelled(t *testing.T) {
	addr := freeAddr(t)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- server.Run(ctx, config.Config{Addr: addr, DatabaseURL: testDatabaseURL(), SupabaseJWKSURL: testJWKSURL(), SupabaseStorageURL: testStorageURL(), SupabaseSecretKey: testSecretKey()}, discardLogger())
	}()

	deadline := time.Now().Add(5 * time.Second)
	for {
		resp, err := http.Get("http://" + addr + "/health")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				break
			}
		}
		if time.Now().After(deadline) {
			t.Fatal("server never answered /health with 200")
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run returned %v after cancel, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return after context cancel")
	}
}

func TestRunFailsOnUnparsableDatabaseURL(t *testing.T) {
	err := server.Run(context.Background(), config.Config{Addr: freeAddr(t), DatabaseURL: "://not-a-url", SupabaseJWKSURL: testJWKSURL(), SupabaseStorageURL: testStorageURL(), SupabaseSecretKey: testSecretKey()}, discardLogger())
	if err == nil {
		t.Fatal("Run succeeded with an unparsable DATABASE_URL, want an error")
	}
}

func TestRunFailsOnInvalidSentryDSN(t *testing.T) {
	err := server.Run(context.Background(), config.Config{Addr: freeAddr(t), DatabaseURL: testDatabaseURL(), SupabaseJWKSURL: testJWKSURL(), SupabaseStorageURL: testStorageURL(), SupabaseSecretKey: testSecretKey(), SentryDSN: "not-a-dsn"}, discardLogger())
	if err == nil {
		t.Fatal("Run succeeded with an invalid SENTRY_DSN, want an error")
	}
}

func TestRunFailsWhenAddrIsTaken(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	defer l.Close()

	err = server.Run(context.Background(), config.Config{Addr: l.Addr().String(), DatabaseURL: testDatabaseURL(), SupabaseJWKSURL: testJWKSURL(), SupabaseStorageURL: testStorageURL(), SupabaseSecretKey: testSecretKey()}, discardLogger())
	if err == nil {
		t.Fatal("Run succeeded on an occupied address, want an error")
	}
}
