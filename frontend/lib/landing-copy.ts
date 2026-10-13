/*
 * All marketing text for the landing page, in both languages.
 * Edit the words here; the layout lives in components/landing/.
 * `en` must have exactly the same shape as `ar` (TypeScript checks this).
 */

const ar = {
  nav: {
    features: "المزايا",
    how: "كيف تعمل",
    audiences: "لمن؟",
    faq: "الأسئلة",
    login: "تسجيل الدخول",
    start: "ابدأ الآن",
    menu: "القائمة",
    language: "English",
  },
 hero: {
  eyebrow: "تحليل الموقع قبل التصميم · الرياض",
  titleBefore: "معمار،",
  titleHighlight: "نقرأ الأرض",
  titleAfter: "لنصنع القرار",
    sub: "منصة ذكاء اصطناعي تحلّل الشمس والظل والرياح ومحيط قطعتك السكنية في الرياض، وتعطيك توصيات تصميمية تراعي كود البناء السعودي.",
    cta: "ابدأ تحليل قطعتك",
    ctaSecondary: "شاهد كيف تعمل",
    points: ["عربي وإنجليزي", "لمالك المنزل والمعماري", "تقارير PDF جاهزة"],
    example: "مثال توضيحي",
    chipSolar: "الإشعاع الشمسي · الجنوب",
    chipSolarValue: "6.4 kWh/m²",
    chipShade: "الظل الطبيعي",
    chipShadeValue: "62%",
    chipCode: "ضمن اشتراطات كود البناء",
    scroll: "اكتشف المزيد",
  },
  sources: {
    label: "مبنية على بيانات موثوقة",
    items: [
      "OpenStreetMap",
      "EPW",
      "ERA5-Land",
      "ArcGIS",
      "GlobalBuildingAtlas",
      "كود البناء السعودي",
    ],
  },
  manifesto: {
    kicker: "لماذا معمار؟",
    text: "أغلب القرارات المؤثرة في راحة البيت واستهلاكه للطاقة تُتخذ في الأيام الأولى من التصميم، قبل أن يتوفر أي تحليل حقيقي للموقع. معمار يضع هذا التحليل بين يديك من البداية.",
  },
  features: {
    kicker: "المزايا",
    title: "كل ما تحتاجه لتفهم قطعتك",
    sub: "من اختيار القطعة إلى التقرير النهائي، في مكان واحد.",
    plot: {
      title: "اختر قطعتك بضغطة زر",
      text: "انقر على الخريطة أو أدخل الإحداثيات، وتبدأ المنصة بجمع بيانات الموقع تلقائيًا.",
    },
    env: {
      title: "تحليل بيئي لكل واجهة",
      text: "الإشعاع الشمسي والظل وانفتاح الرياح وكشف السماء لكل واجهة من الواجهات الأربع.",
      facades: ["شمال", "شرق", "جنوب", "غرب"],
      metrics: ["الإشعاع الشمسي", "الظل الطبيعي", "انفتاح الرياح", "كشف السماء"],
    },
    ai: {
      title: "توصيات تصميمية ذكية",
      text: "اتجاه المبنى والنوافذ والتظليل وموقع الحديقة والارتدادات، مع مؤشرات تشرح السبب.",
      rows: [
        "توجيه الكتلة نحو الشمال",
        "تقليل الفتحات في الواجهة الغربية",
        "كاسرات شمس على الواجهة الجنوبية",
      ],
    },
    code: {
      title: "تراعي كود البناء السعودي",
      text: "محرك قواعد منفصل يراجع كل توصية قبل أن تصلك.",
      rows: ["الارتدادات", "نسبة التغطية", "الارتفاع المسموح"],
    },
    roles: {
      title: "لوحة تتكيف مع دورك",
      text: "ملخص مبسّط لمالك المنزل، وتفاصيل ومؤشرات رقمية للمعماري.",
      homeowner: "مالك منزل",
      architect: "معماري",
    },
    report: {
      title: "تقارير تفصيلية",
      text: "صدّر نتائجك كملف PDF جاهز للمشاركة.",
    },
  },
  how: {
    kicker: "كيف تعمل",
    title: "من القطعة إلى القرار في أربع خطوات",
    steps: [
      { title: "حدد القطعة", text: "انقر على الخريطة أو أدخل الإحداثيات." },
      {
        title: "العمل على جمع بيانات الموقع",
        text: "الشمس والرياح والمباني المجاورة والاشتراطات النظامية، من مصادر موثوقة.",
      },
      {
        title: "نحلّل ونولّد التوصيات",
        text: "حسابات فيزيائية ونموذج تعلّم آلي يحوّلان بيانات الموقع إلى قرارات تصميمية.",
      },
      {
        title: "نراجعها نظاميًا ونعرضها لك",
        text: "محرك قواعد يتأكد من توافقها مع كود البناء السعودي قبل عرضها في لوحة النتائج.",
      },
    ],
  },
  audiences: {
    kicker: "لمن؟",
    title: "لوحة واحدة، وتفصيل يناسبك",
    homeowner: {
      tab: "مالك منزل",
      heading: "ملخص واضح بدون مصطلحات معقدة",
      points: [
        "توصيات مكتوبة بلغة بسيطة",
        "مؤشرات مبسّطة بألوان واضحة",
        "تقرير جاهز تشاركه مع المعماري",
      ],
    },
    architect: {
      tab: "معماري",
      heading: "العمق الذي تحتاجه للتصميم",
      points: [
        "مؤشرات رقمية لكل واجهة",
        "شرح تفصيلي لكل توصية",
        "ضوابط الكود الخاصة بالقطعة",
      ],
    },
    mock: {
      example: "مثال توضيحي",
      title: "نتائج التحليل",
      ready: "قطعتك جاهزة للتصميم",
      readySub: "هذه أهم ثلاث توصيات لموقعك",
      ok: "ضمن الاشتراطات",
      decisions: ["وجّه البيت نحو الشمال", "قلّل زجاج الجهة الغربية", "ظلّل الجهة الجنوبية"],
      facade: "الواجهة الجنوبية",
      metrics: ["الإشعاع الشمسي", "الظل الطبيعي", "انفتاح الرياح", "كشف السماء"],
      values: ["6.4 kWh/m²", "18%", "0.42", "0.81"],
      constraints: "الضوابط النظامية",
      constraintRows: [
        ["أقصى تغطية", "60%"],
        ["أقصى ارتفاع", "≈12 m"],
        ["أدنى ارتداد شمالي", "3 m"],
      ],
    },
  },
  trust: {
    kicker: "الثقة",
    title: "نشرح لك كل قرار",
    items: [
      {
        title: "بيانات موثوقة",
        text: "نعتمد على مصادر معروفة للمناخ والخرائط والمباني، ونوثّقها.",
      },
      {
        title: "محرك قواعد منفصل",
        text: "لا تصلك أي توصية قبل أن تمر على قواعد الكود والاشتراطات.",
      },
      {
        title: "توصيات قابلة للتفسير",
        text: "كل توصية معها المؤشرات التي بُنيت عليها، لتفهم السبب لا النتيجة فقط.",
      },
    ],
    disclaimer:
       "معمار منصة ذكية متكاملة لتحليل المواقع السكنية وتقديم توصيات تصميمية مبنية على بيانات الموقع، ولا تغني عن المعماري المرخّص أو الموافقات الرسمية.",
  },
  faq: {
    kicker: "الأسئلة",
    title: "أسئلة شائعة",
    items: [
      {
        q: "ما هي معمار؟",
        a: "منصة ويب تحلّل الخصائص البيئية والسياقية لقطعة أرض سكنية قبل مرحلة التصميم، وتقدّم توصيات تصميمية مع مؤشرات توضّحها.",
      },
      {
        q: "لمن المنصة؟",
        a: "لملّاك المنازل الذين يريدون فهم أرضهم قبل البدء، وللمعماريين الذين يحتاجون تحليلًا مبكرًا بتفاصيل أعمق.",
      },
      {
        q: "هل تغطي مدنًا غير الرياض؟",
        a: "حاليًا تركّز المنصة على القطع السكنية في مدينة الرياض.",
      },
      {
        q: "من أين تأتي البيانات؟",
        a: "من مصادر موثوقه للخرائط والمباني والمناخ، إضافة إلى اشتراطات كود البناء السعودي.",
      },
      {
        q: "هل تغني عن المعماري أو موافقات البلدية؟",
        a: "لا. معمار أداة دعم قرار مبكر، والتصميم النهائي والموافقات تبقى مسؤولية المختصين والجهات الرسمية.",
      },
      {
        q: "هل التقارير متاحة بالعربي والإنجليزي؟",
        a: "نعم، تستطيع تصدير نتائجك كملف PDF باللغة التي تختارها.",
      },
    ],
  },
  cta: {
    title: "ابدأ بتحليل قطعتك اليوم",
    sub: "أنشئ حسابك، ثم انقر على قطعتك في الخريطة.",
    primary: "إنشاء حساب",
    secondary: "تسجيل الدخول",
  },
  footer: {
    tagline: "تحليل الموقع قبل التصميم",
    links: "روابط",
    account: "الحساب",
    credit: "مشروع تخرج · قسم تقنية المعلومات · جامعة الملك سعود",
    rights: "© 2026 معمار",
  },
};

