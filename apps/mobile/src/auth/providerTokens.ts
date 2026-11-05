import * as AppleAuthentication from 'expo-apple-authentication';

// The native half of Sign in with Apple and with Google: each opens its
// provider's sheet and resolves with the ID token Supabase verifies, or null
// when the person closed the sheet. 登入 hands the token to
// signInWithIdToken, 設定's 連結帳戶 to linkIdentity (#20).
export type Provider = 'apple' | 'google';

export async function appleIdToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple returned no identity token');
    }
    return credential.identityToken;
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
}

export async function googleIdToken(): Promise<string | null> {
  // Loaded on first use: the module binds its native half the moment it is
  // imported, and throws where that half is absent. A require rather than
  // import(), which jest cannot run.
  const { GoogleSignin } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') return null;
  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error('Google returned no id token');
  }
  return idToken;
}

export function providerIdToken(provider: Provider): Promise<string | null> {
  return provider === 'apple' ? appleIdToken() : googleIdToken();
}
