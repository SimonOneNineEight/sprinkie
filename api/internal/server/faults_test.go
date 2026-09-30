package server_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
)

// failingQuerier fault-injects database errors that are unreachable through
// the real database (a live Postgres cannot fail on exactly one of the three
// provisioning calls). Behavior tests never mock the platform; this exists
// only to prove /me fails closed on each step.
type failingQuerier struct {
	provisionErr   error
	journalErr     error
	categoriesErr  error
	categoryErr    error
	insertErr      error
	listEntriesErr error
	monthDotsErr   error
	updateErr      error
	deleteErr      error
	listIDsErr     error
	reorderErr     error
	insertCatErr   error
	subcategoryErr error
	yearListErr    error
	yearCountErr   error
	catParentErr   error
	updateCatErr   error
	cascadeErr     error
	usageErr       error
	deleteCatErr   error
	deleteCatZero  bool
	ownedEntryErr  error
	countPhotosErr error
	insertPhotoErr error
	// insertPhotosEmpty simulates the in-statement cap guard firing under a
	// concurrent register: no error, zero rows inserted.
	insertPhotosEmpty bool
	listPhotosErr     error
	deletePhotoErr    error
	listPhotoIDsErr   error
	reorderPhotosErr  error
	saveColorErr      error
	trimColorErr      error
	listColorsErr     error
	forgetColorErr    error
	statusErr         error
	statusDeleted     bool
	deactivateErr     error
	reactivateErr     error
	reactivateRows    bool
	auditErr          error
}

