// Package server assembles the HTTP API: the chi router, middleware, and the
// handlers implementing the generated OpenAPI contract.
package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/logging"
)

// ObjectStore is the slice of the storage client the handlers need; an
// interface so tests can fault-inject storage failures (the platform itself
// is never mocked for behavior tests).
type ObjectStore interface {
	SignUpload(ctx context.Context, path string) (string, error)
	SignDownloads(ctx context.Context, paths []string, expiresIn time.Duration) (map[string]string, error)
	Remove(ctx context.Context, paths []string) error
}

// handlers implements apigen.StrictServerInterface.
type handlers struct {
	logger  *slog.Logger
	queries dbgen.Querier
	store   ObjectStore
}

func (h handlers) GetHealth(ctx context.Context, _ apigen.GetHealthRequestObject) (apigen.GetHealthResponseObject, error) {
	version, err := h.queries.GetSchemaVersion(ctx)
	if err != nil {
		h.logger.LogAttrs(ctx, slog.LevelError, "health check database query failed",
			slog.String("error", err.Error()))
		if hub := sentry.GetHubFromContext(ctx); hub != nil {
			hub.CaptureException(err)
		}
		return apigen.GetHealth503JSONResponse{Message: "database unreachable"}, nil
	}
	return apigen.GetHealth200JSONResponse{Status: "ok", SchemaVersion: int(version)}, nil
}

func (h handlers) ProvisionMe(ctx context.Context, req apigen.ProvisionMeRequestObject) (apigen.ProvisionMeResponseObject, error) {
	userID := auth.UserID(ctx)
	// A deactivated account never auto-reactivates here: the app provisions
	// on every launch, so an auto-restoring /me would let any still-signed-in
	// device cancel a deletion silently. POST /me/reactivate is the
	// deliberate path (#15).
	deletedAt, err := h.queries.GetAccountStatus(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return apigen.ProvisionMe500JSONResponse(h.failure(ctx, "provisioning failed", err)), nil
	}
	if err == nil && deletedAt.Valid {
		return apigen.ProvisionMe403JSONResponse{Message: "account is deactivated"}, nil
	}
	// The signup-time App Language names the Starter Categories (#36). The
	// seed itself is guarded in SQL on "no categories yet", so the hint can
	// never rewrite an existing world; anything but a valid en reads as
	// zh-TW (existing clients send no body at all).
	language := string(apigen.ZhTW)
	if req.Body != nil && req.Body.Language != nil && *req.Body.Language == apigen.En {
		language = string(apigen.En)
	}
	if err := h.queries.ProvisionUser(ctx, dbgen.ProvisionUserParams{UserID: userID, Language: language}); err != nil {
		return apigen.ProvisionMe500JSONResponse(h.failure(ctx, "provisioning failed", err)), nil
	}
	world, err := h.world(ctx, userID)
	if err != nil {
		return apigen.ProvisionMe500JSONResponse(h.failure(ctx, "provisioning failed", err)), nil
	}
	return apigen.ProvisionMe200JSONResponse(world), nil
}

// world assembles the signed-in User's Me payload; shared by provisioning
// and reactivation.
func (h handlers) world(ctx context.Context, userID string) (apigen.Me, error) {
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.Me{}, err
	}
	rows, err := h.queries.ListCategories(ctx, userID)
	if err != nil {
		return apigen.Me{}, err
	}
	categories := make([]apigen.Category, len(rows))
	for i, row := range rows {
		inUse, hasChildren := row.InUse, row.HasChildren
		categories[i] = apigen.Category{
			Id:          row.ID,
			Name:        row.Name,
			Color:       row.Color,
			Icon:        row.Icon,
			ParentId:    row.ParentID,
			Position:    int(row.Position),
			InUse:       &inUse,
			HasChildren: &hasChildren,
		}
	}
	return apigen.Me{UserId: userID, JournalId: journalID, Categories: categories}, nil
}

// failure logs an operation failure, reports it to Sentry, and returns the
// contract Error. Only the driver error is logged; journal content never
// appears (entry content is opaque bytes the server cannot read anyway).
func (h handlers) failure(ctx context.Context, message string, err error) apigen.Error {
	h.logger.LogAttrs(ctx, slog.LevelError, message, slog.String("error", err.Error()))
	if hub := sentry.GetHubFromContext(ctx); hub != nil {
		hub.CaptureException(err)
	}
	return apigen.Error{Message: message}
}

// New builds the API handler on top of a database pool and storage client.
func New(logger *slog.Logger, pool *pgxpool.Pool, verifier *auth.Verifier, store ObjectStore) http.Handler {
	return NewWithQuerier(logger, dbgen.New(pool), verifier, store)
}

// NewWithQuerier exists so tests can inject fault-injecting Querier/store
// implementations for error paths unreachable through the real platform;
// behavior tests use New against local Supabase.
func NewWithQuerier(logger *slog.Logger, queries dbgen.Querier, verifier *auth.Verifier, store ObjectStore) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(logging.AccessLog(logger))
	// Recoverer turns panics into 500s; the Sentry handler inside it captures
	// the panic and repanics so Recoverer still sees it.
	router.Use(middleware.Recoverer)
	router.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)
	router.Use(auth.Middleware(verifier, map[string]bool{"/health": true}))
	router.Use(deactivationGate(queries, logger))
	h := handlers{logger: logger, queries: queries, store: store}
	return apigen.HandlerFromMux(apigen.NewStrictHandler(h, nil), router)
}
