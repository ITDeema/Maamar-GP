
"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { useT } from "@/lib/i18n";

const content = {
  ar: {
    title: "الشروط والأحكام وسياسة الخصوصية",
    subtitle: "تعرف على شروط استخدام منصة معمار وكيفية التعامل مع معلوماتك.",
    draft: "هذه مسودة أولية للمراجعة والاعتماد من فريق معمار قبل الإطلاق.",
    updated: "حالة الوثيقة: مسودة",

    sections: [
      {
        title: "1. استخدام منصة معمار",
        text: "تقدم معمار أدوات لدعم تحليل المواقع السكنية ومساعدة المستخدم على فهم خصائص قطعة الأرض. النتائج المقدمة إرشادية ولا تُعد بديلًا عن الدراسة الهندسية المتخصصة أو الاعتمادات الرسمية.",
      },
      {
        title: "2. مسؤوليات المستخدم",
        text: "يلتزم المستخدم بإدخال معلومات صحيحة قدر الإمكان، واستخدام المنصة للأغراض المسموح بها، وعدم محاولة تعطيل خدماتها أو إساءة استخدامها.",
      },
      {
        title: "3. دقة التحليلات",
        text: "تعتمد دقة النتائج على توفر بيانات الموقع وجودتها والمدخلات التي يقدمها المستخدم. قد تتغير النتائج عند تحديث مصادر البيانات أو طرق التحليل. ينبغي التحقق من المعلومات التنظيمية لدى الجهات المختصة قبل اتخاذ قرارات تنفيذية.",
      },
      {
        title: "4. المعلومات التي قد نجمعها",
        text: "قد تشمل المعلومات البريد الإلكتروني ونوع الحساب وإحداثيات القطعة ومساحتها والارتفاع المتوقع للمبنى ونتائج التحليل التي ينشئها المستخدم. يجب مراجعة هذه القائمة وتحديثها وفق طريقة عمل النظام الفعلية قبل إطلاق المنصة.",
      },
      {
        title: "5. استخدام المعلومات",
        text: "تهدف معالجة المعلومات إلى تشغيل وظائف المنصة وإدارة الحسابات وإجراء التحليلات وعرض النتائج والسجل والمحفوظات. ولا يُفترض استخدام البيانات لأغراض إضافية دون توضيحها للمستخدم.",
      },
      {
        title: "6. حفظ المعلومات وحمايتها",
        text: "xxxxxxxx",
      },
      {
        title: "7. حقوق المستخدم",
        text: "تهدف المنصة إلى توفير وسائل لعرض معلومات الحساب وتعديلها وإدارة التحليلات والمحفوظات وطلب حذف الحساب. تعتمد آليات تنفيذ هذه العمليات على الخدمات التي سيتم تفعيلها في النسخة النهائية.",
      },
      {
        title: "8. تحديث السياسة والشروط",
        text: "قد تُحدث هذه الوثيقة عند تطوير وظائف المنصة أو تغيير طريقة معالجة المعلومات، وينبغي إظهار النسخة المعتمدة وتاريخ سريانها للمستخدمين.",
      },
    ],
    back: "العودة إلى إنشاء الحساب",
  },

  en: {
    title: "Terms & Conditions and Privacy Policy",
    subtitle: "Learn about using Maamar and how your information is handled.",
    draft: "This is a preliminary draft for team review and approval before launch.",
    updated: "Document status: Draft",

    sections: [
      {
        title: "1. Using Maamar",
        text: "Maamar provides tools to support residential site analysis and help users understand plot characteristics. Results are advisory and do not replace professional engineering assessments or official approvals.",
      },
      {
        title: "2. User Responsibilities",
        text: "Users should provide information that is as accurate as possible, use the platform for permitted purposes, and avoid disrupting or misusing its services.",
      },
      {
        title: "3. Analysis Accuracy",
        text: "Results depend on the availability and quality of site data and user inputs. Outcomes may change as data sources or analysis methods are updated. Regulatory information should be verified with the relevant authorities before implementation decisions.",
      },
      {
        title: "4. Information We May Collect",
        text: "Information may include email addresses, account types, plot coordinates and areas, expected building heights, and user-generated analysis results. This list must be reviewed against the actual system before launch.",
      },
      {
        title: "5. How Information Is Used",
        text: "Information is intended to support platform functionality, account management, analysis, results, history, and saved projects. Additional uses should be explained to users before being introduced.",
      },
      {
        title: "6. Storage and Protection",
        text: "xxxxxxxxxxxxxxxxxxxxxx",
      },
      {
        title: "7. User Rights",
        text: "The platform aims to support viewing and editing account details, managing analyses and saved results, and requesting account deletion. Actual procedures depend on the services implemented in the final release.",
      },
      {
        title: "8. Updates to These Terms",
        text: "This document may be revised as the platform evolves or its data processing changes. The approved version and effective date should be made available to users.",
      },
    ],
    back: "Back to Sign Up",
  },
};

export default function PrivacyPolicyPage() {
  const { lang } = useT();
  const c = content[lang];

  
  return (
    <>
      
      <header className="border-b border-navy-900/15 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">

          
          <Link href="/" className="flex items-center gap-3">
           <BrandLogo height={48} />
           <span className="font-heading text-lg font-bold text-navy-900">
           {lang === "ar" ? "معمار" : "معمار"}
           </span>
         </Link>


          <nav className="flex items-center gap-5 text-sm font-semibold">
            <Link
              href="/"
              className="text-navy-900/70 hover:text-navy-900"
            >
              {lang === "ar" ? "العودة إلى واجهة معمار" : "Back to MAAMAR"}
            </Link>

            <Link
              href="/login" 
              className="rounded-control bg-gold-500 px-4 py-2 text-navy-900 hover:bg-gold-600"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Log in"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="min-h-screen bg-navy-50 px-4 py-10 sm:px-6">

      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/signup"
            className="text-sm font-semibold text-gold-700 hover:underline"
          >
            {c.back}
          </Link>
        </div>

        <div className="rounded-card border border-navy-900/10 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">
            {c.title}
          </h1>

          <p className="mt-3 text-sm text-navy-900/70">
            {c.subtitle}
          </p>

          <div className="mt-6 rounded-card border border-gold-500/30 bg-gold-500/10 p-4">
            <p className="text-sm font-semibold text-navy-900">
              {c.draft}
            </p>
            <p className="mt-2 text-xs text-navy-900/70">
              {c.updated}
            </p>
          </div>

          <div className="mt-8 space-y-7">
            {c.sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-lg font-bold text-navy-900">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-8 text-navy-900/75">
                  {section.text}
                </p>
              </section>
            ))}
          </div>
        </div>
      
      </div>
    </main>
    </>
  );
}

