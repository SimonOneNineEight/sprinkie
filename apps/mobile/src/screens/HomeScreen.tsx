import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category } from '../api/client';
import type { HiddenSet } from '../calendar/hidden';
import { loadHidden, nothingHidden, saveHidden } from '../calendar/hidden';
import { createStyles } from '../theme';

import { DayScreen } from './DayScreen';
import { EntryFormScreen } from './EntryFormScreen';
import { MonthScreen } from './MonthScreen';
import { SettingsScreen } from './SettingsScreen';
import { YearScreen } from './YearScreen';

type Props = {
  accessToken: string;
  categories: Category[];
  onCategoriesChanged?: () => void;
};

type Route =
  | { name: 'month'; focus?: { year: number; month: number } }
  | { name: 'day'; date: string }
  | { name: 'form'; date: string }
  | { name: 'settings' }
  | { name: 'year'; focus?: { year: number; month: number } };

// Home lands on the month view (#6); the day list, entry form, settings, and
// year view are routes behind it. Real navigation infrastructure can replace
// this switch when the screen graph outgrows it.
export function HomeScreen({ accessToken, categories, onCategoriesChanged }: Props) {
  const [route, setRoute] = useState<Route>({ name: 'month' });
  const [monthRefresh, setMonthRefresh] = useState(0);
  // The hidden-set (#30): one visibility state across every calendar
  // surface, persisted so it survives launches.
  const [hidden, setHidden] = useState<HiddenSet>(nothingHidden);
  const bumpMonth = () => setMonthRefresh((n) => n + 1);

  useEffect(() => {
    let active = true;
    void loadHidden().then((stored) => {
      if (active) setHidden(stored);
    });
    return () => {
      active = false;
    };
  }, []);

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
        onBack={() => setRoute({ name: 'month' })}
        onChangeDate={(date) => setRoute({ name: 'day', date })}
        onEntrySaved={bumpMonth}
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
        accessToken={accessToken}
        date={route.date}
        categories={categories}
        onCategoriesChanged={onCategoriesChanged}
        onDone={(saved) => {
          if (saved) bumpMonth();
          setRoute({ name: 'month' });
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
      </View>
    </SafeAreaView>
  );
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
