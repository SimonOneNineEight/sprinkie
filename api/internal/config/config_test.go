package config_test

import (
	"testing"

	"github.com/SimonOneNineEight/sprinkie/api/internal/config"
)

func env(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

func TestLoadReadsEnvironment(t *testing.T) {
	cfg, err := config.Load(env(map[string]string{
		"DATABASE_URL":         "postgresql://db/example",
		"PORT":                 "9090",
		"SUPABASE_JWKS_URL":    "https://auth.example/jwks.json",
		"SUPABASE_STORAGE_URL": "https://storage.example/storage/v1",
		"SUPABASE_SECRET_KEY":  "sb_secret_test",
		"SENTRY_DSN":           "https://key@sentry.example/1",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Addr != ":9090" {
		t.Errorf("Addr = %q, want %q", cfg.Addr, ":9090")
	}
	if cfg.DatabaseURL != "postgresql://db/example" {
		t.Errorf("DatabaseURL = %q, want the env value", cfg.DatabaseURL)
	}
	if cfg.SupabaseJWKSURL != "https://auth.example/jwks.json" {
		t.Errorf("SupabaseJWKSURL = %q, want the env value", cfg.SupabaseJWKSURL)
	}
	if cfg.SentryDSN != "https://key@sentry.example/1" {
		t.Errorf("SentryDSN = %q, want the env value", cfg.SentryDSN)
	}
}

func TestLoadDefaultsPortTo8080(t *testing.T) {
	cfg, err := config.Load(env(map[string]string{
		"DATABASE_URL":         "postgresql://db/example",
		"SUPABASE_JWKS_URL":    "https://auth.example/jwks.json",
		"SUPABASE_STORAGE_URL": "https://storage.example/storage/v1",
		"SUPABASE_SECRET_KEY":  "sb_secret_test",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Addr != ":8080" {
		t.Errorf("Addr = %q, want %q", cfg.Addr, ":8080")
	}
}

func TestLoadRequiredKeys(t *testing.T) {
	full := map[string]string{
		"DATABASE_URL":         "postgresql://db/example",
		"SUPABASE_JWKS_URL":    "https://auth.example/jwks.json",
		"SUPABASE_STORAGE_URL": "https://storage.example/storage/v1",
		"SUPABASE_SECRET_KEY":  "sb_secret_test",
	}
	for missing := range full {
		t.Run(missing, func(t *testing.T) {
			partial := map[string]string{}
			for k, v := range full {
				if k != missing {
					partial[k] = v
				}
			}
			if _, err := config.Load(env(partial)); err == nil {
				t.Fatalf("Load succeeded without %s, want an error", missing)
			}
		})
	}
}
