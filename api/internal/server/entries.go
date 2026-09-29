package server

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

// maxContentBytes caps the opaque content blob at 64 KiB: room for a long
// note, not for abuse. The blob is stored and returned verbatim and never
// parsed (ADR-0004), which is also why the title requirement is enforced by
// the client, not here.
const maxContentBytes = 64 * 1024

const dateLayout = "2006-01-02"

// validateEntryInput returns the 400 message for a bad entry payload, or ""
// when the payload is well-formed. Shared by create and update.
func validateEntryInput(categoryID string, subcategoryID *string, content string) string {
	if _, err := uuid.Parse(categoryID); err != nil {
		return "categoryId must be a UUID"
	}
	if subcategoryID != nil {
		if _, err := uuid.Parse(*subcategoryID); err != nil {
			return "subcategoryId must be a UUID"
		}
	}
	if content == "" {
		return "content is required"
	}
	if len(content) > maxContentBytes {
		return "content exceeds 64 KiB"
	}
	return ""
}

// checkEntryCategories verifies the category is usable and, when given, the
// subcategory is a child of exactly that category. It returns the 400
// message, or an error for the 500 path.
func (h handlers) checkEntryCategories(ctx context.Context, userID, categoryID string, subcategoryID *string) (string, error) {
	usable, err := h.queries.CategoryIsUsable(ctx, dbgen.CategoryIsUsableParams{
		CategoryID: categoryID,
		UserID:     userID,
	})
	if err != nil {
		return "", err
	}
	if !usable {
		return "category not found", nil
	}
	if subcategoryID != nil {
		subUsable, err := h.queries.SubcategoryIsUsable(ctx, dbgen.SubcategoryIsUsableParams{
			SubcategoryID: *subcategoryID,
			UserID:        userID,
			CategoryID:    categoryID,
		})
		if err != nil {
			return "", err
		}
		if !subUsable {
			return "subcategory not found", nil
		}
	}
	return "", nil
}

func (h handlers) CreateEntry(ctx context.Context, request apigen.CreateEntryRequestObject) (apigen.CreateEntryResponseObject, error) {
	body := request.Body
	entryDate, err := time.Parse(dateLayout, body.Date)
	if err != nil {
		return apigen.CreateEntry400JSONResponse{Message: "date must be YYYY-MM-DD"}, nil
	}
	if msg := validateEntryInput(body.CategoryId, body.SubcategoryId, body.Content); msg != "" {
		return apigen.CreateEntry400JSONResponse{Message: msg}, nil
	}
	// The contract's cap, enforced by hand like every other constraint (no
	// validation middleware); an unchecked key would 500 in the index.
	if body.IdempotencyKey != nil && len(*body.IdempotencyKey) > 64 {
		return apigen.CreateEntry400JSONResponse{Message: "idempotencyKey is capped at 64 characters"}, nil
	}

	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.CreateEntry500JSONResponse(h.failure(ctx, "creating the entry failed", err)), nil
	}
	badCategory, err := h.checkEntryCategories(ctx, userID, body.CategoryId, body.SubcategoryId)
	if err != nil {
		return apigen.CreateEntry500JSONResponse(h.failure(ctx, "creating the entry failed", err)), nil
	}
	if badCategory != "" {
		return apigen.CreateEntry400JSONResponse{Message: badCategory}, nil
	}
	row, err := h.queries.InsertEntry(ctx, dbgen.InsertEntryParams{
		JournalID:      journalID,
		AuthorID:       userID,
		EntryDate:      pgtype.Date{Time: entryDate, Valid: true},
		CategoryID:     body.CategoryId,
		SubcategoryID:  body.SubcategoryId,
		Content:        []byte(body.Content),
		IdempotencyKey: textOrNull(body.IdempotencyKey),
	})
	if err != nil {
		return apigen.CreateEntry500JSONResponse(h.failure(ctx, "creating the entry failed", err)), nil
	}
	// Built from the returned row, not the request body: a keyed replay
	// returns the original Entry (#17), whose values the retry must see.
	return apigen.CreateEntry201JSONResponse{
		Id:            row.ID,
		Date:          row.EntryDate,
		Position:      int(row.Position),
		CategoryId:    row.CategoryID,
		SubcategoryId: row.SubcategoryID,
		AuthorId:      row.AuthorID,
		Content:       string(row.Content),
	}, nil
}

func (h handlers) ListEntries(ctx context.Context, request apigen.ListEntriesRequestObject) (apigen.ListEntriesResponseObject, error) {
	entryDate, err := time.Parse(dateLayout, request.Params.Date)
	if err != nil {
		return apigen.ListEntries400JSONResponse{Message: "date must be YYYY-MM-DD"}, nil
	}
	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.ListEntries500JSONResponse(h.failure(ctx, "listing entries failed", err)), nil
	}
	rows, err := h.queries.ListEntriesByDate(ctx, dbgen.ListEntriesByDateParams{
		JournalID: journalID,
		EntryDate: pgtype.Date{Time: entryDate, Valid: true},
	})
	if err != nil {
		return apigen.ListEntries500JSONResponse(h.failure(ctx, "listing entries failed", err)), nil
	}
	entries, err := h.entriesWithPhotos(ctx, rows)
	if err != nil {
		return apigen.ListEntries500JSONResponse(h.failure(ctx, "listing entries failed", err)), nil
	}
	return apigen.ListEntries200JSONResponse{Entries: entries}, nil
}

// entriesWithPhotos serializes a day's rows, attaching each entry's signed
// photos (empty slice when none, so clients always see an array).
func (h handlers) entriesWithPhotos(ctx context.Context, rows []dbgen.ListEntriesByDateRow) ([]apigen.Entry, error) {
	entryIDs := make([]string, len(rows))
	for i, row := range rows {
		entryIDs[i] = row.ID
	}
	photosByEntry, err := h.photosByEntry(ctx, entryIDs)
	if err != nil {
		return nil, err
	}
	entries := make([]apigen.Entry, len(rows))
	for i, row := range rows {
		photos := photosByEntry[row.ID]
		if photos == nil {
			photos = []apigen.Photo{}
		}
		entries[i] = apigen.Entry{
			Id:            row.ID,
			Date:          row.EntryDate,
			Position:      int(row.Position),
			CategoryId:    row.CategoryID,
			SubcategoryId: row.SubcategoryID,
			AuthorId:      row.AuthorID,
			Content:       string(row.Content),
			Photos:        &photos,
		}
	}
	return entries, nil
}