func (f failingQuerier) GetSchemaVersion(context.Context) (int32, error) { return 1, nil }
func (f failingQuerier) GetAccountStatus(context.Context, string) (pgtype.Timestamptz, error) {
	if f.statusDeleted {
		return pgtype.Timestamptz{Time: time.Now(), Valid: true}, nil
	}
	return pgtype.Timestamptz{}, f.statusErr
}
func (f failingQuerier) DeactivateAccount(context.Context, string) (int64, error) {
	return 1, f.deactivateErr
}
func (f failingQuerier) ReactivateAccount(context.Context, string) (int64, error) {
	if f.reactivateRows {
		return 1, f.reactivateErr
	}
	return 0, f.reactivateErr
}
func (f failingQuerier) InsertAccountAudit(context.Context, dbgen.InsertAccountAuditParams) error {
	return f.auditErr
}
func (f failingQuerier) ListAccountAudit(context.Context, string) ([]dbgen.ListAccountAuditRow, error) {
	return nil, nil
}
func (f failingQuerier) ListPurgeDue(context.Context, pgtype.Timestamptz) ([]string, error) {
	return nil, nil
}
func (f failingQuerier) ListUserPhotoPaths(context.Context, string) ([]dbgen.ListUserPhotoPathsRow, error) {
	return nil, nil
}
func (f failingQuerier) PurgeUserEntries(context.Context, string) (int64, error) { return 0, nil }
func (f failingQuerier) PurgeUserChildCategories(context.Context, string) (int64, error) {
	return 0, nil
}
func (f failingQuerier) PurgeUserParentCategories(context.Context, string) (int64, error) {
	return 0, nil
}
func (f failingQuerier) PurgeUserColorRecents(context.Context, string) (int64, error) { return 0, nil }
func (f failingQuerier) PurgeUserJournal(context.Context, string) (int64, error)      { return 0, nil }
func (f failingQuerier) PurgeUserRow(context.Context, string) (int64, error)          { return 0, nil }
func (f failingQuerier) ProvisionUser(context.Context, dbgen.ProvisionUserParams) error {
	return f.provisionErr
}
func (f failingQuerier) GetJournal(context.Context, string) (string, error) {
	return "journal-id", f.journalErr
}
func (f failingQuerier) ListCategories(context.Context, string) ([]dbgen.ListCategoriesRow, error) {
	return nil, f.categoriesErr
}
func (f failingQuerier) CategoryIsUsable(context.Context, dbgen.CategoryIsUsableParams) (bool, error) {
	return true, f.categoryErr
}
func (f failingQuerier) InsertEntry(context.Context, dbgen.InsertEntryParams) (dbgen.InsertEntryRow, error) {
	return dbgen.InsertEntryRow{ID: "entry-id", Position: 1}, f.insertErr
}
func (f failingQuerier) ListEntriesByDate(context.Context, dbgen.ListEntriesByDateParams) ([]dbgen.ListEntriesByDateRow, error) {
	return nil, f.listEntriesErr
}
func (f failingQuerier) ListMonthDots(context.Context, dbgen.ListMonthDotsParams) ([]dbgen.ListMonthDotsRow, error) {
	return nil, f.monthDotsErr
}
func (f failingQuerier) ListYearFirstCategories(context.Context, dbgen.ListYearFirstCategoriesParams) ([]dbgen.ListYearFirstCategoriesRow, error) {
	return nil, f.yearListErr
}
func (f failingQuerier) CountYearEntries(context.Context, dbgen.CountYearEntriesParams) (int64, error) {
	return 0, f.yearCountErr
}
func (f failingQuerier) UpdateEntry(context.Context, dbgen.UpdateEntryParams) (dbgen.UpdateEntryRow, error) {
	return dbgen.UpdateEntryRow{ID: "entry-id", Position: 1}, f.updateErr
}
func (f failingQuerier) DeleteEntry(context.Context, dbgen.DeleteEntryParams) (int64, error) {
	return 1, f.deleteErr
}
func (f failingQuerier) ListEntryIDs(context.Context, dbgen.ListEntryIDsParams) ([]string, error) {
	return []string{"7f000000-0000-4000-8000-00000000000a"}, f.listIDsErr
}
func (f failingQuerier) ReorderEntries(context.Context, dbgen.ReorderEntriesParams) error {
	return f.reorderErr
}
func (f failingQuerier) GetOwnedEntry(context.Context, dbgen.GetOwnedEntryParams) (string, error) {
	return "7f000000-0000-4000-8000-00000000000a", f.ownedEntryErr
}
func (f failingQuerier) CountPhotos(context.Context, string) (int64, error) {
	return 0, f.countPhotosErr
}
func (f failingQuerier) InsertPhotos(context.Context, dbgen.InsertPhotosParams) ([]string, error) {
	if f.insertPhotosEmpty {
		return nil, nil
	}
	return []string{"photo-id"}, f.insertPhotoErr
}
func (f failingQuerier) ListPhotosForEntries(context.Context, []string) ([]dbgen.ListPhotosForEntriesRow, error) {
	if f.listPhotosErr != nil {
		return nil, f.listPhotosErr
	}
	return []dbgen.ListPhotosForEntriesRow{{
		ID: "photo-id", EntryID: "7f000000-0000-4000-8000-00000000000a",
		Position: 1, ObjectPath: "u/e/a.jpg", ThumbPath: "u/e/a_thumb.jpg",
	}}, nil
}
func (f failingQuerier) ListPhotoIDs(context.Context, string) ([]string, error) {
	return []string{"7f000000-0000-4000-8000-00000000000b"}, f.listPhotoIDsErr
}
func (f failingQuerier) ReorderPhotos(context.Context, dbgen.ReorderPhotosParams) error {
	return f.reorderPhotosErr
}
func (f failingQuerier) DeletePhoto(context.Context, dbgen.DeletePhotoParams) (dbgen.DeletePhotoRow, error) {
	return dbgen.DeletePhotoRow{ObjectPath: "u/e/x.jpg", ThumbPath: "u/e/x_thumb.jpg"}, f.deletePhotoErr
}

// fakeStore fault-injects the storage client. failAfter lets a call succeed
// N times and fail on the N+1th, for branches behind an earlier success.
type fakeStore struct {
	signUploadErr       error
	signUploadOKCalls   int
	signDownloadErr     error
	signDownloadOKCalls int
	removeErr           error
	uploads             int
	downloads           int
}

