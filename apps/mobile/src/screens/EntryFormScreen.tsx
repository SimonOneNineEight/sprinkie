import { ChevronDown, Plus, Search } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Category, Entry, Photo } from '../api/client';
import { deleteEntry, deletePhoto, reorderPhotos } from '../api/client';
import { MAX_PHOTOS, PhotoGrid } from '../entries/PhotoGrid';
import { PhotoViewer } from '../entries/PhotoViewer';
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
import type { Theme } from '../theme';

/**
 * How the form was left. A save carries the date the Entry was saved onto,
 * which the date row may have moved from the opened-for date (#113).
 */
export type FormOutcome =
  | { kind: 'saved'; date: string }
  | { kind: 'deleted' }
  | { kind: 'cancelled' };

type Props = {
  accessToken: string;
  /** The day the form was opened for; the date row starts here (#24). */
  date: string;
  categories: Category[];
  /** When present, the form edits this Entry instead of creating one. */
  entry?: Entry;
  /** A retained failed save (#14): the form opens prefilled from it and 儲存 retries. */
  draft?: EntryDraft;
  /** How the form was left; each lands somewhere different (#119). */
  onDone: (outcome: FormOutcome) => void;
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
// The title never holds a newline (#115): a line break pasted in, or
// carried by an older title (the PM's journal was imported from Numbers,
// whose cells can hold one), becomes a space. A restored Draft decodes
// through the same initial title, so it is cleaned too.
function oneLine(text: string) {
  return text.replace(/\r\n|[\r\n\u2028\u2029]/g, ' ');
}

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
  // The choice is held by id and looked up below on every render (#100): a
  // form opened before the Categories arrived fills in once they do.
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(initialSubcategoryId ?? null);
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
  const [title, setTitle] = useState(oneLine(initialContent?.title ?? ''));
  const [note, setNote] = useState(initialContent?.note ?? '');
  const [saving, setSaving] = useState(false);
  // Two taps can land inside one render pass, where the disabled prop has
  // not caught up yet, so the in-flight flag is also held where the handler
  // can read it now (#44): 儲存 pressed twice is one Entry, not two.
  const inFlight = useRef(false);
  const noteRef = useRef<TextInput>(null);
  const [failed, setFailed] = useState(false);
  const [photosFailed, setPhotosFailed] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<Photo[]>(entry?.photos ?? []);
  const [stagedPhotos, setStagedPhotos] = useState<ProcessedPhoto[]>(draft?.photos ?? []);
  // The OS may purge the cache files a draft's photo URIs point at; prune the
  // unreadable ones on restore so a retry saves what survives instead of
  // failing forever, and say so.
  const [photosMissing, setPhotosMissing] = useState(false);
  // The grid key of the photo open in the viewer (#118), if any.
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  // Where a failed save is kept (#14). A restored draft keeps its id so the
  // retry overwrites in place and success clears the right slot.
  const [draftId] = useState(() => draft?.id ?? newDraftId());
  // Set when photos fail after the Entry landed, so the in-session retry
  // updates that Entry instead of creating a duplicate.
  const [savedEntryId, setSavedEntryId] = useState<string | undefined>(undefined);
  // The date those words landed on. 取消 after them is not a cancel: the
  // server already holds the edit, so the form reports a save (#119).
  const [wordsSavedOn, setWordsSavedOn] = useState<string | null>(null);

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
  const category = all.find((c) => c.id === categoryId) ?? null;
  const subcategory = all.find((c) => c.id === subcategoryId) ?? null;
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
      setSubcategoryId(made.id);
      setSubName('');
      setAddingSub(false);
      onCategoriesChanged?.();
    }
    switch (result.kind) {
      case 'saved':
        onDone({ kind: 'saved', date });
        return;
      case 'photosFailed':
        // The Entry's words reached the server; retrying updates it.
        setSavedEntryId(result.entryId);
        setWordsSavedOn(date);
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
  // One list in the grid's order, saved then staged, feeds both the grid and
  // the viewer, so a key always opens the photo on its tile (#118).
  const formPhotos = [
    ...existingPhotos.map((p) => ({ key: `photo:${p.id}`, thumbUri: p.thumbUrl, uri: p.url })),
    ...stagedPhotos.map((p, i) => ({ key: `staged:${i}`, thumbUri: p.thumbUri, uri: p.fullUri })),
  ];
  const viewingIndex = formPhotos.findIndex((p) => p.key === viewingKey);

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
    // A failure anywhere in the attach says so once instead of vanishing into
    // the caller's `void` (#87). The moment the camera is denied stays silent
    // (EF.26): the User just said no. A later 拍照, once iOS will not ask
    // again, points to Settings instead of doing nothing forever (#89).
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const current = await ImagePicker.getCameraPermissionsAsync();
        if (!current.granted && !current.canAskAgain) {
          Alert.alert(strings.photos.cameraOffTitle, strings.photos.cameraOffMessage, [
            { text: strings.entryForm.cancel, style: 'cancel' },
            { text: strings.photos.openSettings, onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
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
      // Each photo stands alone: the ones that process attach.
      const settled = await Promise.allSettled(result.assets.slice(0, remaining).map(processPhoto));
      const processed = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
      setStagedPhotos((prev) => [...prev, ...processed]);
      if (processed.length < settled.length) Alert.alert(strings.photos.attachFailed);
    } catch {
      Alert.alert(strings.photos.attachFailed);
    }
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

  const cancel = () =>
    onDone(wordsSavedOn !== null ? { kind: 'saved', date: wordsSavedOn } : { kind: 'cancelled' });

  const confirmDelete = () => {
    if (!entry) return;
    Alert.alert(strings.entryForm.deleteConfirmTitle, undefined, [
      { text: strings.entryForm.cancel, style: 'cancel' },
      {
        text: strings.entryForm.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          deleteEntry(accessToken, entry.id)
            .then(() => onDone({ kind: 'deleted' }))
            .catch(() => setFailed(true));
        },
      },
    ]);
  };

  // Leaving the Subcategory field, by blur or 完成, is the only way out
  // (#102: 建立 is gone). A name matching an existing child selects it;
  // any other stays pending and is created with the Entry at 儲存 (#28).
  const leaveSubField = () => {
    const name = subName.trim();
    const existing = children.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    setAddingSub(false);
    if (existing) {
      setSubcategoryId(existing.id);
      setSubName('');
    } else {
      // One Subcategory per Entry: a new name replaces any pick.
      if (name !== '') setSubcategoryId(null);
      setSubName(name);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={styles.headerSide} onPress={cancel}>
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
                  setCategoryId(null);
                  setSubcategoryId(null);
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
                        setSubcategoryId(selected ? null : sub.id);
                        setSubName('');
                      }}
                    >
                      <View style={[styles.subDot, { backgroundColor: category.color }]} />
                      <Text style={styles.subLabel}>{sub.name}</Text>
                    </Pressable>
                  );
                })}
                {addingSub ? (
                  <TextInput
                    style={styles.subInput}
                    placeholder={strings.entryForm.subcategoryPlaceholder}
                    placeholderTextColor={styles.placeholder.color}
                    autoFocus
                    returnKeyType="done"
                    value={subName}
                    onChangeText={setSubName}
                    onSubmitEditing={leaveSubField}
                    onBlur={leaveSubField}
                  />
                ) : pendingSubName !== '' ? (
                  // The typed subcategory, rendered like a pick and created
                  // with the entry at 儲存. Tapping reopens it for editing
                  // (#102); emptied, it is gone.
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.subPill, styles.subPillSelected]}
                    onPress={() => setAddingSub(true)}
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
                multiline
                maxLength={80}
                autoFocus
                // Return moves on to the note rather than typing a newline
                // the title never holds (#115).
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => noteRef.current?.focus()}
                value={title}
                onChangeText={(text) => setTitle(oneLine(text))}
              />
              <TextInput
                ref={noteRef}
                style={styles.noteInput}
                placeholder={strings.entryForm.notePlaceholder}
                placeholderTextColor={styles.placeholder.color}
                multiline
                value={note}
                onChangeText={setNote}
              />
              <PhotoGrid
                photos={formPhotos.map((p) => ({ key: p.key, uri: p.thumbUri }))}
                editable={{
                  onAdd: addPhotos,
                  onOpen: setViewingKey,
                  onRemove: removeGridPhoto,
                  onReorder: reorderGridPhotos,
                }}
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
                      setCategoryId(c.id);
                      setSubcategoryId(null);
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
              setCategoryId(madeParent.id);
              setSubcategoryId(made.id);
            } else {
              setCategoryId(made.id);
              setSubcategoryId(null);
            }
            setSubName('');
            setQuery('');
            setCreatingName(null);
          }}
        />
      ) : null}
      {viewingIndex >= 0 ? (
        <PhotoViewer
          photos={formPhotos}
          startIndex={viewingIndex}
          onClose={() => setViewingKey(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// Each grow field's padding above and below its lines (#115), so its
// heights read as so many lines plus this twice. The title's centers one
// line inside the 44pt hit target. Read from the factory's theme, like
// every other value in the styles below.
const titlePadding = (t: Theme) => (t.spacing.rowHeight - t.typography.entryTitle.lineHeight) / 2;
const notePadding = (t: Theme) => t.spacing.space5;

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
  // Built like the note below, not by singleLineField (#115): it wraps, so
  // it is a multiline input, which iOS lays out as a text view, not the
  // single-line text field whose baseline a lineHeight shifts (#42). One
  // line is the 44pt hit target, padded evenly so the text and placeholder
  // sit centered; it grows to three lines, then scrolls inside itself.
  titleInput: {
    ...t.typography.entryTitle,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.r3,
    paddingHorizontal: t.spacing.cardPadding,
    paddingTop: titlePadding(t),
    paddingBottom: titlePadding(t),
    minHeight: t.spacing.rowHeight,
    maxHeight: t.typography.entryTitle.lineHeight * 3 + titlePadding(t) * 2,
    textAlignVertical: 'top',
  },
  // Five lines tall from the start, and it scrolls inside itself past that
  // rather than growing the form (#115).
  noteInput: {
    ...t.typography.note,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.r3,
    paddingHorizontal: t.spacing.cardPadding,
    paddingTop: notePadding(t),
    paddingBottom: notePadding(t),
    minHeight: t.typography.note.lineHeight * 5 + notePadding(t) * 2,
    maxHeight: t.typography.note.lineHeight * 5 + notePadding(t) * 2,
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
