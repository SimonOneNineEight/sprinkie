package server

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/sync/errgroup"

	"github.com/SimonOneNineEight/sprinkie/api/gen/apigen"
	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

const (
	// The per-Entry Photo cap: three, lowered from ten (#44, ratified
	// 2026-09-12). This is the domain rule and the only place the server
	// states it — the insert re-checks it inside its own statement, but
	// takes the number from here. The check is existing + incoming, so an
	// Entry saved under the old cap keeps every Photo it has and simply
	// cannot gain more.
	maxPhotosPerEntry = 3
	downloadTTL       = time.Hour
)

// overCapMessage is the one wording for the cap, so the number can never
// disagree with the constant it reports.
var overCapMessage = fmt.Sprintf("an entry holds at most %d photos", maxPhotosPerEntry)

// photoPathPrefix namespaces object paths per user and Entry; presign only
// mints inside it and register only accepts inside it.
func photoPathPrefix(userID, entryID string) string {
	return userID + "/" + entryID + "/"
}

// ownedEntry resolves the entry when it belongs to the caller: "" means not
// found (or malformed id), which callers surface as 404.
func (h handlers) ownedEntry(ctx context.Context, userID, entryID string) (string, error) {
	if _, err := uuid.Parse(entryID); err != nil {
		return "", nil
	}
	id, err := h.queries.GetOwnedEntry(ctx, dbgen.GetOwnedEntryParams{EntryID: entryID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func (h handlers) PresignPhotos(ctx context.Context, request apigen.PresignPhotosRequestObject) (apigen.PresignPhotosResponseObject, error) {
	userID := auth.UserID(ctx)
	entryID, err := h.ownedEntry(ctx, userID, request.Id)
	if err != nil {
		return apigen.PresignPhotos500JSONResponse(h.failure(ctx, "presigning failed", err)), nil
	}
	if entryID == "" {
		return apigen.PresignPhotos404JSONResponse{Message: "entry not found"}, nil
	}
	count := request.Body.Count
	if count < 1 {
		return apigen.PresignPhotos400JSONResponse{Message: "count must be at least 1"}, nil
	}
	existing, err := h.queries.CountPhotos(ctx, entryID)
	if err != nil {
		return apigen.PresignPhotos500JSONResponse(h.failure(ctx, "presigning failed", err)), nil
	}
	if int(existing)+count > maxPhotosPerEntry {
		return apigen.PresignPhotos400JSONResponse{Message: overCapMessage}, nil
	}

	// Storage signs one path per request, so every URL is signed at once (#95).
	prefix := photoPathPrefix(userID, entryID)
	uploads := make([]apigen.PhotoUpload, count)
	g, gctx := errgroup.WithContext(ctx)
	for i := range uploads {
		name := uuid.NewString()
		u := &uploads[i]
		u.ObjectPath = prefix + name + ".jpg"
		u.ThumbPath = prefix + name + "_thumb.jpg"
		g.Go(func() (err error) {
			u.UploadUrl, err = h.store.SignUpload(gctx, u.ObjectPath)
			return err
		})
		g.Go(func() (err error) {
			u.ThumbUploadUrl, err = h.store.SignUpload(gctx, u.ThumbPath)
			return err
		})
	}
	if err := g.Wait(); err != nil {
		return apigen.PresignPhotos500JSONResponse(h.failure(ctx, "presigning failed", err)), nil
	}
	return apigen.PresignPhotos200JSONResponse{Uploads: uploads}, nil
}

func (h handlers) RegisterPhotos(ctx context.Context, request apigen.RegisterPhotosRequestObject) (apigen.RegisterPhotosResponseObject, error) {
	userID := auth.UserID(ctx)
	entryID, err := h.ownedEntry(ctx, userID, request.Id)
	if err != nil {
		return apigen.RegisterPhotos500JSONResponse(h.failure(ctx, "recording photos failed", err)), nil
	}
	if entryID == "" {
		return apigen.RegisterPhotos404JSONResponse{Message: "entry not found"}, nil
	}
	photos := request.Body.Photos
	if len(photos) == 0 {
		return apigen.RegisterPhotos400JSONResponse{Message: "photos are required"}, nil
	}
	existing, err := h.queries.CountPhotos(ctx, entryID)
	if err != nil {
		return apigen.RegisterPhotos500JSONResponse(h.failure(ctx, "recording photos failed", err)), nil
	}
	if int(existing)+len(photos) > maxPhotosPerEntry {
		return apigen.RegisterPhotos400JSONResponse{Message: overCapMessage}, nil
	}
	prefix := photoPathPrefix(userID, entryID)
	newPaths := make([]string, 0, len(photos)*2)
	objectPaths := make([]string, len(photos))
	thumbPaths := make([]string, len(photos))
	takenAts := make([]pgtype.Timestamptz, len(photos))
	for i, p := range photos {
		if !strings.HasPrefix(p.ObjectPath, prefix) || !strings.HasPrefix(p.ThumbPath, prefix) {
			return apigen.RegisterPhotos400JSONResponse{Message: "photo paths must belong to this entry"}, nil
		}
		if p.TakenAt != nil {
			t, err := time.Parse(time.RFC3339, *p.TakenAt)
			if err != nil {
				return apigen.RegisterPhotos400JSONResponse{Message: "takenAt must be RFC3339"}, nil
			}
			takenAts[i] = pgtype.Timestamptz{Time: t, Valid: true}
		}
		objectPaths[i] = p.ObjectPath
		thumbPaths[i] = p.ThumbPath
		newPaths = append(newPaths, p.ObjectPath, p.ThumbPath)
	}
	// Uploads must exist before any row lands: a signable object is the
	// proof. The insert itself is one statement, so a batch registers
	// all-or-nothing and the cap holds even under a concurrent register.
	if _, err := h.store.SignDownloads(ctx, newPaths, time.Minute); err != nil {
		return apigen.RegisterPhotos400JSONResponse{Message: "photos must be uploaded before registering"}, nil
	}
	inserted, err := h.queries.InsertPhotos(ctx, dbgen.InsertPhotosParams{
		EntryID:     entryID,
		ObjectPaths: objectPaths,
		ThumbPaths:  thumbPaths,
		TakenAts:    takenAts,
		MaxPhotos:   maxPhotosPerEntry,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return apigen.RegisterPhotos400JSONResponse{Message: "photo already registered"}, nil
		}
		return apigen.RegisterPhotos500JSONResponse(h.failure(ctx, "recording photos failed", err)), nil
	}
	if len(inserted) == 0 {
		// The in-statement cap guard fired: another register won the race.
		return apigen.RegisterPhotos400JSONResponse{Message: overCapMessage}, nil
	}
	byEntry, err := h.photosByEntry(ctx, []string{entryID})
	if err != nil {
		return apigen.RegisterPhotos500JSONResponse(h.failure(ctx, "recording photos failed", err)), nil
	}
	// Non-nil by construction: at least one photo was just registered.
	return apigen.RegisterPhotos201JSONResponse{Photos: byEntry[entryID]}, nil
}

func (h handlers) DeletePhoto(ctx context.Context, request apigen.DeletePhotoRequestObject) (apigen.DeletePhotoResponseObject, error) {
	if _, err := uuid.Parse(request.Id); err != nil {
		return apigen.DeletePhoto404JSONResponse{Message: "photo not found"}, nil
	}
	userID := auth.UserID(ctx)
	row, err := h.queries.DeletePhoto(ctx, dbgen.DeletePhotoParams{ID: request.Id, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return apigen.DeletePhoto404JSONResponse{Message: "photo not found"}, nil
	}
	if err != nil {
		return apigen.DeletePhoto500JSONResponse(h.failure(ctx, "deleting the photo failed", err)), nil
	}
	// Best-effort object cleanup: the row is authoritative; a failed object
	// removal is logged and reported, never surfaced.
	if err := h.store.Remove(ctx, []string{row.ObjectPath, row.ThumbPath}); err != nil {
		_ = h.failure(ctx, "photo object cleanup failed", err)
	}
	return apigen.DeletePhoto204Response{}, nil
}

// photosByEntry loads and signs every photo for the given entries in one
// storage round-trip, keyed by entry id.
func (h handlers) photosByEntry(ctx context.Context, entryIDs []string) (map[string][]apigen.Photo, error) {
	rows, err := h.queries.ListPhotosForEntries(ctx, entryIDs)
	if err != nil {
		return nil, err
	}
	paths := make([]string, 0, len(rows)*2)
	for _, row := range rows {
		paths = append(paths, row.ObjectPath, row.ThumbPath)
	}
	urls, err := h.store.SignDownloads(ctx, paths, downloadTTL)
	if err != nil {
		return nil, err
	}
	byEntry := make(map[string][]apigen.Photo, len(entryIDs))
	for _, row := range rows {
		photo := apigen.Photo{
			Id:       row.ID,
			Position: int(row.Position),
			Url:      urls[row.ObjectPath],
			ThumbUrl: urls[row.ThumbPath],
		}
		if row.TakenAt.Valid {
			taken := row.TakenAt.Time.UTC().Format(time.RFC3339)
			photo.TakenAt = &taken
		}
		byEntry[row.EntryID] = append(byEntry[row.EntryID], photo)
	}
	return byEntry, nil
}

func (h handlers) ReorderPhotos(ctx context.Context, request apigen.ReorderPhotosRequestObject) (apigen.ReorderPhotosResponseObject, error) {
	userID := auth.UserID(ctx)
	entryID, err := h.ownedEntry(ctx, userID, request.Id)
	if err != nil {
		return apigen.ReorderPhotos500JSONResponse(h.failure(ctx, "reordering photos failed", err)), nil
	}
	if entryID == "" {
		return apigen.ReorderPhotos404JSONResponse{Message: "entry not found"}, nil
	}
	existing, err := h.queries.ListPhotoIDs(ctx, entryID)
	if err != nil {
		return apigen.ReorderPhotos500JSONResponse(h.failure(ctx, "reordering photos failed", err)), nil
	}
	if !sameIDSet(existing, request.Body.PhotoIds) {
		return apigen.ReorderPhotos400JSONResponse{Message: "photoIds must be exactly the entry's photos"}, nil
	}
	if err := h.queries.ReorderPhotos(ctx, dbgen.ReorderPhotosParams{
		PhotoIds: request.Body.PhotoIds,
		EntryID:  entryID,
	}); err != nil {
		return apigen.ReorderPhotos500JSONResponse(h.failure(ctx, "reordering photos failed", err)), nil
	}
	byEntry, err := h.photosByEntry(ctx, []string{entryID})
	if err != nil {
		return apigen.ReorderPhotos500JSONResponse(h.failure(ctx, "reordering photos failed", err)), nil
	}
	photos := byEntry[entryID]
	if photos == nil {
		photos = []apigen.Photo{}
	}
	return apigen.ReorderPhotos200JSONResponse{Photos: photos}, nil
}