func (f *fakeStore) SignUpload(_ context.Context, path string) (string, error) {
	f.uploads++
	if f.signUploadErr != nil && f.uploads > f.signUploadOKCalls {
		return "", f.signUploadErr
	}
	return "http://storage.local/upload/" + path, nil
}
func (f *fakeStore) SignDownloads(_ context.Context, paths []string, _ time.Duration) (map[string]string, error) {
	f.downloads++
	if f.signDownloadErr != nil && f.downloads > f.signDownloadOKCalls {
		return nil, f.signDownloadErr
	}
	urls := make(map[string]string, len(paths))
	for _, p := range paths {
		urls[p] = "http://storage.local/signed/" + p
	}
	return urls, nil
}
func (f *fakeStore) Remove(context.Context, []string) error { return f.removeErr }
func (f failingQuerier) InsertCategory(context.Context, dbgen.InsertCategoryParams) (dbgen.InsertCategoryRow, error) {
	return dbgen.InsertCategoryRow{ID: "category-id", Position: 1}, f.insertCatErr
}
func (f failingQuerier) SubcategoryIsUsable(context.Context, dbgen.SubcategoryIsUsableParams) (bool, error) {
	return true, f.subcategoryErr
}
func (f failingQuerier) GetCategoryParent(context.Context, dbgen.GetCategoryParentParams) (*string, error) {
	return nil, f.catParentErr
}
func (f failingQuerier) UpdateCategory(context.Context, dbgen.UpdateCategoryParams) (dbgen.UpdateCategoryRow, error) {
	return dbgen.UpdateCategoryRow{ID: "category-id", Name: "x", Color: "#111111", Icon: "tag", Position: 1}, f.updateCatErr
}
func (f failingQuerier) CascadeChildColors(context.Context, dbgen.CascadeChildColorsParams) error {
	return f.cascadeErr
}
func (f failingQuerier) CategoryUsage(context.Context, string) (dbgen.CategoryUsageRow, error) {
	return dbgen.CategoryUsageRow{}, f.usageErr
}
func (f failingQuerier) DeleteCategory(context.Context, dbgen.DeleteCategoryParams) (int64, error) {
	if f.deleteCatZero {
		return 0, nil
	}
	return 1, f.deleteCatErr
}
func (f failingQuerier) SaveColorRecent(context.Context, dbgen.SaveColorRecentParams) error {
	return f.saveColorErr
}
func (f failingQuerier) TrimColorRecents(context.Context, dbgen.TrimColorRecentsParams) error {
	return f.trimColorErr
}
func (f failingQuerier) ListColorRecents(context.Context, string) ([]string, error) {
	return []string{"#123456"}, f.listColorsErr
}
func (f failingQuerier) ForgetColorRecent(context.Context, dbgen.ForgetColorRecentParams) error {
	return f.forgetColorErr
}

func TestColorRecentsFailClosedOnDatabaseErrors(t *testing.T) {
	token := signUpTestUser(t)
	cases := map[string]struct {
		querier failingQuerier
		run     func(t *testing.T, ts *httptest.Server)
	}{
		"list fails": {failingQuerier{listColorsErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, listColorRecents(t, ts, token), 500)
		}},
		"save fails": {failingQuerier{saveColorErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, saveColorRecent(t, ts, token, "#123456"), 500)
		}},
		"trim fails": {failingQuerier{trimColorErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, saveColorRecent(t, ts, token, "#123456"), 500)
		}},
		"relist fails": {failingQuerier{listColorsErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, saveColorRecent(t, ts, token, "#123456"), 500)
		}},
		"forget fails": {failingQuerier{forgetColorErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, forgetColorRecent(t, ts, token, "123456"), 500)
		}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), c.querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			c.run(t, ts)
		})
	}
}

