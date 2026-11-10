import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '../api/client';
import type { HiddenSet } from '../calendar/hidden';
import { loadHidden, nothingHidden, saveHidden } from '../calendar/hidden';
import { hasNoEntries } from '../reminder/firstEntryInvite';
import { ReminderInvite } from '../reminder/ReminderInvite';
import { useReminder } from '../reminder/useReminder';
import { createStyles } from '../theme';

import { DayScreen } from './DayScreen';
import { EntryFormScreen, type OpenForm } from './EntryFormScreen';
import { MonthScreen } from './MonthScreen';
import { SettingsScreen } from './SettingsScreen';
import { YearScreen } from './YearScreen';

type Props = {
  accessToken: string;
  categories: Category[];
  onCategoriesChanged?: () => void;
  /** A tapped Reminder (#140): open the Entry form for its date. */
  reminderTap?: { date: string } | null;
  onReminderTapOpened?: () => void;
};

type Route =
  | { name: 'month'; focus?: { year: number; month: number; day?: number } }
  | { name: 'day'; date: string }
  | { name: 'form'; date: string }
  | { name: 'settings' }
  | { name: 'year'; focus?: { year: number; month: number } };

// Home lands on the month view (#6); the day list, entry form, settings, and
// year view are routes behind it. Real navigation infrastructure can replace
// this switch when the screen graph outgrows it.
export function HomeScreen({
  accessToken,
  categories,
  onCategoriesChanged,
  reminderTap,
  onReminderTapOpened,
}: Props) {
  const [route, setRoute] = useState<Route>({ name: 'month' });
  const [monthRefresh, setMonthRefresh] = useState(0);
  // The hidden-set (#30): one visibility state across every calendar
  // surface, persisted so it survives launches.
  const [hidden, setHidden] = useState<HiddenSet>(nothingHidden);
  const { resync: resyncReminder } = useReminder();
  // An Entry was saved, deleted or moved: the month reloads, and today's
  // Reminder follows whether today now holds an Entry (#137).
  const bumpMonth = () => {
    setMonthRefresh((n) => n + 1);
    resyncReminder().catch(Sentry.captureException);
  };
  // The Reminder invite (#138): due after a zero-Entry account's first save,
  // wherever it was made, and played once back on the month view, which is
  // where it claims its once-only mark. A delete or a reorder is no save.
  const [inviteDue, setInviteDue] = useState(false);
  const entrySaved = () => {
    bumpMonth();
    if (hasNoEntries(categories)) setInviteDue(true);
  };
  const inviteFinished = useCallback(() => setInviteDue(false), []);

  useEffect(() => {
    let active = true;
    void loadHidden().then((stored) => {
      if (active) setHidden(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  // A tapped Reminder lands on the Entry form for its date, on top of the
  // month view as + opens it (#140). Each tap opens it once; AppRoot then
  // lets go of it, so a later remount never reopens it. An Entry form
  // already open, here or on the day view, is replaced only while it holds
  // nothing the User put in: typed text is never thrown away, so such a
  // form stays as it is, on its own day. One already open for that date
  // stays too.
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  const [openedTap, setOpenedTap] = useState<Props['reminderTap']>(null);
  if (reminderTap && reminderTap !== openedTap) {
    setOpenedTap(reminderTap);
    const keep = openForm !== null && (openForm.written || openForm.date === reminderTap.date);
    if (!keep) setRoute({ name: 'form', date: reminderTap.date });
  }
  useEffect(() => {
    if (reminderTap) onReminderTapOpened?.();
  }, [reminderTap, onReminderTapOpened]);

  const changeHidden = (next: HiddenSet) => {
    setHidden(next);
    void saveHidden(next);
  };

  if (route.name === 'day') {
    return (
      <DayScreen
        accessToken={accessToken}
        categories={categories}
        date={route.date}
        hidden={hidden}
        onChangeHidden={changeHidden}
        onBack={() => setRoute({ name: 'month', focus: focusOn(route.date) })}
        onChangeDate={(date) => setRoute({ name: 'day', date })}
        onEntrySaved={(change) => (change === 'saved' ? entrySaved() : bumpMonth())}
        onFormState={setOpenForm}
        onCategoriesChanged={onCategoriesChanged}
      />
    );
  }
  if (route.name === 'year') {
    return (
      <YearScreen
        accessToken={accessToken}
        categories={categories}
        hidden={hidden}
        initialFocus={route.focus}
        refresh={monthRefresh}
        onChangeHidden={changeHidden}
        onCategoriesChanged={onCategoriesChanged}
        onOpenMonth={(year, month) => setRoute({ name: 'month', focus: { year, month } })}
      />
    );
  }
  if (route.name === 'settings') {
    return (
      <SettingsScreen
        accessToken={accessToken}
        onBack={() => setRoute({ name: 'month' })}
      />
    );
  }
  if (route.name === 'form') {
    return (
      <EntryFormScreen
        // A new date is a new form: a tap swapping a blank form for another
        // day's starts afresh.
        key={route.date}
        accessToken={accessToken}
        date={route.date}
        categories={categories}
        onCategoriesChanged={onCategoriesChanged}
        onFormState={setOpenForm}
        onDone={(outcome) => {
          if (outcome.kind === 'saved') entrySaved();
          const landing = outcome.kind === 'saved' ? outcome.date : route.date;
          setRoute({ name: 'month', focus: focusOn(landing) });
        }}
      />
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <MonthScreen
          accessToken={accessToken}
          categories={categories}
          refresh={monthRefresh}
          initialMonth={route.focus}
          hidden={hidden}
          onChangeHidden={changeHidden}
          onOpenDay={(date) => setRoute({ name: 'day', date })}
          onAddEntry={(date) => setRoute({ name: 'form', date })}
          onOpenSettings={() => setRoute({ name: 'settings' })}
          onCategoriesChanged={onCategoriesChanged}
          onOpenYear={(year, month) => setRoute({ name: 'year', focus: { year, month } })}
        />
        {inviteDue ? <ReminderInvite onFinished={inviteFinished} /> : null}
      </View>
    </SafeAreaView>
  );
}

/** The month route's landing for a YYYY-MM-DD date: its month, that day selected. */
function focusOn(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  body: {
    flex: 1,
  },
}));
