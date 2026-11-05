import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../auth/supabase';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, singleLineField, theme } from '../theme';

import { EmailSignInPrototype } from './EmailSignInPrototype';

type Props = {
  onBack: () => void;
  // PROTOTYPE (#21): set only by 設定's dev row; every auth call is stubbed.
  prototype?: boolean;
};

// The email door (#20's fallback forever): its own quiet page behind the
// sign-in screen's 使用電子郵件登入 button. One form, two modes — the toggle
// flips 登入 into 建立帳戶 rather than duplicating the page.
export function EmailSignInScreen({ onBack, prototype }: Props) {
  if (__DEV__ && prototype) return <EmailSignInPrototype onBack={onBack} />;
  return <RealEmailSignInScreen onBack={onBack} />;
}

function RealEmailSignInScreen({ onBack }: Props) {
  const strings = useStrings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (email.trim() === '' || password === '' || busy) return;
    setFailed(false);
    setAwaitingConfirm(false);
    setBusy(true);
    try {
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
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.day.back}
          style={styles.navButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={theme.colors.iconDefault} strokeWidth={2} />
        </Pressable>
        <Text style={styles.navTitle}>{strings.signIn.emailTitle}</Text>
      </View>
      {/* keyboardShouldPersistTaps: 登入 sits below the fields, so without
          it the first tap would only dismiss the keyboard. */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.space6}
      >
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
        <TextInput
          style={styles.field}
          placeholder={strings.signIn.passwordPlaceholder}
          placeholderTextColor={styles.placeholder.color}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={registering ? 'new-password' : 'current-password'}
        />
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
        {failed ? <Text style={styles.error}>{strings.signIn.error}</Text> : null}
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
  notice: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
    textAlign: 'center',
  },
}));