func TestEntriesFailClosedOnDatabaseErrors(t *testing.T) {
	token := signUpTestUser(t)
	valid := map[string]string{
		"date": "2026-08-19", "categoryId": "7f000000-0000-4000-8000-000000000000", "content": "x",
	}
	createCases := map[string]failingQuerier{
		"journal read fails":   {journalErr: errors.New("boom")},
		"category check fails": {categoryErr: errors.New("boom")},
		"insert fails":         {insertErr: errors.New("boom")},
	}
	for name, querier := range createCases {
		t.Run("create/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			resp := createEntry(t, ts, token, valid)
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
	listCases := map[string]failingQuerier{
		"journal read fails": {journalErr: errors.New("boom")},
		"list fails":         {listEntriesErr: errors.New("boom")},
	}
	for name, querier := range listCases {
		t.Run("list/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			resp := listEntries(t, ts, token, "2026-08-19")
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
	editCases := map[string]struct {
		querier failingQuerier
		run     func(t *testing.T, ts *httptest.Server)
	}{
		"update journal fails": {failingQuerier{journalErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a", map[string]string{"categoryId": "7f000000-0000-4000-8000-000000000000", "content": "x"}), 500)
		}},
		"update category fails": {failingQuerier{categoryErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a", map[string]string{"categoryId": "7f000000-0000-4000-8000-000000000000", "content": "x"}), 500)
		}},
		"update subcategory check fails": {failingQuerier{subcategoryErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a", map[string]string{"categoryId": "7f000000-0000-4000-8000-000000000000", "subcategoryId": "7f000000-0000-4000-8000-000000000001", "content": "x"}), 500)
		}},
		"update fails": {failingQuerier{updateErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a", map[string]string{"categoryId": "7f000000-0000-4000-8000-000000000000", "content": "x"}), 500)
		}},
		"delete journal fails": {failingQuerier{journalErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 500)
		}},
		"delete fails": {failingQuerier{deleteErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 500)
		}},
		"reorder journal fails": {failingQuerier{journalErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, reorderDay(t, ts, token, "2026-05-09", []string{"7f000000-0000-4000-8000-00000000000a"}), 500)
		}},
		"reorder list-ids fails": {failingQuerier{listIDsErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, reorderDay(t, ts, token, "2026-05-09", []string{"7f000000-0000-4000-8000-00000000000a"}), 500)
		}},
		"reorder fails": {failingQuerier{reorderErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, reorderDay(t, ts, token, "2026-05-09", []string{"7f000000-0000-4000-8000-00000000000a"}), 500)
		}},
		"reorder relist fails": {failingQuerier{listEntriesErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, reorderDay(t, ts, token, "2026-05-09", []string{"7f000000-0000-4000-8000-00000000000a"}), 500)
		}},
	}
	for name, c := range editCases {
		t.Run("edit/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), c.querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			c.run(t, ts)
		})
	}
	subCases := map[string]failingQuerier{
		"subcategory check fails": {subcategoryErr: errors.New("boom")},
	}
	for name, querier := range subCases {
		t.Run("create/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			withSub := map[string]string{
				"date": "2026-08-19", "categoryId": "7f000000-0000-4000-8000-000000000000",
				"content": "x", "subcategoryId": "7f000000-0000-4000-8000-000000000001",
			}
			resp := createEntry(t, ts, token, withSub)
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
	photoCases := map[string]struct {
		querier failingQuerier
		store   *fakeStore
		run     func(t *testing.T, ts *httptest.Server)
	}{
		"presign owned-entry fails": {failingQuerier{ownedEntryErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, presignPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", 1), 500)
		}},
		"presign count fails": {failingQuerier{countPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, presignPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", 1), 500)
		}},
		"presign sign-upload fails": {failingQuerier{}, &fakeStore{signUploadErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, presignPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", 1), 500)
		}},
		"presign thumb sign fails": {failingQuerier{}, &fakeStore{signUploadErr: errors.New("boom"), signUploadOKCalls: 1}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, presignPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", 1), 500)
		}},
		"register owned-entry fails": {failingQuerier{ownedEntryErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", nil), 500)
		}},
		"register count fails": {failingQuerier{countPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", []map[string]string{
				{"objectPath": "u/e/a.jpg", "thumbPath": "u/e/a_thumb.jpg"},
			}), 500)
		}},
		"register insert fails": {failingQuerier{insertPhotoErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			sub := tokenSub(t, token)
			prefix := sub + "/7f000000-0000-4000-8000-00000000000a/"
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", []map[string]string{
				{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg"},
			}), 500)
		}},
		"register cap raced": {failingQuerier{insertPhotosEmpty: true}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			sub := tokenSub(t, token)
			prefix := sub + "/7f000000-0000-4000-8000-00000000000a/"
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", []map[string]string{
				{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg"},
			}), 400)
		}},
		"register relist-sign fails": {failingQuerier{}, &fakeStore{signDownloadErr: errors.New("boom"), signDownloadOKCalls: 1}, func(t *testing.T, ts *httptest.Server) {
			sub := tokenSub(t, token)
			prefix := sub + "/7f000000-0000-4000-8000-00000000000a/"
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", []map[string]string{
				{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg"},
			}), 500)
		}},
		"register relist fails": {failingQuerier{listPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			sub := tokenSub(t, token)
			prefix := sub + "/7f000000-0000-4000-8000-00000000000a/"
			checkStatus(t, registerPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", []map[string]string{
				{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg"},
			}), 500)
		}},
		"delete photo fails": {failingQuerier{deletePhotoErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deletePhotoReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 500)
		}},
		"delete photo cleanup fails soft": {failingQuerier{}, &fakeStore{removeErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deletePhotoReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 204)
		}},
		"list photos fails": {failingQuerier{listPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, listEntries(t, ts, token, "2026-06-03"), 500)
		}},
		"list sign fails": {failingQuerier{listEntriesErr: nil, listPhotosErr: nil}, &fakeStore{signDownloadErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, listEntries(t, ts, token, "2026-06-03"), 500)
		}},
		"reorder photos fail": {failingQuerier{listPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, reorderDay(t, ts, token, "2026-06-03", []string{"7f000000-0000-4000-8000-00000000000a"}), 500)
		}},
		"entry-delete photo snapshot fails": {failingQuerier{listPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 500)
		}},
		"entry-delete cleanup fails soft": {failingQuerier{}, &fakeStore{removeErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteEntry(t, ts, token, "7f000000-0000-4000-8000-00000000000a"), 204)
		}},
	}
	photoIDs := []string{"7f000000-0000-4000-8000-00000000000b"}
	photoCases["photo-reorder owned fails"] = struct {
		querier failingQuerier
		store   *fakeStore
		run     func(t *testing.T, ts *httptest.Server)
	}{failingQuerier{ownedEntryErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
		checkStatus(t, reorderPhotosReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a", photoIDs), 500)
	}}
	photoCases["photo-reorder ids fail"] = struct {
		querier failingQuerier
		store   *fakeStore
		run     func(t *testing.T, ts *httptest.Server)
	}{failingQuerier{listPhotoIDsErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
		checkStatus(t, reorderPhotosReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a", photoIDs), 500)
	}}
	photoCases["photo-reorder update fails"] = struct {
		querier failingQuerier
		store   *fakeStore
		run     func(t *testing.T, ts *httptest.Server)
	}{failingQuerier{reorderPhotosErr: errors.New("boom")}, &fakeStore{}, func(t *testing.T, ts *httptest.Server) {
		checkStatus(t, reorderPhotosReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a", photoIDs), 500)
	}}
	photoCases["photo-reorder resign fails"] = struct {
		querier failingQuerier
		store   *fakeStore
		run     func(t *testing.T, ts *httptest.Server)
	}{failingQuerier{}, &fakeStore{signDownloadErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
		checkStatus(t, reorderPhotosReq(t, ts, token, "7f000000-0000-4000-8000-00000000000a", photoIDs), 500)
	}}
	for name, c := range photoCases {
		t.Run("photos/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), c.querier, auth.NewVerifier(testJWKSURL()), c.store))
			defer ts.Close()
			c.run(t, ts)
		})
	}
	monthCases := map[string]failingQuerier{
		"journal read fails": {journalErr: errors.New("boom")},
		"month dots fail":    {monthDotsErr: errors.New("boom")},
	}
	for name, querier := range monthCases {
		t.Run("month/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			resp := getMonth(t, ts, token, "2026-08")
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
	accountCases := map[string]struct {
		querier failingQuerier
		run     func(t *testing.T, ts *httptest.Server)
	}{
		"deactivate fails": {failingQuerier{deactivateErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := deactivate(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"deactivate audit fails": {failingQuerier{auditErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := deactivate(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"reactivate fails": {failingQuerier{reactivateErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := reactivate(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"reactivate audit fails": {failingQuerier{reactivateRows: true, auditErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := reactivate(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"reactivate world fails": {failingQuerier{journalErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := reactivate(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"provision status check fails": {failingQuerier{statusErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := postMe(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"provision refuses the deactivated": {failingQuerier{statusDeleted: true}, func(t *testing.T, ts *httptest.Server) {
			resp := postMe(t, ts, token)
			resp.Body.Close()
			checkStatus(t, resp, 403)
		}},
		"gate check fails": {failingQuerier{statusErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			resp := getMonth(t, ts, token, "2026-08")
			resp.Body.Close()
			checkStatus(t, resp, 500)
		}},
		"gate passes the unprovisioned": {failingQuerier{statusErr: pgx.ErrNoRows}, func(t *testing.T, ts *httptest.Server) {
			resp := getMonth(t, ts, token, "2026-08")
			resp.Body.Close()
			checkStatus(t, resp, 200)
		}},
		"gate blocks the deactivated": {failingQuerier{statusDeleted: true}, func(t *testing.T, ts *httptest.Server) {
			resp := getMonth(t, ts, token, "2026-08")
			resp.Body.Close()
			checkStatus(t, resp, 403)
		}},
	}
	for name, c := range accountCases {
		t.Run("account/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), c.querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			c.run(t, ts)
		})
	}
	yearCases := map[string]failingQuerier{
		"journal read fails": {journalErr: errors.New("boom")},
		"year list fails":    {yearListErr: errors.New("boom")},
		"year count fails":   {yearCountErr: errors.New("boom")},
	}
	for name, querier := range yearCases {
		t.Run("year/"+name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			resp := getYear(t, ts, token, "2026")
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
}

func TestCategoriesFailClosedOnDatabaseErrors(t *testing.T) {
	token := signUpTestUser(t)
	parentID := "7f000000-0000-4000-8000-000000000000"
	cases := map[string]struct {
		querier failingQuerier
		body    map[string]string
	}{
		"parent check fails": {
			querier: failingQuerier{categoryErr: errors.New("boom")},
			body:    map[string]string{"name": "x", "color": "#111111", "parentId": parentID},
		},
		"insert fails": {
			querier: failingQuerier{insertCatErr: errors.New("boom")},
			body:    map[string]string{"name": "x", "color": "#111111"},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), tc.querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			resp := createCategory(t, ts, token, tc.body)
			resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
		})
	}
}

func TestCategoryEditsFailClosedOnDatabaseErrors(t *testing.T) {
	token := signUpTestUser(t)
	id := "7f000000-0000-4000-8000-00000000000b"
	cases := map[string]struct {
		querier failingQuerier
		run     func(t *testing.T, ts *httptest.Server)
	}{
		"patch gate fails": {failingQuerier{catParentErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchCategory(t, ts, token, id, map[string]string{"name": "x"}), 500)
		}},
		"patch update fails": {failingQuerier{updateCatErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchCategory(t, ts, token, id, map[string]string{"name": "x"}), 500)
		}},
		"patch cascade fails": {failingQuerier{cascadeErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, patchCategory(t, ts, token, id, map[string]string{"color": "#333333"}), 500)
		}},
		"delete gate fails": {failingQuerier{catParentErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteCategory(t, ts, token, id), 500)
		}},
		"delete usage fails": {failingQuerier{usageErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteCategory(t, ts, token, id), 500)
		}},
		"delete fails": {failingQuerier{deleteCatErr: errors.New("boom")}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteCategory(t, ts, token, id), 500)
		}},
		"delete races to zero rows": {failingQuerier{deleteCatZero: true}, func(t *testing.T, ts *httptest.Server) {
			checkStatus(t, deleteCategory(t, ts, token, id), 404)
		}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), c.querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()
			c.run(t, ts)
		})
	}
}

func TestMeFailsClosedOnDatabaseErrors(t *testing.T) {
	token := signUpTestUser(t)
	cases := map[string]failingQuerier{
		"provisioning fails":  {provisionErr: errors.New("boom")},
		"journal read fails":  {journalErr: errors.New("boom")},
		"category read fails": {categoriesErr: errors.New("boom")},
	}
	for name, querier := range cases {
		t.Run(name, func(t *testing.T) {
			ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), querier, auth.NewVerifier(testJWKSURL()), &fakeStore{}))
			defer ts.Close()

			resp := postMe(t, ts, token)
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", resp.StatusCode)
			}
			var body struct {
				Message string `json:"message"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.Message == "" {
				t.Errorf("500 body should carry an Error message, got err=%v message=%q", err, body.Message)
			}
		})
	}
}

func checkStatus(t *testing.T, resp *http.Response, want int) {
	t.Helper()
	resp.Body.Close()
	if resp.StatusCode != want {
		t.Fatalf("status = %d, want %d", resp.StatusCode, want)
	}
}
