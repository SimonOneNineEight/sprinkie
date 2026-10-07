package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SimonOneNineEight/sprinkie/api/gen/dbgen"
	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
)

type photoUpload struct {
	ObjectPath     string `json:"objectPath"`
	ThumbPath      string `json:"thumbPath"`
	UploadURL      string `json:"uploadUrl"`
	ThumbUploadURL string `json:"thumbUploadUrl"`
}

type photoBody struct {
	ID       string  `json:"id"`
	Position int     `json:"position"`
	URL      string  `json:"url"`
	ThumbURL string  `json:"thumbUrl"`
	TakenAt  *string `json:"takenAt"`
}

func presignPhotos(t *testing.T, ts *httptest.Server, token, entryID string, count int) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(map[string]int{"count": count})
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/entries/"+entryID+"/photos/presign", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST presign: %v", err)
	}
	return resp
}

func registerPhotos(t *testing.T, ts *httptest.Server, token, entryID string, photos []map[string]string) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(map[string]any{"photos": photos})
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/entries/"+entryID+"/photos", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST register: %v", err)
	}
	return resp
}

// uploadTo PUTs bytes to a presigned URL, as the app would.
func uploadTo(t *testing.T, url string, body []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build upload: %v", err)
	}
	req.Header.Set("Content-Type", "image/jpeg")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("upload status = %d, want 200", resp.StatusCode)
	}
}

func TestPhotoLifecycle(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	sub := tokenSub(t, token)
	category := provisionedCategory(t, ts, token)
	entry := decodeEntry(t, createEntry(t, ts, token, map[string]string{
		"date": "2026-06-01", "categoryId": category, "content": "photo day",
	}))

	// Presign two photos; paths must be namespaced to this user and entry.
	resp := presignPhotos(t, ts, token, entry.ID, 2)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("presign status = %d, want 200", resp.StatusCode)
	}
	var presigned struct {
		Uploads []photoUpload `json:"uploads"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&presigned); err != nil {
		t.Fatalf("decode presign: %v", err)
	}
	resp.Body.Close()
	if len(presigned.Uploads) != 2 {
		t.Fatalf("got %d uploads, want 2", len(presigned.Uploads))
	}
	prefix := sub + "/" + entry.ID + "/"
	for _, u := range presigned.Uploads {
		if !strings.HasPrefix(u.ObjectPath, prefix) || !strings.HasPrefix(u.ThumbPath, prefix) {
			t.Errorf("presigned path outside the user/entry namespace: %+v", u)
		}
	}

	// Upload real bytes to every presigned URL, exactly as the client would.
	for _, u := range presigned.Uploads {
		uploadTo(t, u.UploadURL, []byte("full-image-bytes"))
		uploadTo(t, u.ThumbUploadURL, []byte("thumb-bytes"))
	}

	// Register both; the second carries a capture time.
	taken := "2026-06-01T08:30:00Z"
	resp = registerPhotos(t, ts, token, entry.ID, []map[string]string{
		{"objectPath": presigned.Uploads[0].ObjectPath, "thumbPath": presigned.Uploads[0].ThumbPath},
		{"objectPath": presigned.Uploads[1].ObjectPath, "thumbPath": presigned.Uploads[1].ThumbPath, "takenAt": taken},
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register status = %d, want 201", resp.StatusCode)
	}
	var registered struct {
		Photos []photoBody `json:"photos"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&registered); err != nil {
		t.Fatalf("decode register: %v", err)
	}
	resp.Body.Close()
	if len(registered.Photos) != 2 {
		t.Fatalf("registered %d photos, want 2", len(registered.Photos))
	}
	for i, p := range registered.Photos {
		if p.Position != i+1 {
			t.Errorf("photo %d position = %d, want %d", i, p.Position, i+1)
		}
		if !strings.HasPrefix(p.URL, "http") || !strings.HasPrefix(p.ThumbURL, "http") {
			t.Errorf("photo %d urls not absolute: %+v", i, p)
		}
	}
	if registered.Photos[1].TakenAt == nil || *registered.Photos[1].TakenAt != taken {
		t.Errorf("takenAt = %v, want %s", registered.Photos[1].TakenAt, taken)
	}

	// The signed URL actually serves the uploaded bytes.
	got, err := http.Get(registered.Photos[0].URL)
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(got.Body); err != nil {
		t.Fatalf("read download: %v", err)
	}
	got.Body.Close()
	if buf.String() != "full-image-bytes" {
		t.Errorf("downloaded %q, want the uploaded bytes", buf.String())
	}

	// Day list carries the photos.
	listed := listDay(t, ts, token, "2026-06-01")
	if len(listed) != 1 || listed[0].Photos == nil || len(*listed[0].Photos) != 2 {
		t.Fatalf("day list should carry 2 photos, got %+v", listed)
	}

	// Drag order persists: reverse the two photos.
	reorderResp := reorderPhotosReq(t, ts, token, entry.ID, []string{registered.Photos[1].ID, registered.Photos[0].ID})
	if reorderResp.StatusCode != http.StatusOK {
		t.Fatalf("photo reorder status = %d, want 200", reorderResp.StatusCode)
	}
	var reordered struct {
		Photos []photoBody `json:"photos"`
	}
	if err := json.NewDecoder(reorderResp.Body).Decode(&reordered); err != nil {
		t.Fatalf("decode reorder: %v", err)
	}
	reorderResp.Body.Close()
	if reordered.Photos[0].ID != registered.Photos[1].ID || reordered.Photos[0].Position != 1 {
		t.Errorf("photo reorder did not persist: %+v", reordered.Photos)
	}

	// Reorder validation: a missing id is rejected.
	badReorder := reorderPhotosReq(t, ts, token, entry.ID, []string{registered.Photos[0].ID})
	badReorder.Body.Close()
	if badReorder.StatusCode != http.StatusBadRequest {
		t.Fatalf("partial photo reorder status = %d, want 400", badReorder.StatusCode)
	}

	// Delete one; the list shrinks.
	del := deletePhotoReq(t, ts, token, registered.Photos[0].ID)
	if del.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status = %d, want 204", del.StatusCode)
	}
	listed = listDay(t, ts, token, "2026-06-01")
	if len(*listed[0].Photos) != 1 {
		t.Errorf("after delete, %d photos remain, want 1", len(*listed[0].Photos))
	}
}

