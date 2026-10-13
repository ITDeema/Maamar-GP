"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

/*
 * Translations + language switching.
 * To add text: add the SAME key to both `ar` and `en` below
 * (TypeScript shows an error if one language is missing a key),
 * then use it in a screen with: const { t } = useT();  t("your.key")
 */

export type Lang = "ar" | "en";

const ar = {
  "brand.name": "معمار",

  "common.email": "البريد الإلكتروني",
  "common.password": "كلمة المرور",
  "common.confirmPassword": "تأكيد كلمة المرور",
  "common.fullName": "الاسم الكامل",
  "common.accountType": "نوع الحساب",
  "common.cancel": "إلغاء",

  "role.homeowner": "مالك منزل",
  "role.architect": "معماري",

  "nav.saved": "المفضلات",
  "nav.home": "الصفحة الرئيسية",
  "nav.history": "السجل",
  "nav.profile": "البروفايل",
  "profile.myAccount": "حسابي",

  "home.title": "مرحبًا بعودتك إلى معمار",
  "home.subtitle": "ابدأ مشروعًا جديدًا أو تابع مشاريعك الأخيرة",
  "home.recent": "المشاريع الأخيرة",
  "home.newProject": "مشروع جديد",
  "home.newProjectHint": "ابدأ بتحليل قطعة أرض جديدة",
  "home.viewAll": "عرض جميع المشاريع",
  "home.empty": "لا توجد مشاريع سابقة حتى الآن",
  "home.emptyHint": "ابدأ مشروعك الأول لتظهر نتائجه هنا",

  "error.nameRequired": "أدخل الاسم الكامل",
  "error.emailInvalid": "أدخل بريدًا إلكترونيًا صحيحًا",
  "error.passwordRequired": "أدخل كلمة المرور",
  "error.passwordShort": "كلمة المرور يجب ألا تقل عن {min} أحرف",
  "error.passwordMismatch": "كلمتا المرور غير متطابقتين",
  "error.termsRequired": "يجب الموافقة على الشروط والأحكام",

  "login.title": "تسجيل الدخول",
  "login.subtitle": "مرحبًا بعودتك، تابع تحليل مواقعك",
  "login.forgot": "نسيت كلمة المرور؟",
  "login.submit": "دخول",
  "login.noAccount": "ليس لديك حساب؟",
  "login.toSignup": "إنشاء حساب",

  "signup.title": "إنشاء حساب جديد",
  "signup.subtitle": "اختر نوع الحساب للبدء بتحليل موقعك",
  "signup.fullNamePlaceholder": "مثال: سارة العتيبي",
  "signup.terms": "أوافق على الشروط والأحكام وسياسة الخصوصية",
  "signup.submit": "إنشاء حساب",
  "signup.haveAccount": "لديك حساب مسبقًا؟",
  "signup.toLogin": "تسجيل الدخول",
  "signup.agreePrefix": "أوافق على",
  "signup.termsLink": "الشروط والأحكام وسياسة الخصوصية",

  "profile.accountInfo": "معلومات الحساب",
  "profile.editAccount": "تعديل المعلومات",
  "profile.settings": "الإعدادات",
  "profile.language": "لغة المنصة",
  "profile.manage": "إدارة الحساب",
  "profile.changePassword": "تغيير كلمة المرور",
  "profile.validatePassword": "التحقق من البيانات",
  
  "profile.currentPassword": "كلمة المرور الحالية",
  "profile.newPassword": "كلمة المرور الجديدة",
  "profile.confirmPassword": "تأكيد كلمة المرور الجديدة",
  
  "profile.passwordFieldsRequired": "يرجى تعبئة جميع حقول كلمة المرور",
  "profile.passwordMismatch": "كلمة المرور الجديدة وتأكيدها غير متطابقين",
  "profile.passwordUnchanged": "يجب أن تختلف كلمة المرور الجديدة عن الحالية",


  "profile.logout": "تسجيل الخروج",
  "profile.logoutBody": "هل أنت متأكد من تسجيل الخروج؟",
  "profile.delete": "حذف الحساب",
  "profile.deleteWarning":
    "سيتم حذف حسابك وجميع نتائجك المحفوظة وسجل تحليلاتك.",
  "profile.deleteConfirm": "أدخل كلمة المرور لتأكيد الحذف",

  "common.save": "حفظ",
  "common.rename": "إعادة تسمية",
  "common.viewResults": "عرض النتائج",
  "common.searchByName": "ابحث باسم النتيجة",
  "common.noMatches": "لا توجد نتائج مطابقة للبحث",
  "unit.sqm": "م²",

  "forgot.title": "استعادة كلمة المرور",
  "forgot.subtitle": "أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق",
  "forgot.submit": "إرسال الرمز",
  "forgot.back": "العودة إلى تسجيل الدخول",

  "rename.title": "إعادة تسمية النتيجة",
  "rename.label": "اسم النتيجة",
  "rename.errorRequired": "أدخل اسمًا للنتيجة",

  "saved.title": "القطع المحفوظة",
  "saved.subtitle": "النتائج التي حفظتها للرجوع لها لاحقًا",
  "saved.empty": "لا توجد نتائج محفوظة بعد",
  "saved.emptyHint": "احفظ نتيجة من لوحة النتائج لتظهر هنا",
  "saved.remove": "إزالة من المحفوظات",
  "saved.removeBody": "ستُزال «{name}» من المحفوظات، وتبقى في السجل.",
  "saved.removeConfirm": "إزالة",

  "history.title": "سجل التحليلات",
  "history.subtitle": "جميع عمليات تحليل المواقع التي أجريتها",
  "history.empty": "لا توجد تحليلات بعد",
  "history.colDate": "التاريخ",
  "history.colName": "الاسم",
  "history.colArea": "المساحة",
  "history.colNotes": "ملاحظات",
  "history.colActions": "إجراءات",
  "history.noteSetback": "القطعة قريبة من الحد الأدنى للارتدادات",
};

