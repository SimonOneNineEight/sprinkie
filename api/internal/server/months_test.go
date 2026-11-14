package server_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func getMonth(t *testing.T, ts *httptest.Server, token, month string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/months/"+month, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /months: %v", err)
	}
	return resp
}

type monthBody struct {
	Days []struct {
		Date        string   `json:"date"`
		CategoryIDs []string `json:"categoryIds"`
	} `json:"days"`
}

func decodeMonth(t *testing.T, resp *http.Response) monthBody {
	t.Helper()
	defer resp.Body.Close()
	var month monthBody
	if err := json.NewDecoder(resp.Body).Decode(&month); err != nil {
		t.Fatalf("decode month: %v", err)
	}
	return month
}

// mustCreateEntry creates an entry and fails the test on any non-201.
func mustCreateEntry(t *testing.T, ts *httptest.Server, token, date, categoryID string) {
	t.Helper()
	resp := createEntry(t, ts, token, map[string]string{
		"date": date, "categoryId": categoryID, "content": "x",
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create entry on %s: status %d", date, resp.StatusCode)
	}
}

func TestMonthReturnsDotsInEntryOrderWithinBoundaries(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	work, sport := me.Categories[0].ID, me.Categories[1].ID

	// Two entries on one mid-month day (order matters), one on the month's
	// first and last days, and two just outside either boundary.
	mustCreateEntry(t, ts, token, "2026-03-15", sport)
	mustCreateEntry(t, ts, token, "2026-03-15", work)
	mustCreateEntry(t, ts, token, "2026-03-01", work)
	mustCreateEntry(t, ts, token, "2026-03-31", sport)
	mustCreateEntry(t, ts, token, "2026-02-28", work)
	mustCreateEntry(t, ts, token, "2026-04-01", work)

	resp := getMonth(t, ts, token, "2026-03")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	month := decodeMonth(t, resp)

	if len(month.Days) != 3 {
		t.Fatalf("got %d days, want 3 (boundary entries must stay out)", len(month.Days))
	}
	if month.Days[0].Date != "2026-03-01" || month.Days[1].Date != "2026-03-15" || month.Days[2].Date != "2026-03-31" {
		t.Errorf("days out of order: %+v", month.Days)
	}
	if got := month.Days[1].CategoryIDs; len(got) != 2 || got[0] != sport || got[1] != work {
		t.Errorf("mid-month day dots not in entry order: %v (want [%s %s])", got, sport, work)
	}
}

func TestMonthValidation(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	provisionedCategory(t, ts, token)

	for _, bad := range []string{"2026", "2026-13", "March", "2026-03-15"} {
		resp := getMonth(t, ts, token, bad)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("month %q: status = %d, want 400", bad, resp.StatusCode)
		}
	}

	resp := getMonth(t, ts, token, "1999-06")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("empty month status = %d, want 200", resp.StatusCode)
	}
	if month := decodeMonth(t, resp); len(month.Days) != 0 {
		t.Errorf("empty month returned %d days, want 0", len(month.Days))
	}
}

func TestMonthHiddenSet(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	work, sport := me.Categories[0].ID, me.Categories[1].ID
	sub := decodeCategory(t, createCategory(t, ts, token, map[string]string{
		"name": "會議", "color": me.Categories[0].Color, "parentId": work,
	}))

	mustCreateEntry(t, ts, token, "2026-05-01", work)
	createEntry(t, ts, token, map[string]string{
		"date": "2026-05-02", "categoryId": work, "subcategoryId": sub.ID, "content": "x",
	}).Body.Close()
	mustCreateEntry(t, ts, token, "2026-05-03", sport)

	dates := func(month monthBody) []string {
		out := make([]string, len(month.Days))
		for i, day := range month.Days {
			out[i] = day.Date
		}
		return out
	}

	// A hidden category omits its unrefined entries; a refined entry
	// follows its subcategory and stays visible under the hidden parent.
	hideWork := decodeMonth(t, getMonth(t, ts, token, "2026-05?hiddenCategories="+work))
	if got := dates(hideWork); len(got) != 2 || got[0] != "2026-05-02" || got[1] != "2026-05-03" {
		t.Errorf("hidden-parent days = %v, want the sub day and the sport day", got)
	}
	// A hidden subcategory omits only its own entries.
	hideSub := decodeMonth(t, getMonth(t, ts, token, "2026-05?hiddenSubcategories="+sub.ID))
	if got := dates(hideSub); len(got) != 2 || got[0] != "2026-05-01" || got[1] != "2026-05-03" {
		t.Errorf("hidden-sub days = %v, want the unrefined work day and the sport day", got)
	}
	// The whole family hidden plus the rest: an empty month is legal.
	allHidden := decodeMonth(t, getMonth(t, ts, token,
		"2026-05?hiddenCategories="+work+","+sport+"&hiddenSubcategories="+sub.ID))
	if got := dates(allHidden); len(got) != 0 {
		t.Errorf("all-hidden days = %v, want none", got)
	}

	resp := getMonth(t, ts, token, "2026-05?hiddenCategories=not-a-uuid")
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("malformed hidden ids status = %d, want 400", resp.StatusCode)
	}
}

func TestMonthFilter(t *testing.T) {
	ts := newTestServer(t)
	token := signUpTestUser(t)
	me := decodeMe(t, postMe(t, ts, token))
	work, sport := me.Categories[0].ID, me.Categories[1].ID
	meeting := decodeCategory(t, createCategory(t, ts, token, map[string]string{
		"name": "會議", "color": me.Categories[0].Color, "parentId": work,
	}))
	gym := decodeCategory(t, createCategory(t, ts, token, map[string]string{
		"name": "健身房", "color": me.Categories[1].Color, "parentId": sport,
	}))

	mustCreateEntry(t, ts, token, "2026-05-01", work)
	createEntry(t, ts, token, map[string]string{
		"date": "2026-05-02", "categoryId": work, "subcategoryId": meeting.ID, "content": "x",
	}).Body.Close()
	mustCreateEntry(t, ts, token, "2026-05-03", sport)
	createEntry(t, ts, token, map[string]string{
		"date": "2026-05-04", "categoryId": sport, "subcategoryId": gym.ID, "content": "x",
	}).Body.Close()

	days := func(query string) []string {
		month := decodeMonth(t, getMonth(t, ts, token, "2026-05?"+query))
		out := make([]string, len(month.Days))
		for i, day := range month.Days {
			out[i] = day.Date
		}
		return out
	}
	want := func(name string, got []string, dates ...string) {
		t.Helper()
		if strings.Join(got, ",") != strings.Join(dates, ",") {
			t.Errorf("%s: days = %v, want %v", name, got, dates)
		}
	}

	// A chosen Category brings every Subcategory, named or not (#134): the
	// app never lists them, so one it has not heard of still follows.
	want("chosen work", days("filterCategories="+work), "2026-05-01", "2026-05-02")
	// A Subcategory listed under a chosen Category drops out on its own.
	want("work minus 會議", days("filterCategories="+work+"&filterSubcategoryExceptions="+meeting.ID), "2026-05-01")
	// Listed under an unchosen Category it is chosen alone, without the
	// Category's unrefined Entries.
	want("健身房 alone", days("filterSubcategoryExceptions="+gym.ID), "2026-05-04")

	resp := getMonth(t, ts, token, "2026-05?filterCategories=not-a-uuid")
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("malformed filter ids status = %d, want 400", resp.StatusCode)
	}
}

func TestMonthRequiresAToken(t *testing.T) {
	resp := getMonth(t, newTestServer(t), "", "2026-03")
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}