func reorderPhotosReq(t *testing.T, ts *httptest.Server, token, entryID string, photoIDs []string) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(map[string][]string{"photoIds": photoIDs})
	req, err := http.NewRequest(http.MethodPut, ts.URL+"/entries/"+entryID+"/photos/order", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT photo order: %v", err)
	}
	return resp
}

func deletePhotoReq(t *testing.T, ts *httptest.Server, token, id string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, ts.URL+"/photos/"+id, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE photo: %v", err)
	}
	resp.Body.Close()
	return resp
}

// uploadedPair presigns one photo pair and uploads bytes to both, returning
// the registered-ready paths.
func uploadedPair(t *testing.T, ts *httptest.Server, token, entryID string) (string, string) {
	t.Helper()
	resp := presignPhotos(t, ts, token, entryID, 1)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("presign status = %d, want 200", resp.StatusCode)
	}
	var presigned struct {
		Uploads []photoUpload `json:"uploads"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&presigned); err != nil {
		t.Fatalf("decode presign: %v", err)
	}
	resp.Body.Close()
	uploadTo(t, presigned.Uploads[0].UploadURL, []byte("bytes"))
	uploadTo(t, presigned.Uploads[0].ThumbUploadURL, []byte("thumb"))
	return presigned.Uploads[0].ObjectPath, presigned.Uploads[0].ThumbPath
}

func TestPhotoValidation(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	sub := tokenSub(t, token)
	category := provisionedCategory(t, ts, token)
	entry := decodeEntry(t, createEntry(t, ts, token, map[string]string{
		"date": "2026-06-02", "categoryId": category, "content": "x",
	}))
	prefix := sub + "/" + entry.ID + "/"

	stranger := signUpTestUser(t)
	provisionedCategory(t, ts, stranger)

	t.Run("presign count zero", func(t *testing.T) {
		resp := presignPhotos(t, ts, token, entry.ID, 0)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("presign beyond cap", func(t *testing.T) {
		resp := presignPhotos(t, ts, token, entry.ID, 4)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("presign stranger's entry", func(t *testing.T) {
		resp := presignPhotos(t, ts, stranger, entry.ID, 1)
		resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
	})
	t.Run("register stranger's entry", func(t *testing.T) {
		resp := registerPhotos(t, ts, stranger, entry.ID, []map[string]string{
			{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg"},
		})
		resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
	})
	t.Run("presign malformed entry id", func(t *testing.T) {
		resp := presignPhotos(t, ts, token, "not-a-uuid", 1)
		resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
	})
	t.Run("register foreign path", func(t *testing.T) {
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{
			{"objectPath": "someone-else/x.jpg", "thumbPath": prefix + "t.jpg"},
		})
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("register empty", func(t *testing.T) {
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{})
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("register bad takenAt", func(t *testing.T) {
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{
			{"objectPath": prefix + "a.jpg", "thumbPath": prefix + "a_thumb.jpg", "takenAt": "yesterday"},
		})
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("register beyond cap", func(t *testing.T) {
		photos := make([]map[string]string, 4)
		for i := range photos {
			photos[i] = map[string]string{
				"objectPath": prefix + strings.Repeat("a", i+1) + ".jpg",
				"thumbPath":  prefix + strings.Repeat("a", i+1) + "_thumb.jpg",
			}
		}
		resp := registerPhotos(t, ts, token, entry.ID, photos)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("register duplicate path", func(t *testing.T) {
		objectPath, thumbPath := uploadedPair(t, ts, token, entry.ID)
		photo := map[string]string{"objectPath": objectPath, "thumbPath": thumbPath}
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{photo})
		resp.Body.Close()
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("first register status = %d, want 201", resp.StatusCode)
		}
		resp = registerPhotos(t, ts, token, entry.ID, []map[string]string{photo})
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("duplicate register status = %d, want 400", resp.StatusCode)
		}
	})
	t.Run("register unuploaded path", func(t *testing.T) {
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{
			{"objectPath": prefix + "ghost.jpg", "thumbPath": prefix + "ghost_thumb.jpg"},
		})
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400 (uploads must exist before registering)", resp.StatusCode)
		}
	})
	t.Run("delete stranger's photo", func(t *testing.T) {
		objectPath, thumbPath := uploadedPair(t, ts, token, entry.ID)
		resp := registerPhotos(t, ts, token, entry.ID, []map[string]string{
			{"objectPath": objectPath, "thumbPath": thumbPath},
		})
		var registered struct {
			Photos []photoBody `json:"photos"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&registered); err != nil {
			t.Fatalf("decode: %v", err)
		}
		resp.Body.Close()
		last := registered.Photos[len(registered.Photos)-1]
		if del := deletePhotoReq(t, ts, stranger, last.ID); del.StatusCode != http.StatusNotFound {
			t.Fatalf("stranger delete status = %d, want 404", del.StatusCode)
		}
	})
	t.Run("photo-reorder on stranger's entry", func(t *testing.T) {
		resp := reorderPhotosReq(t, ts, stranger, entry.ID, []string{})
		resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", resp.StatusCode)
		}
	})
	t.Run("photo-reorder of an empty entry is a no-op", func(t *testing.T) {
		empty := decodeEntry(t, createEntry(t, ts, token, map[string]string{
			"date": "2026-06-04", "categoryId": category, "content": "no photos",
		}))
		resp := reorderPhotosReq(t, ts, token, empty.ID, []string{})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d, want 200", resp.StatusCode)
		}
		var list struct {
			Photos []photoBody `json:"photos"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&list); err != nil || len(list.Photos) != 0 {
			t.Fatalf("want empty photo list, got %v (err %v)", list.Photos, err)
		}
	})
	t.Run("delete malformed id", func(t *testing.T) {
		if del := deletePhotoReq(t, ts, token, "nope"); del.StatusCode != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", del.StatusCode)
		}
	})
}

func TestPhotosRequireAToken(t *testing.T) {
	ts := newTestServer(t)
	for name, resp := range map[string]*http.Response{
		"presign":  presignPhotos(t, ts, "", "x", 1),
		"register": registerPhotos(t, ts, "", "x", nil),
		"reorder":  reorderPhotosReq(t, ts, "", "x", nil),
		"delete":   deletePhotoReq(t, ts, "", "x"),
	} {
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("%s status = %d, want 401", name, resp.StatusCode)
		}
	}
}

// uploadedPairs presigns count photo pairs at once and uploads bytes to all
// of them, returning the register-ready paths. Nothing is registered, so a
// caller may presign again for the same Entry: the cap counts registered
// Photos, not minted URLs.
func uploadedPairs(t *testing.T, ts *httptest.Server, token, entryID string, count int) []photoUpload {
	t.Helper()
	resp := presignPhotos(t, ts, token, entryID, count)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("presign status = %d, want 200", resp.StatusCode)
	}
	var presigned struct {
		Uploads []photoUpload `json:"uploads"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&presigned); err != nil {
		t.Fatalf("decode presign: %v", err)
	}
	resp.Body.Close()
	for _, u := range presigned.Uploads {
		uploadTo(t, u.UploadURL, []byte("bytes"))
		uploadTo(t, u.ThumbUploadURL, []byte("thumb"))
	}
	return presigned.Uploads
}

