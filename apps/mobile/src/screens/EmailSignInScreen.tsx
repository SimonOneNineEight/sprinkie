import { Check, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../auth/supabase';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, singleLineField, theme } from '../theme';

type Props = {
  onBack: () => void;
};

// Where the page is: the sign-in form, or a step of 忘記密碼.
type Step = 'form' | 'resetEmail' | 'resetCode' | 'resetPassword';

// The email door (#20's fallback forever): its own quiet page behind the
// sign-in screen's 使用電子郵件登入 button. One form, two modes — the toggle
// flips 登入 into 建立帳戶 rather than duplicating the page. 忘記密碼 (#21)
// changes the same form in place, one step at a time; the chevron steps back
// one step, and only leaves the page from the form itself.
export function EmailSignInScreen({ onBack }: Props) {
  const strings = useStrings();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // One request at a time; a thrown error becomes the flat error line.
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      await work();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const go = (next: Step) => {
    setFailed(false);
    setStep(next);
  };

  const submit = async () => {
    if (email.trim() === '' || password === '') return;
    setAwaitingConfirm(false);
    await run(async () => {
      if (registering) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Confirmation-required projects return a user but no session; the
        // person confirms in their inbox and signs in from here.
        if (!data.session) setAwaitingConfirm(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    });
  };

  const sendResetCode = () => {
    if (email.trim() === '') return;
    void run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setCode('');
      go('resetCode');
    });
  };

  const verifyResetCode = () => {
    if (code.length !== 6) return;
    void run(async () => {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'recovery',
      });
      if (error) throw error;
      setNewPassword('');
      go('resetPassword');
    });
  };

  // The verified code already signed the client in; the new password is
  // what lets the app past the sign-in gate (useSession).
  const saveNewPassword = () => {
    void run(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
    resetCode: strings.signIn.codeTitle,
    resetPassword: strings.signIn.newPasswordTitle,
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
  const errorLine = failed ? <Text style={styles.error}>{strings.signIn.error}</Text> : null;

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
            <Pressable accessibilityRole="button" style={styles.submitButton} onPress={() => void submit()}>
              <Text style={styles.submitLabel}>
                {registering ? strings.signIn.signUpAction : strings.signIn.signInAction}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.toggle}
              onPress={() => setRegistering((r) => !r)}
            >
              <Text style={styles.toggleLabel}>
                {registering ? strings.signIn.toggleToSignIn : strings.signIn.toggleToSignUp}
              </Text>
            </Pressable>
            {awaitingConfirm ? (
              <Text style={styles.notice}>{strings.signIn.confirmEmail}</Text>
            ) : null}
            {failed ? (
              <Text style={[styles.error, styles.centered]}>{strings.signIn.error}</Text>
            ) : null}
          </>
        ) : null}
        {step === 'resetEmail' ? (
          <>
            <Text style={styles.explain}>{strings.signIn.resetBody}</Text>
            {emailField}
            {errorLine}
            <Pressable accessibilityRole="button" style={styles.submitButton} onPress={sendResetCode}>
              <Text style={styles.submitLabel}>{strings.signIn.sendCode}</Text>
            </Pressable>
          </>
        ) : null}
        {step === 'resetCode' ? (
          <>
            <Text style={styles.explain}>{strings.signIn.codeSent(email.trim())}</Text>
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
            <Pressable accessibilityRole="button" style={styles.submitButton} onPress={verifyResetCode}>
              <Text style={styles.submitLabel}>{strings.signIn.next}</Text>
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
            <Pressable accessibilityRole="button" style={styles.submitButton} onPress={saveNewPassword}>
              <Text style={styles.submitLabel}>{strings.signIn.updateAndSignIn}</Text>
            </Pressable>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
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
  linkLabel: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
    textDecorationLine: 'underline',
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
  notice: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
  },
  centered: {
    textAlign: 'center',
  },
}));
