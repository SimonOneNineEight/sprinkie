import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../auth/supabase';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, singleLineField, theme } from '../theme';

type Props = {
  onBack: () => void;
};

// Supabase Auth's minimum password length, the project's setting.
const MIN_PASSWORD_LENGTH = 6;
// The wait between emailed codes, so a tap that seems to do nothing is not
// repeated into the mailer's rate limit.
const RESEND_COOLDOWN_SECONDS = 30;

// Where the page is: the sign-in form, a step of 忘記密碼, or a sign-up
// waiting on its emailed code.
type Step = 'form' | 'resetEmail' | 'resetCode' | 'resetPassword' | 'signUpCode';
// The two kinds of emailed code, each with its own wait.
type CodeFlow = 'reset' | 'signUp';

// The email door (#20's fallback forever): its own quiet page behind the
// sign-in screen's 使用電子郵件登入 button. One form, two modes — the toggle
// flips 登入 into 建立帳戶 rather than duplicating the page. 忘記密碼 and a
// sign-up's emailed code (#21) change the same form in place, one step at a
// time; the chevron steps back one step, and only leaves the page from the
// form itself.
export function EmailSignInScreen({ onBack }: Props) {
  const strings = useStrings();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The primary button's spinner. Two taps can land inside one render pass,
  // before busy has caught up, so the request in flight is also held where
  // the handler reads it at once, as EntryFormScreen's inFlight does.
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // When each kind of code last went out, and to which address: the wait
  // outlasts backing out of the step, and one flow's never holds the other.
  const [sent, setSent] = useState<Partial<Record<CodeFlow, { email: string; at: number }>>>({});
  const [now, setNow] = useState(() => Date.now());

  const waitLeft = (flow: CodeFlow) => {
    const last = sent[flow];
    if (!last || last.email !== email.trim()) return 0;
    return Math.max(0, Math.ceil((last.at + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000));
  };
  const codeFlow: CodeFlow = step === 'signUpCode' ? 'signUp' : 'reset';
  // Seconds until 重新寄送 is available again.
  const cooldown = waitLeft(codeFlow);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(tick);
  }, [cooldown, now]);

  // One request at a time; a thrown error becomes the error line, which
  // says what failed. GoTrue answers a wrong code and an expired one alike,
  // with otp_expired.
  // 重新寄送 is a quiet link, so it does not spin the primary button.
  const run = async (failure: string, work: () => Promise<void>, spin = true) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    if (spin) setBusy(true);
    try {
      await work();
    } catch (thrown) {
      const wrongCode = (thrown as { code?: string }).code === 'otp_expired';
      setError(wrongCode ? strings.signIn.wrongCode : failure);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  // A code just went out: start its wait and ask for it, from empty.
  const codeSent = (flow: CodeFlow, next: Step) => {
    const at = Date.now();
    setSent((last) => ({ ...last, [flow]: { email: email.trim(), at } }));
    setNow(at);
    setCode('');
    go(next);
  };

  const submit = async () => {
    if (email.trim() === '' || password === '') return;
    await run(strings.signIn.error, async () => {
      if (registering) {
        const signedUp = await supabase.auth.signUp({ email: email.trim(), password });
        // An address that already has an account: said outright with
        // confirmations off, and with them on, a user with no identities.
        if (
          signedUp.error?.code === 'user_already_exists' ||
          signedUp.data.user?.identities?.length === 0
        ) {
          setError(strings.signIn.alreadyRegistered);
          return;
        }
        if (signedUp.error) throw signedUp.error;
        // Confirmation-required projects return a user but no session: the
        // emailed code finishes the sign-up. With confirmations off the
        // session is already here and the app opens.
        if (!signedUp.data.session) codeSent('signUp', 'signUpCode');
      } else {
        const signedIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signedIn.error) throw signedIn.error;
      }
    });
  };

  // Asking again inside the wait returns to the code already on its way.
  const sendResetCode = () => {
    if (email.trim() === '') return;
    if (waitLeft('reset') > 0) {
      go('resetCode');
      return;
    }
    void run(strings.signIn.sendFailed, async () => {
      const requested = await supabase.auth.resetPasswordForEmail(email.trim());
      if (requested.error) throw requested.error;
      codeSent('reset', 'resetCode');
    });
  };

  // A reset code is resent by asking for the reset again.
  const resend = () => {
    void run(strings.signIn.sendFailed, async () => {
      const resent =
        step === 'signUpCode'
          ? await supabase.auth.resend({ type: 'signup', email: email.trim() })
          : await supabase.auth.resetPasswordForEmail(email.trim());
      if (resent.error) throw resent.error;
      codeSent(codeFlow, step);
    }, false);
  };

  // A reset code waits for the new password before it is checked, so a
  // verified code never leaves a session behind without one.
  const confirmCode = () => {
    if (code.length !== 6) return;
    if (step === 'resetCode') {
      setNewPassword('');
      go('resetPassword');
      return;
    }
    // A sign-up's code signs the User in outright.
    void run(strings.signIn.error, async () => {
      const verified = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
      if (verified.error) throw verified.error;
    });
  };

  // The verified code signs the client in, but useSession holds the app back
  // until the password is saved (USER_UPDATED). A wrong code goes back to be
  // typed again; a check that failed otherwise never spent the code, so the
  // step stays for a retry. A save that fails after the check signs the
  // code's session out, so the old password is never left signed in, and
  // the spent code is asked for anew, with no wait before the next one.
  const saveNewPassword = () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(strings.signIn.shortPassword);
      return;
    }
    void run(strings.signIn.updatePasswordFailed, async () => {
      const verified = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'recovery',
      });
      if (verified.error) {
        if (verified.error.code === 'otp_expired') go('resetCode');
        throw verified.error;
      }
      const updated = await supabase.auth.updateUser({ password: newPassword });
      if (updated.error) {
        await supabase.auth.signOut({ scope: 'local' });
        setSent(({ reset: _spent, ...others }) => others);
        setCode('');
        go('resetCode');
        throw updated.error;
      }
    });
  };

  const back = () => {
    if (step === 'form') onBack();
    else if (step === 'resetPassword') go('resetCode');
    else if (step === 'resetCode') go('resetEmail');
    else go('form');
  };

  const titles: Record<Step, string> = {
    form: strings.signIn.emailTitle,
    resetEmail: strings.signIn.resetTitle,
    resetCode: strings.signIn.resetTitle,
    resetPassword: strings.signIn.resetTitle,
    signUpCode: strings.signIn.confirmTitle,
  };

  const emailField = (
    <TextInput
      style={styles.field}
      placeholder={strings.signIn.emailPlaceholder}
      placeholderTextColor={styles.placeholder.color}
      value={email}
      onChangeText={setEmail}
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      autoFocus
    />
  );
  const errorLine = error ? <Text style={styles.error}>{error}</Text> : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.day.back}
          style={styles.navButton}
          onPress={back}
        >
          <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>{titles[step]}</Text>
      </View>
      {/* keyboardShouldPersistTaps: 登入 sits below the fields, so without
          it the first tap would only dismiss the keyboard. */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.space6}
      >
        {step === 'form' ? (
          <>
            {emailField}
            <TextInput
              style={styles.field}
              placeholder={strings.signIn.passwordPlaceholder}
              placeholderTextColor={styles.placeholder.color}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={registering ? 'new-password' : 'current-password'}
            />
            {registering ? null : (
              <Pressable
                accessibilityRole="button"
                style={[styles.link, styles.linkEnd]}
                onPress={() => go('resetEmail')}
              >
                <Text style={styles.linkLabel}>{strings.signIn.forgotPassword}</Text>
              </Pressable>
            )}
            <PrimaryButton
              label={registering ? strings.signIn.signUpAction : strings.signIn.signInAction}
              busy={busy}
              onPress={() => void submit()}
            />
            <Pressable
              accessibilityRole="button"
              style={styles.toggle}
              onPress={() => setRegistering((r) => !r)}
            >
              <Text style={styles.toggleLabel}>
                {registering ? strings.signIn.toggleToSignIn : strings.signIn.toggleToSignUp}
              </Text>
            </Pressable>
            {errorLine}
          </>
        ) : null}
        {step === 'resetEmail' ? (
          <>
            <Text style={styles.explain}>{strings.signIn.resetBody}</Text>
            {emailField}
            {errorLine}
            <PrimaryButton label={strings.signIn.sendCode} busy={busy} onPress={sendResetCode} />
          </>
        ) : null}
        {step === 'resetCode' || step === 'signUpCode' ? (
          <>
            <Text style={styles.explain}>
              {step === 'signUpCode'
                ? strings.signIn.confirmBody(email.trim())
                : strings.signIn.codeSent(email.trim())}
            </Text>
            <TextInput
              style={[styles.field, styles.codeField]}
              placeholder={strings.signIn.codePlaceholder}
              placeholderTextColor={styles.placeholder.color}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
            />
            {errorLine}
            <PrimaryButton
              label={step === 'signUpCode' ? strings.signIn.finishSignUp : strings.signIn.next}
              busy={busy}
              onPress={confirmCode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={cooldown > 0}
              style={[styles.link, styles.linkCentered]}
              onPress={resend}
            >
              <Text style={cooldown > 0 ? styles.linkWaiting : styles.linkLabel}>
                {cooldown > 0 ? strings.signIn.resendIn(cooldown) : strings.signIn.resend}
              </Text>
            </Pressable>
          </>
        ) : null}
        {step === 'resetPassword' ? (
          <>
            <View style={styles.verifiedRow}>
              <Check size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={styles.verifiedEmail}>{email.trim()}</Text>
            </View>
            <TextInput
              style={styles.field}
              placeholder={strings.signIn.newPasswordPlaceholder}
              placeholderTextColor={styles.placeholder.color}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoFocus
            />
            {errorLine}
            <PrimaryButton label={strings.signIn.updateAndSignIn} busy={busy} onPress={saveNewPassword} />
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// The spinner takes the label's place inside the button's fixed height, so
// nothing below it moves while a request runs.
function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      style={styles.submitButton}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.controlPrimaryFg} />
      ) : (
        <Text style={styles.submitLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space4,
    height: t.spacing.navBarHeight,
    paddingHorizontal: t.spacing.space4,
  },
  navButton: {
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...t.typography.sectionHeader,
    color: t.colors.textPrimary,
    flex: 1,
  },
  body: {
    gap: t.spacing.space5,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space6,
  },
  field: {
    ...singleLineField(t, t.typography.entryTitle),
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.r4,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparatorStrong,
    paddingHorizontal: t.spacing.cardPadding,
  },
  // Spaced digits read as a code, not a word.
  codeField: {
    letterSpacing: t.spacing.space3,
  },
  placeholder: {
    color: t.colors.textPlaceholder,
  },
  submitButton: {
    height: t.spacing.rowHeight,
    borderRadius: t.radius.r4,
    backgroundColor: t.colors.controlPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    ...t.typography.entryTitle,
    color: t.colors.controlPrimaryFg,
  },
  toggle: {
    alignItems: 'center',
    paddingVertical: t.spacing.space3,
  },
  toggleLabel: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  link: {
    minHeight: t.spacing.hitMin,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.space1,
  },
  linkEnd: {
    alignSelf: 'flex-end',
  },
  linkCentered: {
    alignSelf: 'center',
  },
  linkLabel: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  linkWaiting: {
    ...t.typography.meta,
    color: t.colors.textQuaternary,
  },
  explain: {
    ...t.typography.note,
    color: t.colors.textSecondary,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
  },
  verifiedEmail: {
    ...t.typography.note,
    color: t.colors.textSecondary,
    flexShrink: 1,
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
  },
}));