// The cap of three is the server's to enforce (#44, ratified 2026-09-12),
// and it is existing + incoming: an Entry saved under the old cap of ten
// keeps every Photo it has and can only fail to gain more.
func TestPhotoCapOfThree(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	category := provisionedCategory(t, ts, token)
	entry := decodeEntry(t, createEntry(t, ts, token, map[string]string{
		"date": "2026-06-05", "categoryId": category, "content": "over the cap",
	}))

	// Two rounds of presigning, so there are more uploaded pairs than the
	// cap allows to be registered through the API.
	first := uploadedPairs(t, ts, token, entry.ID, 3)
	second := uploadedPairs(t, ts, token, entry.ID, 3)

	// Four Photos land as they did when the cap was ten: the same insert,
	// handed the cap of the day. Nothing else can put an Entry over three.
	objectPaths := []string{first[0].ObjectPath, first[1].ObjectPath, first[2].ObjectPath, second[0].ObjectPath}
	thumbPaths := []string{first[0].ThumbPath, first[1].ThumbPath, first[2].ThumbPath, second[0].ThumbPath}
	inserted, err := dbgen.New(testPool(t, testDatabaseURL())).InsertPhotos(t.Context(), dbgen.InsertPhotosParams{
		EntryID:     entry.ID,
		ObjectPaths: objectPaths,
		ThumbPaths:  thumbPaths,
		TakenAts:    make([]pgtype.Timestamptz, len(objectPaths)),
		MaxPhotos:   10,
	})
	if err != nil || len(inserted) != 4 {
		t.Fatalf("seeding four photos: inserted %d, err %v", len(inserted), err)
	}

	// Nothing is destroyed: the day list still carries all four.
	listed := listDay(t, ts, token, "2026-06-05")
	if len(listed) != 1 || listed[0].Photos == nil || len(*listed[0].Photos) != 4 {
		t.Fatalf("day list should still carry 4 photos, got %+v", listed)
	}

	// And the Entry can only fail to gain a fifth, at either arm.
	presign := presignPhotos(t, ts, token, entry.ID, 1)
	presign.Body.Close()
	if presign.StatusCode != http.StatusBadRequest {
		t.Errorf("presign onto an over-cap entry = %d, want 400", presign.StatusCode)
	}
	register := registerPhotos(t, ts, token, entry.ID, []map[string]string{
		{"objectPath": second[1].ObjectPath, "thumbPath": second[1].ThumbPath},
	})
	register.Body.Close()
	if register.StatusCode != http.StatusBadRequest {
		t.Errorf("register onto an over-cap entry = %d, want 400", register.StatusCode)
	}

	listed = listDay(t, ts, token, "2026-06-05")
	if len(*listed[0].Photos) != 4 {
		t.Errorf("after the refusals, %d photos remain, want 4", len(*listed[0].Photos))
	}
}