export type TranslationKey = keyof typeof ar;

const en: Record<TranslationKey, string> = {
  "brand.name": "معمار",

  "common.email": "Email",
  "common.password": "Password",
  "common.confirmPassword": "Confirm password",
  "common.fullName": "Full name",
  "common.accountType": "Account type",
  "common.cancel": "Cancel",

  "role.homeowner": "Homeowner",
  "role.architect": "Architect",

  "nav.saved": "Favorites",
  "nav.home": "Home",
  "nav.history": "History",
  "nav.profile": "Profile",
  "profile.myAccount": "My Account",

  "home.title": "Welcome back to Maamar",
  "home.subtitle": "Start a new project or continue your recent projects",
  "home.recent": "Recent projects",
  "home.newProject": "New Project",
  "home.newProjectHint": "Start analyzing a new plot",
  "home.viewAll": "View all projects",
  "home.empty": "No previous projects yet",
  "home.emptyHint": "Start your first project to see its results here",

  "error.nameRequired": "Enter your full name",
  "error.emailInvalid": "Enter a valid email address",
  "error.passwordRequired": "Enter your password",
  "error.passwordShort": "Password must be at least {min} characters",
  "error.passwordMismatch": "Passwords do not match",
  "error.termsRequired": "You must accept the terms and conditions",

  "login.title": "Log in",
  "login.subtitle": "Welcome back, continue analyzing your sites",
  "login.forgot": "Forgot your password?",
  "login.submit": "Log in",
  "login.noAccount": "Don't have an account?",
  "login.toSignup": "Sign up",

  "signup.title": "Create a new account",
  "signup.subtitle": "Choose your account type to start analyzing your site",
  "signup.fullNamePlaceholder": "e.g. Sara Alotaibi",
  "signup.terms": "I agree to the terms and conditions and privacy policy",
  "signup.submit": "Sign up",
  "signup.haveAccount": "Already have an account?",
  "signup.toLogin": "Log in",
  "signup.agreePrefix": "I agree to the",
  "signup.termsLink": "Terms & Conditions and Privacy Policy",

  "profile.accountInfo": "Account information",
  "profile.editAccount": "Edit information",
  "profile.settings": "Settings",
  "profile.language": "Platform language",
  "profile.manage": "Manage account",
  "profile.changePassword": "Change password",
  "profile.validatePassword": "Validate details",
  
  "profile.currentPassword": "Current password",
  "profile.newPassword": "New password",
  "profile.confirmPassword": "Confirm new password",
  
  "profile.passwordFieldsRequired": "Please fill in all password fields",
  "profile.passwordMismatch": "New password and confirmation do not match",
  "profile.passwordUnchanged": "The new password must be different from the current password",


  "profile.logout": "Log out",
  "profile.logoutBody": "Are you sure you want to log out?",
  "profile.delete": "Delete account",
  "profile.deleteWarning":
    "Your account, saved results and analysis history will be deleted.",
  "profile.deleteConfirm": "Enter your password to confirm deletion",

  "common.save": "Save",
  "common.rename": "Rename",
  "common.viewResults": "View results",
  "common.searchByName": "Search by result name",
  "common.noMatches": "No results match your search",
  "unit.sqm": "m²",

  "forgot.title": "Reset your password",
  "forgot.subtitle": "Enter your email and we'll send you a verification code",
  "forgot.submit": "Send code",
  "forgot.back": "Back to log in",

  "rename.title": "Rename result",
  "rename.label": "Result name",
  "rename.errorRequired": "Enter a name for the result",

  "saved.title": "Saved plots",
  "saved.subtitle": "Results you saved to come back to later",
  "saved.empty": "No saved results yet",
  "saved.emptyHint": "Save a result from the results dashboard and it will appear here",
  "saved.remove": "Remove from saved",
  "saved.removeBody": "“{name}” will be removed from your saved list. It stays in your history.",
  "saved.removeConfirm": "Remove",

  "history.title": "Analysis history",
  "history.subtitle": "All the site analyses you have run",
  "history.empty": "No analyses yet",
  "history.colDate": "Date",
  "history.colName": "Name",
  "history.colArea": "Area",
  "history.colNotes": "Notes",
  "history.colActions": "Actions",
  "history.noteSetback": "Plot is close to the minimum setback limit",
};

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { ar, en };

/* ---- Everything below is plumbing. You never need to edit it. ---- */

const STORAGE_KEY = "maamar-lang";
const CHANGE_EVENT = "maamar-lang-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function getServerSnapshot(): Lang {
  return "ar";
}

type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (e.g. private mode): the change still applies below.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      let text = dictionaries[lang][key];
      for (const [name, value] of Object.entries(vars ?? {})) {
        text = text.replace(`{${name}}`, String(value));
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useT() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useT must be used inside <LanguageProvider>");
  }
  return context;
}
