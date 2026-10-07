import { ChevronDown, Plus, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category, Entry, Photo } from '../api/client';
import { createCategory, deleteEntry, deletePhoto, reorderPhotos } from '../api/client';
import { MAX_PHOTOS, PhotoGrid } from '../entries/PhotoGrid';
import type { ProcessedPhoto } from '../photos/processPhoto';
import { processPhoto } from '../photos/processPhoto';
import { CategoryIcon } from '../calendar/CategoryIcon';
import { dateHeading } from '../calendar/dateLabel';
import { DatePickerSheet } from '../calendar/DatePickerSheet';
import { CategoryEditorSheet } from '../categories/CategoryEditorSheet';
import { decodeContent, encodeContent } from '../entries/content';
import type { EntryDraft } from '../entries/drafts';
import { newDraftId } from '../entries/drafts';
import { saveEntry } from '../entries/save';
import { useStrings } from '../i18n/AppLanguageProvider';
import { Pressable } from '../theme/press';
import { createStyles, singleLineField, theme } from '../theme';

type Props = {
  accessToken: string;
  /** The day the form was opened for; the date row starts here (#24). */
  date: string;
  categories: Category[];
  /** When present, the form edits this Entry instead of creating one. */
  entry?: Entry;
  /** A retained failed save (#14): the form opens prefilled from it and 儲存 retries. */
  draft?: EntryDraft;
  onDone: (saved: boolean) => void;
  /** Fired after an inline category/subcategory creation lands server-side. */
  onCategoriesChanged?: () => void;
};