// A fresh Entry fills to exactly three through the API and stops there.
func TestPhotoCapFillsToThree(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	category := provisionedCategory(t, ts, token)
	entry := decodeEntry(t, createEntry(t, ts, token, map[string]string{
		"date": "2026-06-06", "categoryId": category, "content": "three photos",
	}))

	uploads := uploadedPairs(t, ts, token, entry.ID, 3)
	photos := make([]map[string]string, len(uploads))
	for i, u := range uploads {
		photos[i] = map[string]string{"objectPath": u.ObjectPath, "thumbPath": u.ThumbPath}
	}
	resp := registerPhotos(t, ts, token, entry.ID, photos)
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("registering three photos = %d, want 201", resp.StatusCode)
	}

	fourth := presignPhotos(t, ts, token, entry.ID, 1)
	defer fourth.Body.Close()
	if fourth.StatusCode != http.StatusBadRequest {
		t.Fatalf("presigning a fourth = %d, want 400", fourth.StatusCode)
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(fourth.Body).Decode(&body); err != nil {
		t.Fatalf("decode refusal: %v", err)
	}
	// The refusal names the cap it is enforcing, and names three.
	if body.Message != "an entry holds at most 3 photos" {
		t.Errorf("message = %q, want it to name the cap of three", body.Message)
	}
}

// gatedStore holds every SignUpload until want of them are in flight at
// once, so a handler that signs one URL after another never gets past the
// first and fails on the timeout instead of hanging.
type gatedStore struct {
	want    int
	mu      sync.Mutex
	arrived int
	all     chan struct{}
}

func (g *gatedStore) SignUpload(_ context.Context, path string) (string, error) {
	g.mu.Lock()
	g.arrived++
	if g.arrived == g.want {
		close(g.all)
	}
	g.mu.Unlock()
	select {
	case <-g.all:
		return "http://storage.local/upload/" + path, nil
	case <-time.After(2 * time.Second):
		return "", errors.New("upload URLs were signed one at a time")
	}
}
func (g *gatedStore) SignDownloads(context.Context, []string, time.Duration) (map[string]string, error) {
	return nil, errors.New("not used by presign")
}
func (g *gatedStore) Remove(context.Context, []string) error {
	return errors.New("not used by presign")
}

func TestPresignSignsUploadsAtOnce(t *testing.T) {
	token := signUpTestUser(t)
	// Three photos, each with a full and a thumb URL.
	store := &gatedStore{want: 6, all: make(chan struct{})}
	ts := httptest.NewServer(server.NewWithQuerier(discardLogger(), failingQuerier{}, auth.NewVerifier(testJWKSURL()), store))
	defer ts.Close()
	checkStatus(t, presignPhotos(t, ts, token, "7f000000-0000-4000-8000-00000000000a", 3), 200)
}
