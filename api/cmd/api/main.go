// Command api runs the Sprinkie API server. It stays a thin, logic-free
// shim over internal packages: the CI coverage gate enforces 100% on
// internal/..., so any behavior added here would escape it. Put behavior in
// internal packages instead.
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/SimonOneNineEight/sprinkie/api/internal/config"
	"github.com/SimonOneNineEight/sprinkie/api/internal/logging"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
)

func main() {
	logger := logging.New(os.Stdout)
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		logger.Error("config", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx, cfg, logger); err != nil {
		logger.Error("server", "error", err)
		os.Exit(1)
	}
}
