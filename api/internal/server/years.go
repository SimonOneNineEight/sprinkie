package server

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

const yearLayout = "2006"

func (h handlers) GetYear(ctx context.Context, request apigen.GetYearRequestObject) (apigen.GetYearResponseObject, error) {
	firstDay, err := time.Parse(yearLayout, request.Year)
	if err != nil {
		return apigen.GetYear400JSONResponse{Message: "year must be YYYY"}, nil
	}
	cats, subs, ok := hiddenIDs(request.Params.HiddenCategories, request.Params.HiddenSubcategories)
	if !ok {
		return apigen.GetYear400JSONResponse{Message: "hidden ids must be UUIDs"}, nil
	}
	userID := auth.UserID(ctx)
	journalID, err := h.queries.GetJournal(ctx, userID)
	if err != nil {
		return apigen.GetYear500JSONResponse(h.failure(ctx, "loading the year failed", err)), nil
	}
	bounds := dbgen.ListYearFirstCategoriesParams{
		JournalID:            journalID,
		FirstDay:             pgtype.Date{Time: firstDay, Valid: true},
		NextYear:             pgtype.Date{Time: firstDay.AddDate(1, 0, 0), Valid: true},
		HiddenCategoryIds:    cats,
		HiddenSubcategoryIds: subs,
	}
	rows, err := h.queries.ListYearFirstCategories(ctx, bounds)
	if err != nil {
		return apigen.GetYear500JSONResponse(h.failure(ctx, "loading the year failed", err)), nil
	}
	total, err := h.queries.CountYearEntries(ctx, dbgen.CountYearEntriesParams{
		JournalID:            bounds.JournalID,
		FirstDay:             bounds.FirstDay,
		NextYear:             bounds.NextYear,
		HiddenCategoryIds:    cats,
		HiddenSubcategoryIds: subs,
	})
	if err != nil {
		return apigen.GetYear500JSONResponse(h.failure(ctx, "loading the year failed", err)), nil
	}

	days := make([]apigen.YearDay, len(rows))
	for i, row := range rows {
		days[i] = apigen.YearDay{Date: row.EntryDate, CategoryId: row.CategoryID}
	}
	return apigen.GetYear200JSONResponse{Days: days, TotalEntries: int(total)}, nil
}
