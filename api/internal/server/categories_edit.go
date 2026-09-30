package server

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

func (h handlers) UpdateCategory(ctx context.Context, request apigen.UpdateCategoryRequestObject) (apigen.UpdateCategoryResponseObject, error) {
	if _, err := uuid.Parse(request.Id); err != nil {
		return apigen.UpdateCategory404JSONResponse{Message: "category not found"}, nil
	}
	body := request.Body
	if body.Name == nil && body.Color == nil && body.Icon == nil {
		return apigen.UpdateCategory400JSONResponse{Message: "nothing to update"}, nil
	}
	var name *string
	if body.Name != nil {
		trimmed := strings.TrimSpace(*body.Name)
		if trimmed == "" {
			return apigen.UpdateCategory400JSONResponse{Message: "name must not be empty"}, nil
		}
		name = &trimmed
	}
	if body.Color != nil && *body.Color == "" {
		return apigen.UpdateCategory400JSONResponse{Message: "color must not be empty"}, nil
	}
	if body.Icon != nil && *body.Icon == "" {
		return apigen.UpdateCategory400JSONResponse{Message: "icon must not be empty"}, nil
	}

	userID := auth.UserID(ctx)
	parentID, err := h.queries.GetCategoryParent(ctx, dbgen.GetCategoryParentParams{ID: request.Id, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return apigen.UpdateCategory404JSONResponse{Message: "category not found"}, nil
	}
	if err != nil {
		return apigen.UpdateCategory500JSONResponse(h.failure(ctx, "updating the category failed", err)), nil
	}
	// Subcategories inherit icon and color from their parent (spec: the
	// calendar stays legible because level 2 always renders as level 1).
	if parentID != nil && (body.Color != nil || body.Icon != nil) {
		return apigen.UpdateCategory400JSONResponse{Message: "subcategories inherit icon and color"}, nil
	}
	row, err := h.queries.UpdateCategory(ctx, dbgen.UpdateCategoryParams{
		ID:     request.Id,
		UserID: userID,
		Name:   textOrNull(name),
		Color:  textOrNull(body.Color),
		Icon:   textOrNull(body.Icon),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return apigen.UpdateCategory409JSONResponse{Message: "a category with this name already exists"}, nil
		}
		return apigen.UpdateCategory500JSONResponse(h.failure(ctx, "updating the category failed", err)), nil
	}
	if body.Color != nil && parentID == nil {
		// Children store a denormalized copy of the parent's color (#9);
		// keep the copies honest.
		if err := h.queries.CascadeChildColors(ctx, dbgen.CascadeChildColorsParams{
			Color:  *body.Color,
			ID:     request.Id,
			UserID: userID,
		}); err != nil {
			return apigen.UpdateCategory500JSONResponse(h.failure(ctx, "updating the category failed", err)), nil
		}
	}
	return apigen.UpdateCategory200JSONResponse{
		Id:       row.ID,
		Name:     row.Name,
		Color:    row.Color,
		Icon:     row.Icon,
		ParentId: row.ParentID,
		Position: int(row.Position),
	}, nil
}

func (h handlers) DeleteCategory(ctx context.Context, request apigen.DeleteCategoryRequestObject) (apigen.DeleteCategoryResponseObject, error) {
	if _, err := uuid.Parse(request.Id); err != nil {
		return apigen.DeleteCategory404JSONResponse{Message: "category not found"}, nil
	}
	userID := auth.UserID(ctx)
	if _, err := h.queries.GetCategoryParent(ctx, dbgen.GetCategoryParentParams{ID: request.Id, UserID: userID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apigen.DeleteCategory404JSONResponse{Message: "category not found"}, nil
		}
		return apigen.DeleteCategory500JSONResponse(h.failure(ctx, "deleting the category failed", err)), nil
	}
	usage, err := h.queries.CategoryUsage(ctx, request.Id)
	if err != nil {
		return apigen.DeleteCategory500JSONResponse(h.failure(ctx, "deleting the category failed", err)), nil
	}
	// Stable machine-readable codes (documented in the contract); the app
	// renders its own catalog copy. In-use wins when both apply, matching
	// the designed explanation's priority.
	if usage.InUse {
		return apigen.DeleteCategory409JSONResponse{Message: "category in use"}, nil
	}
	if usage.HasChildren {
		return apigen.DeleteCategory409JSONResponse{Message: "category has children"}, nil
	}
	deleted, err := h.queries.DeleteCategory(ctx, dbgen.DeleteCategoryParams{ID: request.Id, UserID: userID})
	if err != nil {
		return apigen.DeleteCategory500JSONResponse(h.failure(ctx, "deleting the category failed", err)), nil
	}
	if deleted == 0 {
		return apigen.DeleteCategory404JSONResponse{Message: "category not found"}, nil
	}
	return apigen.DeleteCategory204Response{}, nil
}

func textOrNull(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}
