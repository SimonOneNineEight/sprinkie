package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

// Account lifecycle (#15): deactivation is immediate; restoring it takes the
// deliberate POST /me/reactivate until the 30-day purge (internal/purge)
// makes it permanent. The audit trail records every step.

func (h handlers) DeactivateMe(ctx context.Context, _ apigen.DeactivateMeRequestObject) (apigen.DeactivateMeResponseObject, error) {
	userID := auth.UserID(ctx)
	rows, err := h.queries.DeactivateAccount(ctx, userID)
	if err != nil {
		return apigen.DeactivateMe500JSONResponse(h.failure(ctx, "deactivation failed", err)), nil
	}
	// rows == 0 means already deactivated: idempotent, no second audit line.
	if rows > 0 {
		if err := h.queries.InsertAccountAudit(ctx, dbgen.InsertAccountAuditParams{
			UserID: userID,
			Event:  "deactivated",
		}); err != nil {
			return apigen.DeactivateMe500JSONResponse(h.failure(ctx, "deactivation failed", err)), nil
		}
	}
	return apigen.DeactivateMe204Response{}, nil
}

func (h handlers) ReactivateMe(ctx context.Context, _ apigen.ReactivateMeRequestObject) (apigen.ReactivateMeResponseObject, error) {
	userID := auth.UserID(ctx)
	rows, err := h.queries.ReactivateAccount(ctx, userID)
	if err != nil {
		return apigen.ReactivateMe500JSONResponse(h.failure(ctx, "reactivation failed", err)), nil
	}
	// rows == 0 is an already-active account: idempotent, no audit line.
	if rows > 0 {
		if err := h.queries.InsertAccountAudit(ctx, dbgen.InsertAccountAuditParams{
			UserID: userID,
			Event:  "reactivated",
		}); err != nil {
			return apigen.ReactivateMe500JSONResponse(h.failure(ctx, "reactivation failed", err)), nil
		}
	}
	world, err := h.world(ctx, userID)
	if err != nil {
		return apigen.ReactivateMe500JSONResponse(h.failure(ctx, "reactivation failed", err)), nil
	}
	return apigen.ReactivateMe200JSONResponse(world), nil
}

func writeErrorJSON(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(apigen.Error{Message: message})
}

// deactivationGate answers 403 on every route but the /me pair while an
// account is deactivated. POST /me/reactivate stays open as the deliberate
// restore, /me for provisioning's own 403 and idempotent deactivation;
// unauthenticated routes carry no user id and pass.
func deactivationGate(queries dbgen.Querier, logger *slog.Logger) func(http.Handler) http.Handler {
	exempt := map[string]bool{"/me": true, "/me/reactivate": true}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := auth.UserID(r.Context())
			if userID == "" || exempt[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}
			deletedAt, err := queries.GetAccountStatus(r.Context(), userID)
			// ErrNoRows is a signed-in user who never provisioned: active.
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				logger.Error("account check failed", "error", err)
				writeErrorJSON(w, http.StatusInternalServerError, "account check failed")
				return
			}
			if err == nil && deletedAt.Valid {
				writeErrorJSON(w, http.StatusForbidden, "account is deactivated")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
