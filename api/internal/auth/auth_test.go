package auth_test

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/SimonOneNineEight/sprinkie/api/internal/auth"
)

// These unit tests exercise the verifier's own logic (JWKS parsing, claim
// checks) against keys we control; the HTTP-seam tests in internal/server
// cover the integration with real Supabase Auth.

func newKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	return key
}

func jwksEntry(kid string, key *ecdsa.PrivateKey) map[string]string {
	return map[string]string{
		"kty": "EC",
		"crv": "P-256",
		"kid": kid,
		"x":   base64.RawURLEncoding.EncodeToString(key.X.Bytes()),
		"y":   base64.RawURLEncoding.EncodeToString(key.Y.Bytes()),
	}
}

func jwksServer(t *testing.T, keys ...map[string]string) *httptest.Server {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": keys})
	}))
	t.Cleanup(ts.Close)
	return ts
}

func signToken(t *testing.T, key *ecdsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = kid
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func validClaims(sub string) jwt.MapClaims {
	return jwt.MapClaims{
		"sub": sub,
		"aud": "authenticated",
		"exp": time.Now().Add(time.Hour).Unix(),
	}
}

func TestVerifyAcceptsTokenSignedByJWKSKey(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t, jwksEntry("k1", key)).URL)

	sub, err := v.Verify(context.Background(), signToken(t, key, "k1", validClaims("user-1")))
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if sub != "user-1" {
		t.Errorf("sub = %q, want user-1", sub)
	}
}

func TestVerifySkipsUnusableJWKSEntries(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t,
		map[string]string{"kty": "RSA", "kid": "rsa"},
		map[string]string{"kty": "EC", "crv": "P-256", "kid": "bad-x", "x": "!!!", "y": "AA"},
		map[string]string{"kty": "EC", "crv": "P-256", "kid": "bad-y", "x": "AA", "y": "!!!"},
		jwksEntry("good", key),
	).URL)

	if _, err := v.Verify(context.Background(), signToken(t, key, "good", validClaims("user-1"))); err != nil {
		t.Fatalf("Verify with mixed JWKS: %v", err)
	}
}

func TestVerifyRejectsWrongAudience(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t, jwksEntry("k1", key)).URL)

	claims := validClaims("user-1")
	claims["aud"] = "something-else"
	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", claims)); err == nil {
		t.Fatal("Verify accepted a token for another audience")
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t, jwksEntry("k1", key)).URL)

	claims := validClaims("user-1")
	claims["exp"] = time.Now().Add(-time.Minute).Unix()
	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", claims)); err == nil {
		t.Fatal("Verify accepted an expired token")
	}
}

func TestVerifyRejectsTokenWithoutSubject(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t, jwksEntry("k1", key)).URL)

	claims := validClaims("")
	delete(claims, "sub")
	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", claims)); err == nil {
		t.Fatal("Verify accepted a token without a subject")
	}
}

func TestVerifyRejectsUnknownKeyID(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier(jwksServer(t, jwksEntry("k1", key)).URL)

	if _, err := v.Verify(context.Background(), signToken(t, key, "other-kid", validClaims("user-1"))); err == nil {
		t.Fatal("Verify accepted a token with a key id missing from the JWKS")
	}
}

func TestVerifyFailsWhenJWKSUnreachable(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier("http://127.0.0.1:1/jwks.json")

	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", validClaims("user-1"))); err == nil {
		t.Fatal("Verify accepted a token while the JWKS was unreachable")
	}
}

func TestVerifyFailsOnMalformedJWKSDocument(t *testing.T) {
	key := newKey(t)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("not json"))
	}))
	t.Cleanup(ts.Close)
	v := auth.NewVerifier(ts.URL)

	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", validClaims("user-1"))); err == nil {
		t.Fatal("Verify accepted a token with an unparsable JWKS")
	}
}

func TestVerifyFailsOnInvalidJWKSURL(t *testing.T) {
	key := newKey(t)
	v := auth.NewVerifier("http://bad url with spaces/\x00")

	if _, err := v.Verify(context.Background(), signToken(t, key, "k1", validClaims("user-1"))); err == nil {
		t.Fatal("Verify accepted a token with an invalid JWKS URL")
	}
}
