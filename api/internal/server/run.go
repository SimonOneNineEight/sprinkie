package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/config"
	"github.com/SimonOneNineEight/sprinkie/api/internal/storage"
)

// Run serves the API until ctx is cancelled, then shuts down gracefully.
// An empty SentryDSN leaves the Sentry SDK disabled.
func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	if err := sentry.Init(sentry.ClientOptions{Dsn: cfg.SentryDSN}); err != nil {
		return fmt.Errorf("sentry: %w", err)
	}
	defer sentry.Flush(2 * time.Second)

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("database: %w", err)
	}
	defer pool.Close()

	store := storage.New(cfg.SupabaseStorageURL, cfg.SupabaseSecretKey)
	srv := &http.Server{Addr: cfg.Addr, Handler: New(logger, pool, auth.NewVerifier(cfg.SupabaseJWKSURL), store)}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	logger.LogAttrs(ctx, slog.LevelInfo, "listening", slog.String("addr", cfg.Addr))
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
