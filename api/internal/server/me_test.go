package server_test

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
	"github.com/SimonOneNineEight/sprinkie/api/internal/server"
	"github.com/SimonOneNineEight/sprinkie/api/internal/storage"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Local Supabase demo values; CI overrides via `supabase status -o env`.
func testAuthURL() string {
	return envOr("SUPABASE_AUTH_URL", "http://127.0.0.1:55321/auth/v1")
}

func testPublishableKey() string {
	return envOr("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH")
}

func testJWKSURL() string {
	return envOr("SUPABASE_JWKS_URL", testAuthURL()+"/.well-known/jwks.json")
}

func testStorageURL() string {
	return envOr("SUPABASE_STORAGE_URL", "http://127.0.0.1:55321/storage/v1")
}

// testSecretKey resolves the storage secret from the environment (CI), or
// from the running local stack: the demo key is public CLI material, but
// embedding the literal here trips secret scanners by shape.
var testSecretKey = sync.OnceValue(func() string {
	if v := os.Getenv("SUPABASE_SECRET_KEY"); v != "" {
		return v
	}
	out, err := exec.Command("supabase", "status", "-o", "env").Output()
	if err != nil {
		panic("SUPABASE_SECRET_KEY is unset and `supabase status` failed (is the local stack up?): " + err.Error())
	}
	for _, line := range strings.Split(string(out), "\n") {
		if rest, ok := strings.CutPrefix(line, "SECRET_KEY="); ok {
			return strings.Trim(strings.TrimSpace(rest), `"`)
		}
	}
	panic("SECRET_KEY missing from `supabase status -o env` output")
})

func testStore() *storage.Client {
	return storage.New(testStorageURL(), testSecretKey())
}

// signUpTestUser registers a fresh user with real Supabase Auth and returns
// the access token GoTrue issued for it.
func signUpTestUser(t *testing.T) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{
		"email":    fmt.Sprintf("test-%d@wlog.local", time.Now().UnixNano()),
		"password": "test-password-123",
	})
	req, err := http.NewRequest(http.MethodPost, testAuthURL()+"/signup", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build signup request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", testPublishableKey())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("signup against local Supabase Auth: %v", err)
	}
	defer resp.Body.Close()
	var session struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil || session.AccessToken == "" {
		t.Fatalf("signup did not return an access token (status %d, err %v)", resp.StatusCode, err)
	}
	return session.AccessToken
}

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	handler := server.New(discardLogger(), testPool(t, testDatabaseURL()), auth.NewVerifier(testJWKSURL()), testStore())
	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)
	return ts
}

func postMe(t *testing.T, ts *httptest.Server, token string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/me", nil)
	if err != nil {
		t.Fatalf("build /me request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /me: %v", err)
	}
	return resp
}

// postMeLang provisions with a language field (#36): the one-time seeding
// hint naming the Starter Categories.
func postMeLang(t *testing.T, ts *httptest.Server, token, language string) *http.Response {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"language": language})
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/me", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build /me request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /me: %v", err)
	}
	return resp
}

type meBody struct {
	UserID     string `json:"userId"`
	JournalID  string `json:"journalId"`
	Categories []struct {
		ID       string  `json:"id"`
		Name     string  `json:"name"`
		Color    string  `json:"color"`
		Icon     string  `json:"icon"`
		ParentID *string `json:"parentId"`
		Position int     `json:"position"`
	} `json:"categories"`
}

func decodeMe(t *testing.T, resp *http.Response) meBody {
	t.Helper()
	defer resp.Body.Close()
	var me meBody
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		t.Fatalf("decode /me body: %v", err)
	}
	return me
}

func TestMeRequiresAToken(t *testing.T) {
	resp := postMe(t, newTestServer(t), "")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.Message == "" {
		t.Errorf("401 body should carry an Error message, got err=%v message=%q", err, body.Message)
	}
}

