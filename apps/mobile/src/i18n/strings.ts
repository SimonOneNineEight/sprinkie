// String-catalog discipline (MVP spec): components never hardcode
// user-facing text; every label lives here, enforced by
// i18next/no-literal-string. zh-TW is the app's primary language; the
// English catalog (strings.en.ts) is typed as StringCatalog, so the
// compiler enforces its completeness. Date labels and titles are catalog
// functions: word order belongs to the language, never to a shared
// template.
const weekdaysFull = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const zhTW = {
  signIn: {
    wordmark: 'Sprinkie',
    promise: '每天五分鐘，留下你的生活',
    google: '使用 Google 帳戶登入',
    emailButton: '使用電子郵件登入',
    emailTitle: '電子郵件登入',
    emailPlaceholder: '電子郵件',
    passwordPlaceholder: '密碼',
    signInAction: '登入',
    signUpAction: '建立帳戶',
    toggleToSignUp: '還沒有帳戶？註冊',
    toggleToSignIn: '已有帳戶？登入',
    // 忘記密碼 (#21): the email carries a 6-digit code typed in here, since
    // the app has no URL scheme for a link to open.
    forgotPassword: '忘記密碼？',
    resetTitle: '重設密碼',
    resetBody: '輸入註冊時的電子郵件，我們會寄送 6 位數驗證碼。',
    sendCode: '寄送驗證碼',
    codeSent: (email: string) => `已寄送 6 位數驗證碼至 ${email}`,
    codePlaceholder: '驗證碼',
    next: '下一步',
    newPasswordPlaceholder: '新密碼',
    updateAndSignIn: '更新並登入',
    wrongCode: '驗證碼錯誤或已過期',
    shortPassword: '密碼至少需要 6 個字元',
    updatePasswordFailed: '更新密碼失敗，請再試一次',
    sendFailed: '寄送失敗，請再試一次',
    alreadyRegistered: '此電子郵件已註冊，請直接登入或使用忘記密碼。',
    // A sign-up the server wants confirmed finishes with the emailed code.
    confirmTitle: '確認電子郵件',
    confirmBody: (email: string) => `已寄送 6 位數驗證碼至 ${email}，輸入後即完成註冊。`,
    finishSignUp: '完成註冊',
    resend: '重新寄送',
    resendIn: (seconds: number) => `重新寄送（${seconds} 秒）`,
    devLogin: '以測試帳號登入（開發用）',
    error: '登入失敗，請再試一次',
  },
  settings: {
    title: '設定',
    open: '設定',
    accountHeader: '帳號',
    signOut: '登出',
    deleteAccount: '刪除帳號',
    deleteConfirmTitle: '刪除帳號？',
    // The 30-day grace (#15), plainly stated per the content rules.
    deleteConfirmBody: '30天內重新登入即可復原。之後所有紀錄、照片與類別將永久刪除。',
    deleteConfirm: '刪除',
    deleteFailed: '刪除失敗，請再試一次',
    // The deactivated gate screen: restoring takes a deliberate tap, never
    // a mere session restore.
    deactivatedTitle: '帳號已停用',
    deactivatedBody: '30天內可復原帳號。之後所有紀錄、照片與類別將永久刪除。',
    restore: '復原帳號',
    restoreFailed: '復原失敗，請再試一次',
    // The App Language row and picker (#35). 系統預設 translates with the
    // UI; the two language names are fixed endonyms, never translated.
    generalHeader: '一般',
    // The two legal rows (#60). 關於 rather than 法律: the section is where a
    // person looks for what the app is, not a lawyer's heading.
    aboutHeader: '關於',
    privacyPolicy: '隱私權政策',
    termsOfService: '服務條款',
    language: '語言',
    systemDefault: '系統預設',
    zhHant: '繁體中文',
    english: 'English',
  },
  month: {
    title: (month: number) => `${month}月`,
    // The title as VoiceOver reads it: the year sits in a separate label (#18).
    accessibleTitle: (year: number, month: number) => `${year}年${month}月`,
    yearLabel: (year: number) => `${year}年`,
    emptyDay: '這天沒有紀錄',
    // weekday is a 0-Sunday index, per Date#getDay.
    dateLabel: (month: number, day: number, weekday: number) =>
      `${month}月${day}日 ${weekdaysFull[weekday]}`,
    weekdaysShort: ['日', '一', '二', '三', '四', '五', '六'],
    weekdaysFull,
  },
  day: {
    addEntry: '新增紀錄',
    back: '返回',
    empty: '今天還沒有紀錄',
    emptyOtherDay: '這天沒有紀錄',
    loadFailed: '無法載入紀錄',
    reorderFailed: '排序失敗，請再試一次',
    unreadable: '（無法讀取的紀錄）',
    // Draft retention (#14) — derived copy, no canvas artboard: the meta
    // line under a kept draft's title on the day view.
    draftUnsaved: '尚未儲存',
  },
  photos: {
    addPhoto: '新增照片',
    takePhoto: '拍照',
    fromLibrary: '從相簿選擇',
    removeConfirmTitle: '移除這張照片？',
    remove: '移除',
    uploadFailed: '照片上傳失敗，稍後可在編輯這筆紀錄時重新加入',
    attachFailed: '無法加入照片',
    // A picked photo's tile until it is ready to attach (#92), read by VoiceOver.
    processing: '處理中',
    // A 拍照 after the camera was denied, once iOS will not ask again (#89,
    // wording from its triage brief).
    cameraOffTitle: '無法使用相機',
    cameraOffMessage: '請到設定開啟 Sprinkie 的相機權限。',
    openSettings: '開啟設定',
    // The full-screen viewer's ✕ (#114).
    close: '關閉',
    counter: (n: number, total: number) => `${n} / ${total}`,
  },
  // The read-only Entry view between a day card and the form (#119).
  entryView: {
    edit: '編輯',
    // Where this Entry sits among the day's visible ones, centred in the bar.
    position: (n: number, total: number) => `${n} / ${total}`,
  },
  entryForm: {
    cancel: '取消',
    save: '儲存',
    editTitle: '紀錄',
    // The editable date row (#24, ratified 2026-09-10).
    dateRow: '日期',
    delete: '刪除紀錄',
    deleteConfirmTitle: '刪除這筆紀錄？',
    deleteConfirm: '刪除',
    categoryPlaceholder: '類別',
    createRow: (name: string) => `建立「${name}」`,
    addSubcategory: '新增子類別',
    subcategoryPlaceholder: '子類別',
    titlePlaceholder: '標題',
    notePlaceholder: '備註（選填）',
    // The whole save runs under a spinner on 儲存 (#44): a silent save with
    // photos in flight read as a crash.
    saving: '儲存中',
    saveFailed: '儲存失敗，請再試一次',
    // Draft retention (#14) — derived copy: the photo half of a save failed;
    // the draft keeps the photos and 儲存 retries.
    photoUploadFailed: '照片上傳失敗，請再試一次',
    // Derived copy: a restored draft whose cached photo files the OS purged.
    draftPhotosMissing: '部分照片已無法讀取',
  },
  categories: {
    title: '類別',
    add: '新增類別',
    editTitle: '編輯類別',
    save: '儲存',
    // The color drawer's confirm.
    done: '完成',
    namePlaceholder: '名稱',
    searchPlaceholder: '搜尋類別',
    // Canvas parent section: the collapsible 上層分類 row and its hints.
    parentHeader: '上層分類（選填）',
    noParent: '無',
    parentHintTop: '獨立類別',
    parentHintSub: '子類別',
    inheritHint: '子類別沿用上層分類的圖示與顏色。',
    colorHeader: '顏色',
    iconHeader: '圖示',
    subcategoriesHeader: '子類別',
    addSubcategory: '新增子類別',
    deleteCategory: '刪除類別',
    deleteConfirmTitle: (name: string) => `刪除「${name}」？`,
    // The designed lifecycle copy (issue #10 AC).
    inUseExplanation: '已有紀錄使用這個類別。重新命名會一併帶著走，因此不提供刪除。',
    // Derived copy: the canvas specifies only the in-use case.
    hasChildrenExplanation: '請先刪除底下的子類別。',
    saveFailed: '儲存失敗，請再試一次',
    // The 類別 sheet's visibility toggle (#30): one header button whose
    // label flips with the state.
    hideAll: '全部隱藏',
    showAll: '全部顯示',
  },
  year: {
    title: (year: number) => `${year}年`,
    monthLabel: (month: number) => `${month}月`,
    countLabel: (count: number) => `今年到目前為止 ${count} 則紀錄`,
    // Derived copy: the canvas labels only the current year.
    totalLabel: (count: number) => `共 ${count} 則紀錄`,
    // The endless year wheel behind the title (#27, ratified 2026-09-10).
    pickYear: '選擇年份',
    open: '年',
    today: '今天',
  },
  // The compact date picker behind the entry form's date row (#24).
  datePicker: {
    title: (year: number, month: number) => `${year}年${month}月`,
    prevMonth: '上個月',
    nextMonth: '下個月',
  },
  colorDrawer: {
    custom: '自訂顏色',
    // Canvas labels.
    saved: '已存的顏色',
    previewTitle: '在月曆上的樣子',
    sideBySide: '與現有類別並排',
    // The tappable hex readout (#29).
    hexLabel: '色號',
    // Accessibility-only labels for the area and hue strip.
    hue: '色相',
    areaLabel: '飽和度與亮度',
    lighter: '增加亮度',
    darker: '減少亮度',
    // Forgetting a Saved Color (#47): the body says the part a User worries
    // about — a Saved Color is a memory of use, not a possession, so the
    // Categories wearing it are untouched.
    forgetConfirmTitle: '不再保留這個顏色？',
    forgetConfirmBody: '使用這個顏色的類別不會改變。',
    forget: '移除',
    forgetFailed: '移除失敗，請再試一次',
  },
  health: {
    loading: '連線中…',
    ok: '系統狀態:正常',
    schemaVersion: (version: number) => `資料庫版本:${version}`,
    unreachable: '無法連線到伺服器',
  },
  specimen: {
    title: '設計樣本',
    semanticColors: '語意色',
    categoryPalette: '類別色版',
    typeRoles: '文字樣式',
    dotGeometry: '圓點與年曆方塊',
    typeSample: '週末去河濱公園騎車,傍晚和朋友吃了火鍋',
    yearBoxNumeral: '8',
  },
};

export type StringCatalog = typeof zhTW;
export const strings: StringCatalog = zhTW;