export type LandingCopy = typeof ar;

const en: LandingCopy = {
  nav: {
    features: "Features",
    how: "How it works",
    audiences: "Who it's for",
    faq: "FAQ",
    login: "Log in",
    start: "Get started",
    menu: "Menu",
    language: "العربية",
  },
  hero: {
    eyebrow: "Site analysis before design · Riyadh",
    titleBefore: "MAAMAR,",
    titleHighlight: "We Read the Land",
    titleAfter: "to Shape the Decision",
    sub: "An AI platform that analyzes sun, shade, wind and the surroundings of your residential plot in Riyadh, and gives you design recommendations that respect the Saudi Building Code.",
    cta: "Analyze your plot",
    ctaSecondary: "See how it works",
    points: ["Arabic & English", "For homeowners & architects", "Ready PDF reports"],
    example: "Illustrative example",
    chipSolar: "Solar radiation · South",
    chipSolarValue: "6.4 kWh/m²",
    chipShade: "Natural shade",
    chipShadeValue: "62%",
    chipCode: "Within building code",
    scroll: "Discover more",
  },
  sources: {
    label: "Built on trusted data",
    items: [
      "OpenStreetMap",
      "EPW",
      "ERA5-Land",
      "ArcGIS",
      "GlobalBuildingAtlas",
      "Saudi Building Code",
    ],
  },
  manifesto: {
    kicker: "Why MAAMAR?",
    text: "Most of the decisions that shape a home's comfort and energy use are made in the first days of design, before any real analysis of the site exists. MAAMAR puts that analysis in your hands from the start.",
  },
  features: {
    kicker: "Features",
    title: "Everything you need to understand your plot",
    sub: "From choosing the plot to the final report, in one place.",
    plot: {
      title: "Select your plot with one click",
      text: "Click on the map or enter coordinates, and the platform starts collecting site data automatically.",
    },
    env: {
      title: "Environmental analysis per façade",
      text: "Solar radiation, shade, wind openness and sky view for each of the four façades.",
      facades: ["North", "East", "South", "West"],
      metrics: ["Solar radiation", "Natural shade", "Wind openness", "Sky view"],
    },
    ai: {
      title: "Smart design recommendations",
      text: "Building orientation, windows, shading, garden placement and setbacks, with indicators that explain why.",
      rows: [
        "Orient the main mass to the north",
        "Reduce openings on the west façade",
        "Add sun breakers on the south façade",
      ],
    },
    code: {
      title: "Respects the Saudi Building Code",
      text: "A separate rule engine reviews every recommendation before it reaches you.",
      rows: ["Setbacks", "Plot coverage", "Allowed height"],
    },
    roles: {
      title: "A dashboard that adapts to your role",
      text: "A simple summary for homeowners, and detailed numeric indicators for architects.",
      homeowner: "Homeowner",
      architect: "Architect",
    },
    report: {
      title: "Detailed Reports",
      text: "Export your results as a PDF ready to share.",
    },
  },
  how: {
    kicker: "How it works",
    title: "From plot to decision in four steps",
    steps: [
      { title: "Select the plot", text: "Click on the map or enter coordinates." },
      {
        title: "Collecting Site Data",
        text: "Sun, wind, neighboring buildings and regulations, from trusted sources.",
      },
      {
        title: "We analyze and generate recommendations",
        text: "Physics-based calculations and a machine-learning model turn site data into design decisions.",
      },
      {
        title: "We check them against the code and show you",
        text: "A rule engine checks their compliance with the Saudi Building Code before they appear on your results dashboard.",
      },
    ],
  },
  audiences: {
    kicker: "Who it's for",
    title: "One dashboard, the detail that suits you",
    homeowner: {
      tab: "Homeowner",
      heading: "A clear summary without complicated jargon",
      points: [
        "Recommendations in plain language",
        "Simple indicators with clear colors",
        "A ready report to share with your architect",
      ],
    },
    architect: {
      tab: "Architect",
      heading: "The depth you need for design",
      points: [
        "Numeric indicators for every façade",
        "A detailed explanation for each recommendation",
        "The code constraints for the plot",
      ],
    },
    mock: {
      example: "Illustrative example",
      title: "Analysis results",
      ready: "Your plot is ready for design",
      readySub: "These are the top three recommendations for your site",
      ok: "Within requirements",
      decisions: [
        "Orient the house to the north",
        "Reduce glass on the west side",
        "Shade the south side",
      ],
      facade: "South façade",
      metrics: ["Solar radiation", "Natural shade", "Wind openness", "Sky view"],
      values: ["6.4 kWh/m²", "18%", "0.42", "0.81"],
      constraints: "Regulatory constraints",
      constraintRows: [
        ["Max coverage", "60%"],
        ["Max height", "≈12 m"],
        ["Min north setback", "3 m"],
      ],
    },
  },
  trust: {
    kicker: "Trust",
    title: "We explain every decision",
    items: [
      {
        title: "Trusted Data",
        text: "We rely on well-known sources for climate, maps and buildings, and we document them.",
      },
      {
        title: "A separate rule engine",
        text: "No recommendation reaches you before it passes the code and regulation rules.",
      },
      {
        title: "Explainable recommendations",
        text: "Every recommendation comes with the indicators behind it, so you understand the reason, not just the result.",
      },
    ],
    disclaimer:
      "MAAMAR is an integrated intelligent platform for residential site analysis and data-driven design recommendations. It does not replace a licensed architect or official approvals.",
  },
  faq: {
    kicker: "FAQ",
    title: "Frequently asked questions",
    items: [
      {
        q: "What is MAAMAR?",
        a: "A web platform that analyzes the environmental and contextual characteristics of a residential plot before the design stage, and provides design recommendations with indicators that explain them.",
      },
      {
        q: "Who is it for?",
        a: "Homeowners who want to understand their land before starting, and architects who need an early analysis with deeper detail.",
      },
      {
        q: "Does it cover cities other than Riyadh?",
        a: "For now the platform focuses on residential plots in the city of Riyadh.",
      },
      {
        q: "Where does the data come from?",
        a: "From trusted sources for maps, buildings and climate, plus the requirements of the Saudi Building Code.",
      },
      {
        q: "Does it replace an architect or municipal approvals?",
        a: "No. MAAMAR is an early decision-support tool. The final design and approvals remain the responsibility of specialists and official authorities.",
      },
      {
        q: "Are reports available in Arabic and English?",
        a: "Yes, you can export your results as a PDF in the language you choose.",
      },
    ],
  },
  cta: {
    title: "Start analyzing your plot today",
    sub: "Create your account, then click your plot on the map.",
    primary: "Create an account",
    secondary: "Log in",
  },
  footer: {
    tagline: "Site analysis before design",
    links: "Links",
    account: "Account",
    credit: "Graduation project · Information Technology Department · King Saud University",
    rights: "© 2026 MAAMAR",
  },
};

export const landingCopy = { ar, en };
