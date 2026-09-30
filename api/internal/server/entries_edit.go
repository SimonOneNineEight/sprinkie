package server

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

func (h handlers) UpdateEntry(ctx context.Context, request apigen.UpdateEntryRequestObject) (apigen.UpdateEntryResponseObject, error) {
	if _, err := uuid.Parse(request.Id); err != nil {
		return apigen.UpdateEntry404JSONResponse{Message: "entry not found"}, nil
	}
	body := request.Body
	if msg := validateEntryInput(body.CategoryId, body.SubcategoryId, body.Content); msg != "" {
		return apigen.UpdateEntry400JSONResponse{Message: msg}, nil
	}
	// An optional date moves the Entry to that day (appended last); a null
	// pgtype.Date leaves entry_date and position untouched.
	var moveDate pgtype.Date
	if body.Date != nil {
		parsed, err := time.Parse(dateLayout, *body.Date)
		if err != nil {
			return apigen.UpdateEntry400JSONResponse{Message: "date must be YYYY-MM-DD"}, nil
		}
		moveDate = pgtype.Date{Time: parsed, Valid: true}
	}

	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.UpdateEntry500JSONResponse(h.failure(ctx, "updating the entry failed", err)), nil
	}
	badCategory, err := h.checkEntryCategories(ctx, userID, body.CategoryId, body.SubcategoryId)
	if err != nil {
		return apigen.UpdateEntry500JSONResponse(h.failure(ctx, "updating the entry failed", err)), nil
	}
	if badCategory != "" {
		return apigen.UpdateEntry400JSONResponse{Message: badCategory}, nil
	}
	row, err := h.queries.UpdateEntry(ctx, dbgen.UpdateEntryParams{
		ID:            request.Id,
		JournalID:     journalID,
		CategoryID:    body.CategoryId,
		SubcategoryID: body.SubcategoryId,
		Content:       []byte(body.Content),
		EntryDate:     moveDate,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return apigen.UpdateEntry404JSONResponse{Message: "entry not found"}, nil
	}
	if err != nil {
		return apigen.UpdateEntry500JSONResponse(h.failure(ctx, "updating the entry failed", err)), nil
	}
	return apigen.UpdateEntry200JSONResponse{
		Id:            row.ID,
		Date:          row.EntryDate,
		Position:      int(row.Position),
		CategoryId:    row.CategoryID,
		SubcategoryId: row.SubcategoryID,
		AuthorId:      row.AuthorID,
		Content:       string(row.Content),
	}, nil
}

func (h handlers) DeleteEntry(ctx context.Context, request apigen.DeleteEntryRequestObject) (apigen.DeleteEntryResponseObject, error) {
	if _, err := uuid.Parse(request.Id); err != nil {
		return apigen.DeleteEntry404JSONResponse{Message: "entry not found"}, nil
	}
	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.DeleteEntry500JSONResponse(h.failure(ctx, "deleting the entry failed", err)), nil
	}
	// Snapshot photo paths first: the row cascade wipes them with the entry.
	photoRows, err := h.queries.ListPhotosForEntries(ctx, []string{request.Id})
	if err != nil {
		return apigen.DeleteEntry500JSONResponse(h.failure(ctx, "deleting the entry failed", err)), nil
	}
	deleted, err := h.queries.DeleteEntry(ctx, dbgen.DeleteEntryParams{ID: request.Id, JournalID: journalID})
	if err != nil {
		return apigen.DeleteEntry500JSONResponse(h.failure(ctx, "deleting the entry failed", err)), nil
	}
	if deleted == 0 {
		return apigen.DeleteEntry404JSONResponse{Message: "entry not found"}, nil
	}
	if len(photoRows) > 0 {
		paths := make([]string, 0, len(photoRows)*2)
		for _, row := range photoRows {
			paths = append(paths, row.ObjectPath, row.ThumbPath)
		}
		// Best-effort object cleanup, logged on failure, never surfaced.
		if err := h.store.Remove(ctx, paths); err != nil {
			_ = h.failure(ctx, "entry photo cleanup failed", err)
		}
	}
	return apigen.DeleteEntry204Response{}, nil
}

func (h handlers) ReorderDay(ctx context.Context, request apigen.ReorderDayRequestObject) (apigen.ReorderDayResponseObject, error) {
	entryDate, err := time.Parse(dateLayout, request.Date)
	if err != nil {
		return apigen.ReorderDay400JSONResponse{Message: "date must be YYYY-MM-DD"}, nil
	}
	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.ReorderDay500JSONResponse(h.failure(ctx, "reordering failed", err)), nil
	}
	pgDate := pgtype.Date{Time: entryDate, Valid: true}
	existing, err := h.queries.ListEntryIDs(ctx, dbgen.ListEntryIDsParams{JournalID: journalID, EntryDate: pgDate})
	if err != nil {
		return apigen.ReorderDay500JSONResponse(h.failure(ctx, "reordering failed", err)), nil
	}
	if !sameIDSet(existing, request.Body.EntryIds) {
		return apigen.ReorderDay400JSONResponse{Message: "entryIds must be exactly the date's entries"}, nil
	}
	if err := h.queries.ReorderEntries(ctx, dbgen.ReorderEntriesParams{
		EntryIds:  request.Body.EntryIds,
		JournalID: journalID,
		EntryDate: pgDate,
	}); err != nil {
		return apigen.ReorderDay500JSONResponse(h.failure(ctx, "reordering failed", err)), nil
	}
	rows, err := h.queries.ListEntriesByDate(ctx, dbgen.ListEntriesByDateParams{JournalID: journalID, EntryDate: pgDate})
	if err != nil {
		return apigen.ReorderDay500JSONResponse(h.failure(ctx, "reordering failed", err)), nil
	}
	entries, err := h.entriesWithPhotos(ctx, rows)
	if err != nil {
		return apigen.ReorderDay500JSONResponse(h.failure(ctx, "reordering failed", err)), nil
	}
	return apigen.ReorderDay200JSONResponse{Entries: entries}, nil
}

// sameIDSet reports whether requested is exactly the existing ids: every id
// once, order free.
func sameIDSet(existing, requested []string) bool {
	if len(existing) != len(requested) {
		return false
	}
	counts := make(map[string]int, len(existing))
	for _, id := range existing {
		counts[id]++
	}
	for _, id := range requested {
		counts[id]--
		if counts[id] < 0 {
			return false
		}
	}
	return true
}
