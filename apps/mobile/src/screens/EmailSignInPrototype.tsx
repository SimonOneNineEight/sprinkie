/* eslint-disable */
/**
 * THROWAWAY PROTOTYPE for #21: 忘記密碼 by a typed 6-digit code, and sign-up
 * finished by a code. Branch `prototype/email-and-linking` only, never merges.
 *
 * Every auth call is a stub: nothing here touches supabase.auth or any hosted
 * service. Sending "succeeds" after ~800ms, 123456 is the right code, anything
 * else is wrong, and a new password of 6+ characters is accepted.
 *
 * One flow state, three renderers (A in place, B a page per step, C a sheet),
 * so flipping the pill mid-flow shows the same step in another look.
 */
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, singleLineField, theme } from '../theme';

import { useOnPrototypeReset, useVariant, VariantSwitcher, wait } from './AccountVariantPrototype';

const RIGHT_CODE = '123456';
const COOLDOWN_SECONDS = 30;

type Step = 'form' | 'forgotEmail' | 'forgotCode' | 'forgotPassword' | 'signupCode' | 'done';

const COPY = {
  forgot: '忘記密碼？',
  resetTitle: '重設密碼',
  resetBody: '輸入註冊時的電子郵件，我們會寄送 6 位數驗證碼。',
  sendCode: '寄送驗證碼',
  codeTitle: '輸入驗證碼',
  codeSent: (email: string) => `已寄送 6 位數驗證碼至 ${email}`,
  codePlaceholder: '驗證碼',
  next: '下一步',
  newPasswordTitle: '設定新密碼',
  newPasswordPlaceholder: '新密碼',
  updateAndSignIn: '更新並登入',
  signupTitle: '確認電子郵件',
  signupBody: (email: string) => `已寄送 6 位數驗證碼至 ${email}，輸入後即完成註冊。`,
  finishSignup: '完成註冊',
  resend: '重新寄送',
  resendIn: (n: number) => `重新寄送（${n} 秒）`,
  wrongCode: '驗證碼錯誤或已過期',
  shortPassword: '密碼至少需要 6 個字元',
};

function useEmailFlow() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [doneHow, setDoneHow] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const finish = (how: string) => {
    setDoneHow(how);
    go('done');
  };

  const submitForm = () => {
    if (email.trim() === '' || password === '') return;
    void run(async () => {
      await wait(800);
      if (registering) {
        setCode('');
        setCooldown(COOLDOWN_SECONDS);
        go('signupCode');
      } else {
        finish('以密碼登入');
      }
    });
  };

  const openForgot = () => {
    setCode('');
    setNewPassword('');
    go('forgotEmail');
  };

  const sendReset = () => {
    if (email.trim() === '') return;
    void run(async () => {
      await wait(800);
      setCode('');
      setCooldown(COOLDOWN_SECONDS);
      go('forgotCode');
    });
  };

  const resend = () => {
    if (cooldown > 0) return;
    void run(async () => {
      await wait(800);
      setCode('');
      setCooldown(COOLDOWN_SECONDS);
    });
  };

  const verifyCode = (value = code) => {
    if (value.length !== 6) return;
    void run(async () => {
      await wait(800);
      if (value !== RIGHT_CODE) {
        setError(COPY.wrongCode);
        return;
      }
      if (step === 'signupCode') finish('註冊完成');
      else go('forgotPassword');
    });
  };

  const saveNewPassword = () => {
    if (newPassword.length < 6) {
      setError(COPY.shortPassword);
      return;
    }
    void run(async () => {
      await wait(800);
      finish('已設定新密碼');
    });
  };

  // C asks for the code and the new password on one sheet.
  const verifyAndSave = () => {
    if (code.length !== 6) return;
    if (newPassword.length < 6) {
      setError(COPY.shortPassword);
      return;
    }
    void run(async () => {
      await wait(800);
      if (code !== RIGHT_CODE) {
        setError(COPY.wrongCode);
        return;
      }
      finish('已設定新密碼');
    });
  };

  const back = () => {
    if (step === 'forgotPassword') go('forgotCode');
    else if (step === 'forgotCode') go('forgotEmail');
    else go('form');
  };

  const reset = useCallback(() => {
    setStep('form');
    setRegistering(false);
    setCode('');
    setNewPassword('');
    setError(null);
    setCooldown(0);
  }, []);
  useOnPrototypeReset(reset);

  return {
    email, setEmail, password, setPassword, registering, setRegistering,
    step, go, code, setCode, newPassword, setNewPassword,
    busy, error, cooldown, doneHow,
    submitForm, openForgot, sendReset, resend, verifyCode, saveNewPassword, verifyAndSave, back,
  };
}