// The entry form per the canvas: category comes first (search field + list),
// and only a chosen category reveals the title and note fields. The pinned
// 新增類別 row and the 建立「…」 row an unmatched name offers both open the
// full 分類表單 sheet, prefilled with any typed name (ratified 2026-09-10,
// overturning the 2026-08-18 in-form quick step: reuse the complete editor
// over a second creation surface). Title is required by this form, not by
// the server — it lives inside the opaque content blob the server never
// parses (ADR-0004). With an entry prop the form edits instead of creating.
// Photos arrive with #8.
export function EntryFormScreen({
  accessToken,
  date: openedFor,
  categories,
  entry,
  draft,
  onDone,
  onCategoriesChanged,
}: Props) {
  const strings = useStrings();
  // The date the Entry saves onto (#24), editable through the date row's
  // compact picker; on edit, changing it moves the Entry to that day (#25).
  const [date, setDate] = useState(draft?.date ?? entry?.date ?? openedFor);
  const [pickingDate, setPickingDate] = useState(false);
  // A draft outranks the entry: it holds the newer, unsaved intent.
  const initialContent = draft
    ? decodeContent(draft.content)
    : entry
      ? decodeContent(entry.content)
      : null;
  const initialCategoryId = draft ? draft.categoryId : entry?.categoryId;
  const initialSubcategoryId = draft ? draft.subcategoryId : entry?.subcategoryId;
  const [category, setCategory] = useState<Category | null>(
    initialCategoryId ? (categories.find((c) => c.id === initialCategoryId) ?? null) : null,
  );
  const [subcategory, setSubcategory] = useState<Category | null>(
    initialSubcategoryId ? (categories.find((c) => c.id === initialSubcategoryId) ?? null) : null,
  );
  const [query, setQuery] = useState('');
  // Non-null opens the 分類表單 sheet prefilled with this name (ratified
  // 2026-09-10: the creation rows reuse the complete editor; the in-form
  // quick step is retired).
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [addingSub, setAddingSub] = useState(false);
  // A restored draft brings its typed-but-uncreated subcategory back (#28).
  const [subName, setSubName] = useState(draft?.pendingSubcategoryName ?? '');
  // Categories created in this form session, until the parent refetches /me.
  const [created, setCreated] = useState<Category[]>([]);
  const [title, setTitle] = useState(initialContent?.title ?? '');
  const [note, setNote] = useState(initialContent?.note ?? '');
  const [saving, setSaving] = useState(false);
  // Two taps can land inside one render pass, where the disabled prop has
  // not caught up yet, so the in-flight flag is also held where the handler
  // can read it now (#44): 儲存 pressed twice is one Entry, not two.
  const inFlight = useRef(false);
  const [failed, setFailed] = useState(false);
  const [photosFailed, setPhotosFailed] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>(entry?.photos ?? []);
  const [stagedPhotos, setStagedPhotos] = useState<ProcessedPhoto[]>(draft?.photos ?? []);
  // The OS may purge the cache files a draft's photo URIs point at; prune the
  // unreadable ones on restore so a retry saves what survives instead of
  // failing forever, and say so.
  const [photosMissing, setPhotosMissing] = useState(false);
  // Where a failed save is kept (#14). A restored draft keeps its id so the
  // retry overwrites in place and success clears the right slot.
  const [draftId] = useState(() => draft?.id ?? newDraftId());
  // Set when photos fail after the Entry landed, so the in-session retry
  // updates that Entry instead of creating a duplicate.
  const [savedEntryId, setSavedEntryId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!draft || draft.photos.length === 0) return;
    let active = true;
    void Promise.all(
      draft.photos.map((photo) =>
        fetch(photo.fullUri).then(
          (response) => response.ok,
          () => false,
        ),
      ),
    ).then((readable) => {
      if (!active || readable.every(Boolean)) return;
      const unreadable = new Set(
        draft.photos.filter((_, index) => !readable[index]).map((photo) => photo.fullUri),
      );
      setPhotosMissing(true);
      setStagedPhotos((prev) => prev.filter((photo) => !unreadable.has(photo.fullUri)));
    });
    return () => {
      active = false;
    };
  }, [draft]);

  const known = new Set(categories.map((c) => c.id));
  const all = [...categories, ...created.filter((c) => !known.has(c.id))];
  const topLevel = all.filter((c) => !c.parentId);
  const trimmedQuery = query.trim();
  const filtered = topLevel.filter((c) =>
    c.name.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );
  const exactMatch = topLevel.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());
  const children = category ? all.filter((c) => c.parentId === category.id) : [];
  // A typed name whose field has closed: the pending subcategory (#28),
  // created with the entry at save.
  const pendingSubName = subcategory === null && !addingSub ? subName.trim() : '';

  const canSave = !saving && category !== null && title.trim() !== '';
  // Saving wears the primary pill with a spinner in it; greying it out is
  // what the round-2 tester read as a hang.
  const saveLooksDisabled = !canSave && !saving;

  const dateLabel = dateHeading(strings, date);

  // The pipeline itself lives in entries/save.ts; the screen gathers the
  // intent from its fields and renders the result.
  const save = async () => {
    if (!canSave || category === null || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    setPhotosFailed(false);
    // Read without the render path's !addingSub guard on purpose — pressing
    // 儲存 while the field is still open must not lose the typed name (#28).
    const pendingName = subcategory === null ? subName.trim() : '';
    const result = await saveEntry({
      accessToken,
      date,
      categoryId: category.id,
      categoryColor: category.color,
      ...(subcategory !== null ? { subcategoryId: subcategory.id } : {}),
      ...(pendingName !== '' ? { pendingSubcategoryName: pendingName } : {}),
      content: encodeContent({ title: title.trim(), note }),
      photos: stagedPhotos,
      draftId,
      existingEntryId: entry?.id ?? draft?.entryId ?? savedEntryId,
    });
    // No finally needed: saveEntry never throws, by the contract documented
     // in entries/save.ts. If that totality ever goes, this needs one.
    inFlight.current = false;
    if ('createdSubcategory' in result && result.createdSubcategory !== undefined) {
      const made = result.createdSubcategory;
      setCreated((prev) => [...prev, made]);
      setSubcategory(made);
      setSubName('');
      setAddingSub(false);
      onCategoriesChanged?.();
    }
    switch (result.kind) {
      case 'saved':
        onDone(true);
        return;
      case 'photosFailed':
        // The Entry's words reached the server; retrying updates it.
        setSavedEntryId(result.entryId);
        setPhotosFailed(true);
        setSaving(false);
        return;
      case 'subcategoryFailed':
      case 'entryFailed':
        setFailed(true);
        setSaving(false);
        return;
    }
  };

  const photoCount = existingPhotos.length + stagedPhotos.length;

  const addPhotos = () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(strings.photos.addPhoto, undefined, [
        { text: strings.photos.takePhoto, onPress: () => void pickPhotos('camera') },
        { text: strings.photos.fromLibrary, onPress: () => void pickPhotos('library') },
        { text: strings.entryForm.cancel, style: 'cancel' },
      ]);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [strings.photos.takePhoto, strings.photos.fromLibrary, strings.entryForm.cancel],
        cancelButtonIndex: 2,
      },
      (choice) => {
        if (choice === 0) void pickPhotos('camera');
        if (choice === 1) void pickPhotos('library');
      },
    );
  };

  const pickPhotos = async (source: 'camera' | 'library') => {
    const remaining = MAX_PHOTOS - photoCount;
    if (remaining < 1) return;
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      result = await ImagePicker.launchCameraAsync({ quality: 1, exif: true });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        exif: true,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
    }
    if (result.canceled) return;
    const processed = await Promise.all(result.assets.slice(0, remaining).map(processPhoto));
    setStagedPhotos((prev) => [...prev, ...processed]);
  };

  const removeGridPhoto = (key: string) => {
    if (key.startsWith('staged:')) {
      const index = Number(key.slice('staged:'.length));
      setStagedPhotos((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    const id = key.slice('photo:'.length);
    Alert.alert(strings.photos.removeConfirmTitle, undefined, [
      { text: strings.entryForm.cancel, style: 'cancel' },
      {
        text: strings.photos.remove,
        style: 'destructive',
        onPress: () => {
          deletePhoto(accessToken, id)
            .then(() => setExistingPhotos((prev) => prev.filter((p) => p.id !== id)))
            .catch(() => Alert.alert(strings.entryForm.saveFailed));
        },
      },
    ]);
  };

  // Drag order: existing photos persist through the API; staged photos hold
  // their block after the existing ones until upload, so a cross-block drag
  // snaps back on the next render (registration appends).
  const reorderGridPhotos = (keys: string[]) => {
    const existingIds = keys.filter((k) => k.startsWith('photo:')).map((k) => k.slice('photo:'.length));
    const stagedIndexes = keys.filter((k) => k.startsWith('staged:')).map((k) => Number(k.slice('staged:'.length)));
    setStagedPhotos((prev) => stagedIndexes.map((i) => prev[i]));
    const currentIds = existingPhotos.map((p) => p.id);
    if (existingIds.length === currentIds.length && existingIds.some((id, i) => id !== currentIds[i])) {
      const previous = existingPhotos;
      setExistingPhotos(existingIds.map((id) => previous.find((p) => p.id === id)!));
      if (entry) {
        reorderPhotos(accessToken, entry.id, existingIds)
          .then((list) => setExistingPhotos(list.photos))
          .catch(() => setExistingPhotos(previous));
      }
    }
  };

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert(strings.entryForm.deleteConfirmTitle, undefined, [
      { text: strings.entryForm.cancel, style: 'cancel' },
      {
        text: strings.entryForm.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          deleteEntry(accessToken, entry.id)
            .then(() => onDone(true))
            .catch(() => setFailed(true));
        },
      },
    ]);
  };

  const confirmCreateSubcategory = async () => {
    const name = subName.trim();
    if (category === null || name === '') return;
    setFailed(false);
    try {
      // Subcategories store the parent's color but always render through the
      // parent, so a later parent recolor carries every child with it.
      const made = await createCategory(accessToken, {
        name,
        color: category.color,
        parentId: category.id,
      });
      setCreated((prev) => [...prev, made]);
      setSubcategory(made);
      setAddingSub(false);
      setSubName('');
      onCategoriesChanged?.();
    } catch {
      setFailed(true);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={styles.headerSide} onPress={() => onDone(false)}>
          <Text style={styles.cancelLabel}>{strings.entryForm.cancel}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {entry ? strings.entryForm.editTitle : strings.day.addEntry}
          </Text>
          <Text style={styles.headerSubtitle}>{dateLabel}</Text>
        </View>
        <View style={styles.headerSideEnd}>
          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            style={[styles.saveButton, saveLooksDisabled && styles.saveButtonDisabled]}
            onPress={() => void save()}
          >
            {saving ? (
              // The spinner stands in the label's place so the pill keeps
              // its size and the header does not jump mid-save.
              <ActivityIndicator
                accessibilityLabel={strings.entryForm.saving}
                color={theme.colors.controlPrimaryFg}
                style={styles.savingSpinner}
              />
            ) : (
              <Text style={[styles.saveLabel, saveLooksDisabled && styles.saveLabelDisabled]}>
                {strings.entryForm.save}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={theme.spacing.space6}
      >
        {/* The body is its own view rather than the scroll view's content
            container so it can go inert under the spinner (#44): a save in
            flight is not a moment to retype the title or reorder the
            photos, and an untouchable, dimmed form says so. */}
        <View style={[styles.body, saving && styles.bodySaving]}>
          <Pressable
            accessibilityRole="button"
            style={styles.dateRow}
            onPress={() => setPickingDate(true)}
          >
            <Text style={styles.dateRowLabel}>{strings.entryForm.dateRow}</Text>
            <Text style={styles.dateRowValue}>{dateLabel}</Text>
            <ChevronDown size={17} color={theme.colors.textQuaternary} strokeWidth={2} />
          </Pressable>
          {category ? (
            <>
              <Pressable
                accessibilityRole="button"
                style={styles.selectedRow}
                onPress={() => {
                  setCategory(null);
                  setSubcategory(null);
                  setAddingSub(false);
                }}
              >
                <CategoryIcon icon={category.icon} color={category.color} />
                <Text style={styles.selectedName}>{category.name}</Text>
                <ChevronDown size={17} color={theme.colors.textQuaternary} strokeWidth={2} />
              </Pressable>

              {/* Subcategory refinement. The brief mocks no subcategory UI, so
                  this derives the quietest pattern consistent with the canvas:
                  a wrap of pills under the collapsed category row, dots in the
                  parent's color (Subcategories inherit icon and color), never
                  demanded — tapping the selected pill deselects it. */}
              <View style={styles.subRow}>
                {children.map((sub) => {
                  const selected = subcategory?.id === sub.id;
                  return (
                    <Pressable
                      key={sub.id}
                      accessibilityRole="button"
                      style={[styles.subPill, selected && styles.subPillSelected]}
                      onPress={() => {
                        setSubcategory(selected ? null : sub);
                        setSubName('');
                      }}
                    >
                      <View style={[styles.subDot, { backgroundColor: category.color }]} />
                      <Text style={styles.subLabel}>{sub.name}</Text>
                    </Pressable>
                  );
                })}
                {addingSub ? (
                  <View style={styles.subCreate}>
                    <TextInput
                      style={styles.subInput}
                      placeholder={strings.entryForm.subcategoryPlaceholder}
                      placeholderTextColor={styles.placeholder.color}
                      autoFocus
                      value={subName}
                      onChangeText={setSubName}
                      // Leaving the field keeps the typed name as a pending
                      // pick; blur and the return key never create (#28).
                      onBlur={() => {
                        setAddingSub(false);
                        setSubName((name) => name.trim());
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={subName.trim() === ''}
                      onPress={() => void confirmCreateSubcategory()}
                    >
                      <Text style={subName.trim() === '' ? styles.subConfirmDisabled : styles.subConfirm}>
                        {strings.entryForm.confirmSubcategory}
                      </Text>
                    </Pressable>
                  </View>
                ) : pendingSubName !== '' ? (
                  // The typed-but-unconfirmed subcategory, rendered exactly
                  // like a confirmed pick and created with the entry at 儲存;
                  // tapping deselects it like any selected pill.
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.subPill, styles.subPillSelected]}
                    onPress={() => setSubName('')}
                  >
                    <View style={[styles.subDot, { backgroundColor: category.color }]} />
                    <Text style={styles.subLabel}>{pendingSubName}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={strings.entryForm.addSubcategory}
                    style={styles.subPill}
                    onPress={() => setAddingSub(true)}
                  >
                    <Plus size={13} color={theme.colors.iconDefault} strokeWidth={2} />
                  </Pressable>
                )}
              </View>

              <TextInput
                style={styles.titleInput}
                placeholder={strings.entryForm.titlePlaceholder}
                placeholderTextColor={styles.placeholder.color}
                maxLength={80}
                autoFocus
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.noteInput}
                placeholder={strings.entryForm.notePlaceholder}
                placeholderTextColor={styles.placeholder.color}
                multiline
                value={note}
                onChangeText={setNote}
              />
              <PhotoGrid
                photos={[
                  ...existingPhotos.map((p) => ({ key: `photo:${p.id}`, uri: p.thumbUrl })),
                  ...stagedPhotos.map((p, i) => ({ key: `staged:${i}`, uri: p.thumbUri })),
                ]}
                editable={{ onAdd: addPhotos, onRemove: removeGridPhoto, onReorder: reorderGridPhotos }}
              />
              {photosMissing ? (
                <Text style={styles.notice}>{strings.entryForm.draftPhotosMissing}</Text>
              ) : null}
              {failed ? <Text style={styles.error}>{strings.entryForm.saveFailed}</Text> : null}
              {photosFailed ? (
                <Text style={styles.error}>{strings.entryForm.photoUploadFailed}</Text>
              ) : null}
              {entry ? (
                <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete}>
                  <Text style={styles.deleteLabel}>{strings.entryForm.delete}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.searchField}>
                <Search size={16} color={theme.colors.iconMuted} strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={strings.entryForm.categoryPlaceholder}
                  placeholderTextColor={styles.placeholder.color}
                  value={query}
                  onChangeText={setQuery}
                />
              </View>
              <View style={styles.pickerCard}>
                {/* The pinned 新增類別 row is always last, so every row above
                    it wears a divider. */}
                {filtered.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    style={[styles.pickerRow, styles.pickerRowDivided]}
                    onPress={() => {
                      setCategory(c);
                      setSubcategory(null);
                      setFailed(false);
                    }}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} />
                    <Text style={styles.pickerName}>{c.name}</Text>
                  </Pressable>
                ))}
                {trimmedQuery !== '' && !exactMatch ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.pickerRow, styles.pickerRowDivided]}
                    onPress={() => setCreatingName(trimmedQuery)}
                  >
                    <View style={styles.createGlyph}>
                      <Plus size={13} color={theme.colors.iconDefault} strokeWidth={2} />
                    </View>
                    <Text style={styles.pickerName}>{strings.entryForm.createRow(trimmedQuery)}</Text>
                  </Pressable>
                ) : null}
                {/* Pinned 新增類別 (#28): creation is discoverable before
                    typing; type-to-create above stays. */}
                <Pressable
                  accessibilityRole="button"
                  style={styles.pickerRow}
                  onPress={() => setCreatingName(trimmedQuery)}
                >
                  <View style={styles.createGlyph}>
                    <Plus size={13} color={theme.colors.iconDefault} strokeWidth={2} />
                  </View>
                  <Text style={styles.pickerName}>{strings.categories.add}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      {pickingDate ? (
        <DatePickerSheet
          value={date}
          onPick={(picked) => {
            setDate(picked);
            setPickingDate(false);
          }}
          onClose={() => setPickingDate(false)}
        />
      ) : null}

      {creatingName !== null ? (
        <CategoryEditorSheet
          accessToken={accessToken}
          parentChoices={topLevel}
          childrenOfTarget={[]}
          initialName={creatingName}
          // Create mode never reaches the child-editor rows.
          onOpen={() => undefined}
          onClose={() => setCreatingName(null)}
          onCategoriesChanged={() => onCategoriesChanged?.()}
          onCreated={(made) => {
            setCreated((prev) => [...prev, made]);
            // A subcategory made here selects its parent with itself as
            // the refinement; a top-level pick stands alone.
            const madeParent = made.parentId
              ? topLevel.find((c) => c.id === made.parentId)
              : undefined;
            if (madeParent) {
              setCategory(madeParent);
              setSubcategory(made);
            } else {
              setCategory(made);
              setSubcategory(null);
            }
            setSubName('');
            setQuery('');
            setCreatingName(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = createStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: t.spacing.navBarHeight,
    paddingHorizontal: t.spacing.screenGutter,
  },
  headerSide: {
    minWidth: t.spacing.fabSize,
    justifyContent: 'center',
  },
  headerSideEnd: {
    minWidth: t.spacing.fabSize,
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...t.typography.sectionHeader,
    color: t.colors.textPrimary,
  },
  headerSubtitle: {
    ...t.typography.meta,
    color: t.colors.textSecondary,
  },
  cancelLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: t.colors.controlPrimaryBg,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.space6,
    paddingVertical: t.spacing.space3,
  },
  saveButtonDisabled: {
    backgroundColor: t.colors.controlDisabledBg,
  },
  saveLabel: {
    ...t.typography.meta,
    color: t.colors.controlPrimaryFg,
  },
  saveLabelDisabled: {
    color: t.colors.controlDisabledFg,
  },
  body: {
    gap: t.spacing.space6,
    paddingHorizontal: t.spacing.screenGutter,
    paddingTop: t.spacing.space6,
    paddingBottom: t.spacing.space10,
  },
  bodySaving: {
    opacity: 0.4,
    pointerEvents: 'none',
  },
  savingSpinner: {
    // Matched to the label it replaces, so the pill keeps its height.
    height: t.typography.meta.lineHeight,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    paddingHorizontal: t.spacing.space5,
    backgroundColor: t.colors.surfaceFill,
    borderRadius: t.radius.r4,
  },
  searchInput: {
    ...singleLineField(t, t.typography.note),
    color: t.colors.textPrimary,
    flex: 1,
    paddingVertical: 0,
  },
  pickerCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
    minHeight: t.spacing.rowHeight,
    paddingVertical: t.spacing.rowPaddingY,
    paddingHorizontal: t.spacing.cardPadding,
  },
  pickerRowDivided: {
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.lineSeparator,
  },
  pickerName: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    flex: 1,
  },
  createGlyph: {
    width: 22,
    height: 22,
    borderRadius: t.radius.r2,
    backgroundColor: t.colors.surfaceFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    minHeight: t.spacing.rowHeight,
    paddingVertical: t.spacing.rowPaddingY,
    paddingHorizontal: t.spacing.cardPadding,
  },
  dateRowLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
  },
  dateRowValue: {
    ...t.typography.entryTitle,
    color: t.colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space5,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    paddingVertical: t.spacing.space5,
    paddingHorizontal: t.spacing.cardPadding,
  },
  selectedName: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    flex: 1,
  },
  subRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.space4,
  },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space3,
    minHeight: t.spacing.space9,
    paddingHorizontal: t.spacing.space5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineSeparator,
  },
  subPillSelected: {
    backgroundColor: t.colors.surfaceFillStrong,
    borderColor: t.colors.focusRing,
  },
  subDot: {
    width: t.dot.size,
    height: t.dot.size,
    borderRadius: t.radius.pill,
  },
  subLabel: {
    ...t.typography.meta,
    color: t.colors.textPrimary,
  },
  subCreate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.space4,
  },
  // Padding-based sizing, no forced height and no inherited lineHeight:
  // iOS TextInput clips CJK glyphs inside a forced line box and top-anchors
  // the placeholder inside a fixed height; letting it wrap its natural line
  // centers both (Simon, 2026-08-19, two rounds). Sized to its sibling pills
  // rather than to singleLineField's hit target.
  subInput: {
    fontSize: t.typography.meta.fontSize,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.pill,
    borderWidth: t.border.hairline,
    borderColor: t.colors.lineField,
    paddingHorizontal: t.spacing.space5,
    paddingVertical: t.spacing.space3,
    minWidth: t.spacing.fabSize * 2,
  },
  subConfirm: {
    ...t.typography.meta,
    color: t.colors.textPrimary,
  },
  subConfirmDisabled: {
    ...t.typography.meta,
    color: t.colors.controlDisabledFg,
  },
  titleInput: {
    ...singleLineField(t, t.typography.entryTitle),
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.r3,
    paddingHorizontal: t.spacing.cardPadding,
  },
  noteInput: {
    ...t.typography.note,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.r3,
    paddingHorizontal: t.spacing.cardPadding,
    paddingTop: t.spacing.space5,
    minHeight: t.spacing.rowHeight * 3,
    textAlignVertical: 'top',
  },
  placeholder: {
    color: t.colors.textPlaceholder,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: t.spacing.space5,
  },
  deleteLabel: {
    ...t.typography.entryTitle,
    color: t.colors.textDestructive,
  },
  error: {
    ...t.typography.meta,
    color: t.colors.textDestructive,
  },
  notice: {
    ...t.typography.meta,
    color: t.colors.textTertiary,
  },
}));
