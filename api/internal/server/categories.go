package server

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

// autoAssignedIcon is the glyph every inline-created category starts with
// (DESIGN.md ruling for the in-form quick step); category management (#10)
// makes it editable. "tag" names a lucide glyph, not a domain concept.
const autoAssignedIcon = "tag"

const uniqueViolation = "23505"

func (h handlers) CreateCategory(ctx context.Context, request apigen.CreateCategoryRequestObject) (apigen.CreateCategoryResponseObject, error) {
	body := request.Body
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return apigen.CreateCategory400JSONResponse{Message: "name is required"}, nil
	}
	if body.Color == "" {
		return apigen.CreateCategory400JSONResponse{Message: "color is required"}, nil
	}
	if body.ParentId != nil {
		if _, err := uuid.Parse(*body.ParentId); err != nil {
			return apigen.CreateCategory400JSONResponse{Message: "parentId must be a UUID"}, nil
		}
	}

	icon := autoAssignedIcon
	if body.Icon != nil {
		if strings.TrimSpace(*body.Icon) == "" {
			return apigen.CreateCategory400JSONResponse{Message: "icon must not be blank"}, nil
		}
		icon = *body.Icon
	}

	userID := auth.UserID(ctx)
	if body.ParentId != nil {
		// The parent must be the user's own top-level Category: two levels
		// is the maximum, so a Subcategory can never be a parent.
		usable, err := h.queries.CategoryIsUsable(ctx, dbgen.CategoryIsUsableParams{
			CategoryID: *body.ParentId,
			UserID:     userID,
		})
		if err != nil {
			return apigen.CreateCategory500JSONResponse(h.failure(ctx, "creating the category failed", err)), nil
		}
		if !usable {
			return apigen.CreateCategory400JSONResponse{Message: "parent category not found"}, nil
		}
	}

	row, err := h.queries.InsertCategory(ctx, dbgen.InsertCategoryParams{
		UserID:   userID,
		ParentID: body.ParentId,
		Name:     name,
		Color:    body.Color,
		Icon:     icon,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return apigen.CreateCategory409JSONResponse{Message: "a category with this name already exists"}, nil
		}
		return apigen.CreateCategory500JSONResponse(h.failure(ctx, "creating the category failed", err)), nil
	}
	fresh := false
	return apigen.CreateCategory201JSONResponse{
		Id:          row.ID,
		Name:        name,
		Color:       body.Color,
		Icon:        icon,
		ParentId:    body.ParentId,
		Position:    int(row.Position),
		InUse:       &fresh,
		HasChildren: &fresh,
	}, nil
}