type Flow = ReturnType<typeof useEmailFlow>;

export function EmailSignInPrototype({ onBack }: { onBack: () => void }) {
  const flow = useEmailFlow();
  const variant = useVariant();

  let body;
  if (flow.step === 'done') body = <DonePage flow={flow} onBack={onBack} />;
  else if (variant === 'A') body = <VariantA flow={flow} onBack={onBack} />;
  else if (variant === 'B') body = <VariantB flow={flow} onBack={onBack} />;
  else body = <VariantC flow={flow} onBack={onBack} />;

  return (
    <View style={styles.fill}>
      {body}
      <VariantSwitcher label="#21" />
    </View>
  );
}

// ─── Shared pieces ────────────────────────────────────────────────────────

function NavBar({ title, onBack }: { title?: string; onBack: () => void }) {
  const strings = useStrings();
  return (
    <View style={styles.navBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strings.day.back}
        style={styles.navButton}
        onPress={onBack}
      >
        <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
      </Pressable>
      {title ? <Text style={styles.navTitle}>{title}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.submitButton} onPress={onPress}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.controlPrimaryFg} />
      ) : (
        <Text style={styles.submitLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

function EmailField({ flow, autoFocus }: { flow: Flow; autoFocus?: boolean }) {
  const strings = useStrings();
  return (
    <TextInput
      style={styles.field}
      placeholder={strings.signIn.emailPlaceholder}
      placeholderTextColor={styles.placeholder.color}
      value={flow.email}
      onChangeText={flow.setEmail}
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      autoFocus={autoFocus}
    />
  );
}

function CodeField({ flow, autoFocus }: { flow: Flow; autoFocus?: boolean }) {
  return (
    <TextInput
      style={[styles.field, styles.codeField]}
      placeholder={COPY.codePlaceholder}
      placeholderTextColor={styles.placeholder.color}
      value={flow.code}
      onChangeText={(v) => flow.setCode(v.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      autoFocus={autoFocus}
    />
  );
}

function NewPasswordField({ flow, autoFocus }: { flow: Flow; autoFocus?: boolean }) {
  return (
    <TextInput
      style={styles.field}
      placeholder={COPY.newPasswordPlaceholder}
      placeholderTextColor={styles.placeholder.color}
      value={flow.newPassword}
      onChangeText={flow.setNewPassword}
      secureTextEntry
      textContentType="newPassword"
      autoComplete="new-password"
      autoFocus={autoFocus}
    />
  );
}

function ResendLink({ flow, align }: { flow: Flow; align: 'left' | 'center' | 'right' }) {
  const waiting = flow.cooldown > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: waiting }}
      style={[styles.link, align === 'center' && styles.center, align === 'right' && styles.right]}
      onPress={flow.resend}
    >
      <Text style={waiting ? styles.linkDisabled : styles.linkLabel}>
        {waiting ? COPY.resendIn(flow.cooldown) : COPY.resend}
      </Text>
    </Pressable>
  );
}

function ErrorLine({ flow, center }: { flow: Flow; center?: boolean }) {
  if (!flow.error) return null;
  return <Text style={[styles.error, center && styles.textCenter]}>{flow.error}</Text>;
}

// The sign-in / sign-up form, as today plus 忘記密碼？. A and C share it.
function SignInForm({ flow, forgotStyle }: { flow: Flow; forgotStyle: 'under-field' | 'below-toggle' }) {
  const strings = useStrings();
  const forgot =
    !flow.registering ? (
      <Pressable
        accessibilityRole="button"
        style={[styles.link, forgotStyle === 'under-field' ? styles.right : styles.center]}
        onPress={flow.openForgot}
      >
        <Text style={styles.linkLabel}>{COPY.forgot}</Text>
      </Pressable>
    ) : null;
  return (
    <>
      <EmailField flow={flow} autoFocus />
      <TextInput
        style={styles.field}
        placeholder={strings.signIn.passwordPlaceholder}
        placeholderTextColor={styles.placeholder.color}
        value={flow.password}
        onChangeText={flow.setPassword}
        secureTextEntry
        autoComplete={flow.registering ? 'new-password' : 'current-password'}
      />
      {forgotStyle === 'under-field' ? forgot : null}
      <PrimaryButton
        label={flow.registering ? strings.signIn.signUpAction : strings.signIn.signInAction}
        busy={flow.busy}
        onPress={flow.submitForm}
      />
      <Pressable
        accessibilityRole="button"
        style={styles.toggle}
        onPress={() => flow.setRegistering(!flow.registering)}
      >
        <Text style={styles.toggleLabel}>
          {flow.registering ? strings.signIn.toggleToSignIn : strings.signIn.toggleToSignUp}
        </Text>
      </Pressable>
      {forgotStyle === 'below-toggle' ? forgot : null}
      <ErrorLine flow={flow} center />
    </>
  );
}

// ─── A: the form itself changes step by step ──────────────────────────────

function VariantA({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  const strings = useStrings();
  const titles: Record<Step, string> = {
    form: strings.signIn.emailTitle,
    forgotEmail: COPY.resetTitle,
    forgotCode: COPY.resetTitle,
    forgotPassword: COPY.resetTitle,
    signupCode: COPY.signupTitle,
    done: '',
  };
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <NavBar title={titles[flow.step]} onBack={flow.step === 'form' ? onBack : flow.back} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.space6}
      >
        {flow.step === 'form' ? <SignInForm flow={flow} forgotStyle="under-field" /> : null}
        {flow.step === 'forgotEmail' ? (
          <>
            <Text style={styles.explain}>{COPY.resetBody}</Text>
            <EmailField flow={flow} autoFocus />
            <PrimaryButton label={COPY.sendCode} busy={flow.busy} onPress={flow.sendReset} />
          </>
        ) : null}
        {flow.step === 'forgotCode' || flow.step === 'signupCode' ? (
          <>
            <Text style={styles.explain}>
              {flow.step === 'signupCode' ? COPY.signupBody(flow.email) : COPY.codeSent(flow.email)}
            </Text>
            <CodeField flow={flow} autoFocus />
            <ErrorLine flow={flow} />
            <PrimaryButton
              label={flow.step === 'signupCode' ? COPY.finishSignup : COPY.next}
              busy={flow.busy}
              onPress={() => flow.verifyCode()}
            />
            <ResendLink flow={flow} align="center" />
          </>
        ) : null}
        {flow.step === 'forgotPassword' ? (
          <>
            <View style={styles.verifiedRow}>
              <Check size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={styles.explainInline}>{flow.email}</Text>
            </View>
            <NewPasswordField flow={flow} autoFocus />
            <ErrorLine flow={flow} />
            <PrimaryButton label={COPY.updateAndSignIn} busy={flow.busy} onPress={flow.saveNewPassword} />
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// ─── B: one focused page per step ─────────────────────────────────────────

function VariantB({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  const strings = useStrings();
  if (flow.step === 'form') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <NavBar title={strings.signIn.emailTitle} onBack={onBack} />
        <KeyboardAwareScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          bottomOffset={theme.spacing.space6}
        >
          <SignInForm flow={flow} forgotStyle="below-toggle" />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  let title = '';
  let explain = '';
  let field = null;
  let action = { label: '', onPress: () => {} };
  let extra = null;
  if (flow.step === 'forgotEmail') {
    title = COPY.resetTitle;
    explain = COPY.resetBody;
    field = <EmailField flow={flow} autoFocus />;
    action = { label: COPY.sendCode, onPress: flow.sendReset };
  } else if (flow.step === 'forgotCode' || flow.step === 'signupCode') {
    title = flow.step === 'signupCode' ? COPY.signupTitle : COPY.codeTitle;
    explain = flow.step === 'signupCode' ? COPY.signupBody(flow.email) : COPY.codeSent(flow.email);
    field = <DigitBoxes flow={flow} />;
    action = {
      label: flow.step === 'signupCode' ? COPY.finishSignup : COPY.next,
      onPress: () => flow.verifyCode(),
    };
    extra = <ResendLink flow={flow} align="left" />;
  } else if (flow.step === 'forgotPassword') {
    title = COPY.newPasswordTitle;
    explain = flow.email;
    field = <NewPasswordField flow={flow} autoFocus />;
    action = { label: COPY.updateAndSignIn, onPress: flow.saveNewPassword };
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <NavBar onBack={flow.back} />
      <View style={styles.pageBody}>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.explain}>{explain}</Text>
        <View style={styles.pageField}>{field}</View>
        <ErrorLine flow={flow} />
        {extra}
      </View>
      <KeyboardStickyView offset={{ closed: 0, opened: theme.spacing.space6 }}>
        <View style={styles.dock}>
          <PrimaryButton label={action.label} busy={flow.busy} onPress={action.onPress} />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

// Six boxes over one hidden field, so paste and iOS's code autofill still work.
function DigitBoxes({ flow }: { flow: Flow }) {
  const input = useRef<TextInput>(null);
  const digits = flow.code.split('');
  return (
    <Pressable feedback="none" onPress={() => input.current?.focus()}>
      <View style={styles.boxes}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const active = i === Math.min(digits.length, 5);
          return (
            <View
              key={i}
              style={[styles.box, active && styles.boxActive, flow.error ? styles.boxError : null]}
            >
              <Text style={styles.boxDigit}>{digits[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        style={styles.hiddenInput}
        value={flow.code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, '').slice(0, 6);
          flow.setCode(next);
          // A full code submits itself; the button is there for a retry.
          if (next.length === 6) flow.verifyCode(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        caretHidden
      />
    </Pressable>
  );
}

// ─── C: a sheet over the sign-in screen ───────────────────────────────────

function VariantC({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  const strings = useStrings();
  const sheetOpen = flow.step !== 'form';
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <NavBar title={strings.signIn.emailTitle} onBack={onBack} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.space6}
      >
        <SignInForm flow={flow} forgotStyle="under-field" />
      </KeyboardAwareScrollView>

      <Modal transparent visible={sheetOpen} animationType="slide" onRequestClose={() => flow.go('form')}>
        <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
          <Pressable feedback="none" style={styles.scrim} onPress={() => flow.go('form')} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.handle} />
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>
                  {flow.step === 'signupCode' ? COPY.signupTitle : COPY.resetTitle}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="關閉"
                  style={styles.sheetClose}
                  onPress={() => flow.go('form')}
                >
                  <X size={20} color={theme.colors.iconMuted} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
            <View style={styles.sheetBody}>
              {flow.step === 'forgotEmail' ? (
                <>
                  <Text style={styles.explain}>{COPY.resetBody}</Text>
                  <EmailField flow={flow} autoFocus />
                  <PrimaryButton label={COPY.sendCode} busy={flow.busy} onPress={flow.sendReset} />
                </>
              ) : null}
              {flow.step === 'forgotCode' || flow.step === 'forgotPassword' ? (
                <>
                  <Text style={styles.explain}>{COPY.codeSent(flow.email)}</Text>
                  <View style={styles.codeRow}>
                    <View style={styles.fill}>
                      <CodeField flow={flow} autoFocus />
                    </View>
                    <ResendLink flow={flow} align="right" />
                  </View>
                  <NewPasswordField flow={flow} />
                  <ErrorLine flow={flow} />
                  <PrimaryButton label={COPY.updateAndSignIn} busy={flow.busy} onPress={flow.verifyAndSave} />
                </>
              ) : null}
              {flow.step === 'signupCode' ? (
                <>
                  <Text style={styles.explain}>{COPY.signupBody(flow.email)}</Text>
                  <View style={styles.codeRow}>
                    <View style={styles.fill}>
                      <CodeField flow={flow} autoFocus />
                    </View>
                    <ResendLink flow={flow} align="right" />
                  </View>
                  <ErrorLine flow={flow} />
                  <PrimaryButton label={COPY.finishSignup} busy={flow.busy} onPress={() => flow.verifyCode()} />
                </>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
        <VariantSwitcher label="#21" />
      </Modal>
    </SafeAreaView>
  );
}

// ─── The end state, same for all three ────────────────────────────────────

function DonePage({ flow, onBack }: { flow: Flow; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <NavBar onBack={() => flow.go('form')} />
      <View style={styles.doneBody}>
        <Text style={styles.pageTitle}>已登入</Text>
        <Text style={styles.explain}>{`PROTOTYPE · ${flow.doneHow}。實際會直接進入月曆。`}</Text>
        <PrimaryButton label="回到設定" busy={false} onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles((t) => ({
  fill: {
    flex: 1,
  },
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
  codeField: {
    letterSpacing: 6,
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
    alignSelf: 'flex-start',
    paddingHorizontal: t.spacing.space1,
  },
  center: {
    alignSelf: 'center',
  },
  right: {
    alignSelf: 'flex-end',
  },
  linkLabel: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    ...t.typography.meta,
    color: t.colors.textQuaternary,
  },
  explain: {
    ...t.typography.note,
    color: t.colors.textSecondary,
  },
  explainInline: {
    ...t.typography.note,
    color: t.colors.textSecondary,
    flexShrink: 1,
  },
  textCenter: {
    textAlign: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
  },
  // B
  pageBody: {
    flex: 1,
    gap: t.spacing.space5,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space4,
  },
  pageTitle: {
    ...t.typography.navTitle,
    color: t.colors.textPrimary,
  },
  pageField: {
    marginTop: t.spacing.space6,
  },
  dock: {
    paddingHorizontal: t.spacing.screenGutter,
    paddingBottom: t.spacing.space6,
  },
  boxes: {
    flexDirection: 'row',
    gap: t.spacing.space4,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: t.radius.r4,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparatorStrong,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderWidth: 2,
    borderColor: t.colors.focusRing,
  },
  boxError: {
    borderColor: t.colors.textDestructive,
  },
  boxDigit: {
    ...t.typography.navTitle,
    fontWeight: '400',
    color: t.colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  // C
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
  },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    gap: t.spacing.space4,
    paddingTop: t.spacing.space4,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineSeparator,
  },
  sheetTitleRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: t.spacing.hitMin,
  },
  sheetTitle: {
    ...t.typography.sectionHeader,
    fontSize: 17,
    color: t.colors.textPrimary,
  },
  sheetClose: {
    position: 'absolute',
    right: t.spacing.space4,
    width: t.spacing.hitMin,
    height: t.spacing.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    gap: t.spacing.space5,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space4,
    paddingBottom: 32,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
  },
  doneBody: {
    gap: t.spacing.space5,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space4,
  },
}));