func TestMeRejectsGarbageToken(t *testing.T) {
	resp := postMe(t, newTestServer(t), "not-a-jwt")
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestMeRejectsWronglySignedToken(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"sub": "11111111-1111-1111-1111-111111111111",
		"aud": "authenticated",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = "not-a-real-key"
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	resp := postMe(t, newTestServer(t), signed)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestFirstSignInProvisionsWorld(t *testing.T) {
	ts := newTestServer(t)
	resp := postMe(t, ts, signUpTestUser(t))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	me := decodeMe(t, resp)

	if me.UserID == "" || me.JournalID == "" {
		t.Fatalf("userId/journalId missing: %+v", me)
	}
	if len(me.Categories) != 5 {
		t.Fatalf("got %d categories, want 5 seeds", len(me.Categories))
	}
	want := []struct{ name, color, icon string }{
		{"工作", "#4A93C4", "briefcase"},
		{"運動", "#73B062", "dumbbell"},
		{"美食", "#D3AE40", "utensils"},
		{"旅遊", "#D56E5C", "plane"},
		{"個人", "#A26FBD", "book-open"},
	}
	for i, w := range want {
		got := me.Categories[i]
		if got.Name != w.name || got.Color != w.color || got.Icon != w.icon {
			t.Errorf("category %d = %q/%q/%q, want %q/%q/%q", i, got.Name, got.Color, got.Icon, w.name, w.color, w.icon)
		}
		if got.Position != i+1 {
			t.Errorf("category %q position = %d, want %d", got.Name, got.Position, i+1)
		}
		if got.ParentID != nil {
			t.Errorf("seeded category %q has a parent, want top-level", got.Name)
		}
		if got.ID == "" {
			t.Errorf("category %q has no id", got.Name)
		}
	}
}

// The Starter Category sets (#36): en seeds English names with the same
// icons and colors as the Chinese set; zh-TW or an absent field seeds the
// current Chinese set exactly as today.
func assertStarterCategories(t *testing.T, me meBody, names [5]string) {
	t.Helper()
	if len(me.Categories) != 5 {
		t.Fatalf("got %d categories, want 5 seeds", len(me.Categories))
	}
	colors := [5]string{"#4A93C4", "#73B062", "#D3AE40", "#D56E5C", "#A26FBD"}
	icons := [5]string{"briefcase", "dumbbell", "utensils", "plane", "book-open"}
	for i := range names {
		got := me.Categories[i]
		if got.Name != names[i] || got.Color != colors[i] || got.Icon != icons[i] {
			t.Errorf("category %d = %q/%q/%q, want %q/%q/%q",
				i, got.Name, got.Color, got.Icon, names[i], colors[i], icons[i])
		}
	}
}

func TestProvisionSeedsEnglishStarterCategories(t *testing.T) {
	ts := newTestServer(t)
	resp := postMeLang(t, ts, signUpTestUser(t), "en")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	assertStarterCategories(t, decodeMe(t, resp),
		[5]string{"Work", "Exercise", "Food", "Travel", "Personal"})
}

func TestProvisionSeedsChineseWhenExplicit(t *testing.T) {
	ts := newTestServer(t)
	resp := postMeLang(t, ts, signUpTestUser(t), "zh-TW")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	assertStarterCategories(t, decodeMe(t, resp),
		[5]string{"工作", "運動", "美食", "旅遊", "個人"})
}

// The language field is a one-time seeding hint: a later provision call in
// another App Language must leave the existing Categories untouched — no
// renames, no second seed set (#36).
func TestLaterLanguageNeverRewritesCategories(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)

	first := decodeMe(t, postMe(t, ts, token))
	second := decodeMe(t, postMeLang(t, ts, token, "en"))

	assertStarterCategories(t, second, [5]string{"工作", "運動", "美食", "旅遊", "個人"})
	for i := range first.Categories {
		if second.Categories[i].ID != first.Categories[i].ID {
			t.Errorf("category %d id changed after an en re-provision", i)
		}
	}
}

func TestReSignInIsIdempotent(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)

	first := decodeMe(t, postMe(t, ts, token))
	second := decodeMe(t, postMe(t, ts, token))

	if second.JournalID != first.JournalID {
		t.Errorf("journalId changed across sign-ins: %q then %q", first.JournalID, second.JournalID)
	}
	if len(second.Categories) != 5 {
		t.Fatalf("re-sign-in grew categories to %d, want 5", len(second.Categories))
	}
	for i := range first.Categories {
		if second.Categories[i].ID != first.Categories[i].ID {
			t.Errorf("category %d id changed across sign-ins", i)
		}
	}
}
