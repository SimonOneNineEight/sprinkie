// Command purge runs the account purge (#15): every account deactivated more
// than 30 days ago is permanently deleted, cascading through Entries,
// Categories, and stored photo files. Scheduled externally (cron/CI); like
// cmd/api it stays a logic-free shim over internal packages.
package main

import (
	"context"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/config"
	"github.com/SimonOneNineEight/sprinkie/api/internal/logging"
	"github.com/SimonOneNineEight/sprinkie/api/internal/purge"
	"github.com/SimonOneNineEight/sprinkie/api/internal/storage"
)

func main() {
	logger := logging.New(os.Stdout)
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		logger.Error("config", "error", err)
		os.Exit(1)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	store := storage.New(cfg.SupabaseStorageURL, cfg.SupabaseSecretKey)
	purged, err := purge.Run(ctx, dbgen.New(pool), store, time.Now().Add(-purge.GracePeriod))
	if err != nil {
		logger.Error("purge", "error", err)
		os.Exit(1)
	}
	logger.Info("purge complete", "accounts", purged)
}
