import { useT } from "@/lib/i18n";

/*
 * All text for the results dashboard and the exported report, in both languages.
 * `en` must have exactly the same shape as `ar` (TypeScript checks this).
 * Placeholders like {name} are filled in with fill().
 */

const ar = {
  header: { area: "المساحة", date: "التاريخ", coordinates: "الإحداثيات" },
  actions: {
    save: "إضافة إلى المفضلات",
    saved: "في المفضلات",
    export: "تصدير التقرير",
    exportWait: "التصدير متاح بعد تحميل المؤشرات",
    rename: "إعادة تسمية",
    renameHint: "اضغط مرتين لتغيير الاسم",
    home: "الرئيسية",
    newAnalysis: "تحليل جديد",
  },
  messages: {
    saved: "تم حفظ النتيجة باسم «{name}».",
    alreadySaved: "هذه النتيجة محفوظة مسبقًا، ولن تُحفظ مرتين.",
    unsaved: "أُزيلت النتيجة من المفضلات.",
  },
  notFound: {
    title: "لم نجد هذه النتيجة",
    text: "ربما انتهت الجلسة. افتح السجل أو ابدأ تحليلًا جديدًا.",
    history: "فتح السجل",
  },
  facade: {
    label: "الواجهة",
      names: {
      north: "شمال",
      northeast: "شمال شرق",
      east: "شرق",
      southeast: "جنوب شرق",
      south: "جنوب",
      southwest: "جنوب غرب",
      west: "غرب",
      northwest: "شمال غرب",
    },
  },
  map: {
    title: "خريطة الواجهات",
    label: "خريطة تعرض كل واجهة للشمس",
    legendLow: "تعرض أقل للشمس",
    legendHigh: "تعرض أعلى للشمس",
    hint: "لون كل واجهة يوضح مقدار تعرضها للإشعاع الشمسي.",
  },
  indicators: {
    titleSimple: "مؤشرات مبسّطة",
    titleDetailed: "المؤشرات التفصيلية",
    forFacade: "الواجهة {facade}",
    metrics: {
      radiation: "الإشعاع الشمسي",
      shade: "الظل الطبيعي",
      wind: "انفتاح الرياح",
      sky: "كشف السماء",
    },
    levels: { low: "منخفض", medium: "متوسط", high: "مرتفع" },
    loading: "جاري تحميل المؤشرات…",
    errorTitle: "تعذر تحميل المؤشرات",
    errorText: "باقي أجزاء اللوحة تعمل بشكل طبيعي. حاول مرة أخرى.",
    retry: "إعادة المحاولة",
    sample: "بيانات تجريبية",
  },
  site: {
    title: "مؤشرات الموقع",
    windSpeed: "سرعة الرياح",
    windFrom: "اتجاه الرياح (قادمة من)",
    temperature: "درجة الحرارة",
    density: "الكثافة العمرانية",
    avgHeight: "متوسط ارتفاع المباني المجاورة",
    maxHeight: "أعلى مبنى مجاور",
    noise: "مستوى الضوضاء",
    densityLevels: { low: "منخفضة", medium: "متوسطة", high: "عالية" },
  },
  decisions: {
    title: "القرارات التصميمية الموصى بها",
    note: "كل التوصيات أدناه مرّت على محرك الفحص التنظيمي وتراعي كود البناء السعودي.",
    ok: "ضمن الاشتراطات",
    supporting: "المؤشرات الداعمة",
    items: {
      orientation: {
        title: "اتجاه المبنى",
        simple: "وجّه الجزء الأكبر من البيت نحو الشمال.",
        detail:
          "توجيه الكتلة الرئيسية نحو الشمال يقلل الإشعاع المباشر على الواجهات الأطول وقت الظهيرة، وهو الأنسب لمناخ الرياض الحار الجاف.",
      },
      windows: {
        title: "تصميم النوافذ",
        simple: "قلّل الزجاج في الجهة الغربية.",
        detail:
          "اجعل نسبة الزجاج إلى الجدار منخفضة في الواجهة الغربية، واستخدم زجاجًا مزدوجًا معزولًا حراريًا لتخفيف حرارة ما بعد الظهر.",
      },
      shading: {
        title: "التظليل",
        simple: "ضع كاسرات شمس على الجهة الجنوبية.",
        detail:
          "أضف كاسرات شمس أفقية على الواجهة الجنوبية بعمق يقارب 60 سم، لتحجب شمس الصيف العالية وتسمح بشمس الشتاء المنخفضة.",
      },
      garden: {
        title: "موقع الحديقة",
        simple: "ضع الفناء والحديقة في الجهة الشرقية.",
        detail:
          "المبنى يظلل الجهة الشرقية بعد الظهر، فتصلح لفناء مريح وحديقة أقل استهلاكًا للماء.",
      },
      
      materials: {
        title: "مواد البناء",
        simple: "استخدم الزجاج المزدوج والمواد العازلة للصوت والحرارة في الجهة الشرقية.",
        detail:
         "يوصى باستخدام الزجاج المزدوج والمواد العازلة للصوت والحرارة في الجهة الشرقية.",
     },

    },
  },
  constraints: {
    title: "الضوابط النظامية للقطعة",
    text: "القيم المسموحة حسب كود البناء السعودي والتنظيم البلدي، وهي مدخلات استُخدمت في توليد التوصيات.",
    maxCoverage: "أقصى نسبة تغطية",
    maxHeight: "أقصى ارتفاع",
    setback: "أدنى ارتداد {facade}",
  },
    summary: {
    title: "ملخص سريع للموقع",
    hint: "متوسط الواجهات الأربع، ومستوى الضوضاء في الموقع.",
    meterLabel: "{metric}: {level}",
  },
  wind: {
    title: "اتجاه الرياح",
    from: "رياح قادمة من {facade}",
    hint: "السهم يشير إلى الاتجاه الذي تهب نحوه الرياح.",
    diagram: "بوصلة تعرض اتجاه الرياح السائدة",
  },

    hood: {
    title: "معلومات الحي",
    services: "أقرب الخدمات",
    gaugeLabel: "{metric}: {level}",
    kinds: { mosque: "مسجد", school: "مدرسة", pharmacy: "صيدلية", market: "سوق" },
  },
  neighbours: {
    title: "المجاورون",
    hint: "المجاورون على الواجهة {facade}. يظهر فقط ما هو موجود.",
    empty: "لا توجد مبانٍ أو شوارع مجاورة على هذه الواجهة.",
    cols: { kind: "المجاور", height: "الارتفاع", distance: "المسافة" },
    kinds: { street: "شارع", villa: "فيلا", building: "عمارة", land: "أرض فضاء" },
  },
    diagrams: {
    title: "المخططات التحليلية",
    hint: "مخططات للموقع المحيط بنصف قطر 800 م. تعتمد على بيانات خرائط مفتوحة، وقد تكون ناقصة في بعض المناطق.",
    loading: "جارٍ تحميل المخطط…",
    error: "تعذر تحميل بيانات المخطط.",
    retry: "إعادة المحاولة",
    north: "ش",
    sun: {
      title: "مسار الشمس والرياح",
      sunPath: "مسار الشمس",
      hotWind: "رياح حارة",
      coolWind: "رياح باردة",
    },
    land: {
      title: "استخدامات الأراضي",
      stats: "نصف القطر {radius} م · {buildings} مبنى ({source}) · {places} مكان",
      osmDown: " · بيانات OSM غير متوفرة",
      selectedSite: "الموقع المختار",
      uses: {
        residential: "سكني",
        commercial: "تجاري",
        industrial: "صناعي",
        education: "تعليمي",
        religious: "ديني",
        health: "صحي",
        civic: "حكومي وخدمي",
        park: "حدائق ومساحات خضراء",
        parking: "مواقف سيارات",
        water: "مسطحات مائية",
        vacant: "أراضٍ فضاء أو تحت الإنشاء",
        other: "مبانٍ غير مصنفة",
      },
    },
    roads: {
      title: "الطرق والنقل",
      stats: "نصف القطر {radius} م · {bus} موقف حافلات · {metro} محطة مترو أو قطار",
      arterial: "طرق شريانية",
      collector: "شوارع تجميعية",
      local: "شوارع محلية",
      busStop: "موقف حافلات",
      metro: "محطة مترو أو قطار",
    },
  },
  parcelNote:
    "ملاحظة على مستوى القطعة: مساحة هذه القطعة ({area} م²) قريبة من الحد الأدنى لتحقيق كامل الارتدادات مع مساحة بناء عملية. يُنصح بالتأكد من ذلك مع البلدية قبل بدء التصميم التفصيلي. لا علاقة لهذه الملاحظة بصحة التوصيات.",
  disclaimer:
    "معمار أداة دعم قرار مبكر، ولا تغني عن المعماري المرخّص ولا عن موافقات البلدية.",
  exportModal: {
    title: "تصدير التقرير",
    language: "لغة التقرير",
    intro: "يحتوي التقرير على القرارات التصميمية والمؤشرات.",
    generate: "إنشاء التقرير",
    working: "جاري إنشاء التقرير…",
    ready: "التقرير جاهز.",
    download: "تنزيل التقرير",
    failed: "تعذر إنشاء التقرير. حاول مرة أخرى.",
    retry: "إعادة المحاولة",
    close: "إغلاق",
    note: "",
  },
  report: {
    title: "تقرير تحليل الموقع",
    plot: "القطعة",
    footer: "أُنشئ بواسطة منصة معمار.",
  },
  dev: { label: "عرض تجريبي لنوع الحساب (يظهر أثناء التطوير فقط)" },
};

export type ResultsCopy = typeof ar;

const en: ResultsCopy = {
  header: { area: "Area", date: "Date", coordinates: "Coordinates" },
  actions: {
    save: "Add to Favorites",
    saved: "In Favorites",
    export: "Export report",
    exportWait: "Export is available once the indicators have loaded",
    rename: "Rename",
    renameHint: "Double-click to rename",
    home: "Home",
    newAnalysis: "New analysis",
  },
  messages: {
    saved: "The result was saved as “{name}”.",
    alreadySaved: "This result is already saved, so it will not be saved twice.",
    unsaved: "The result was removed from favorites.",
  },
  notFound: {
    title: "We could not find this result",
    text: "Your session may have ended. Open your history or start a new analysis.",
    history: "Open history",
  },
  facade: {
    label: "Façade",
      names: {
      north: "North",
      northeast: "Northeast",
      east: "East",
      southeast: "Southeast",
      south: "South",
      southwest: "Southwest",
      west: "West",
      northwest: "Northwest",
    },
  },
  map: {
    title: "Façade map",
    label: "Map of each façade's sun exposure",
    legendLow: "Less sun exposure",
    legendHigh: "More sun exposure",
    hint: "The color of each façade shows how much solar radiation it receives.",
  },
  indicators: {
    titleSimple: "Simple indicators",
    titleDetailed: "Detailed indicators",
    forFacade: "{facade} façade",
    metrics: {
      radiation: "Solar radiation",
      shade: "Natural shade",
      wind: "Wind openness",
      sky: "Sky view",
    },
    levels: { low: "Low", medium: "Medium", high: "High" },
    loading: "Loading indicators…",
    errorTitle: "The indicators could not be loaded",
    errorText: "The rest of the dashboard is working normally. Please try again.",
    retry: "Try again",
    sample: "Sample data",
  },
  site: {
    title: "Site indicators",
    windSpeed: "Wind speed",
    windFrom: "Wind direction (coming from)",
    temperature: "Temperature",
    density: "Urban density",
    avgHeight: "Average neighboring building height",
    maxHeight: "Tallest neighboring building",
    noise: "Noise level",
    densityLevels: { low: "Low", medium: "Medium", high: "High" },
  },
  decisions: {
    title: "Recommended design decisions",
    note: "Every recommendation below passed the rule-based compliance check and respects the Saudi Building Code.",
    ok: "Within requirements",
    supporting: "Supporting indicators",
    items: {
      orientation: {
        title: "Building orientation",
        simple: "Face most of the house to the north.",
        detail:
          "Orienting the main mass to the north reduces direct radiation on the longer façades at midday, which suits Riyadh's hot-arid climate best.",
      },
      windows: {
        title: "Window design",
        simple: "Use less glass on the west side.",
        detail:
          "Keep the glazing-to-wall ratio low on the west façade and use insulated double glazing to soften the afternoon heat.",
      },
      shading: {
        title: "Shading",
        simple: "Add sun breakers on the south side.",
        detail:
          "Add horizontal sun breakers about 60 cm deep on the south façade to block the high summer sun and let the low winter sun in.",
      },
      garden: {
        title: "Garden placement",
        simple: "Put the courtyard and garden on the east side.",
        detail:
          "The building shades the east side in the afternoon, so it suits a comfortable courtyard and a garden that needs less water.",
      },
      
      materials: {
        title: "Building Materials",
        simple: "Use double-glazed windows and thermal and acoustic insulation on the eastern side.",
        detail:
         "Double glazing and thermal and acoustic insulation are recommended on the eastern side.",
     },

    },
  },
  constraints: {
    title: "Regulatory constraints for the plot",
    text: "The values allowed by the Saudi Building Code and municipal rules. They were used as inputs when generating the recommendations.",
    maxCoverage: "Maximum coverage",
    maxHeight: "Maximum height",
    setback: "Minimum {facade} setback",
  },
  summary: {
    title: "Quick site summary",
    hint: "Average of the four façades, and the site noise level.",
    meterLabel: "{metric}: {level}",
  },
  wind: {
    title: "Wind direction",
    from: "Wind from the {facade}",
    hint: "The arrow points the way the wind blows.",
    diagram: "Compass showing the prevailing wind direction",
  },

    hood: {
    title: "Neighborhood info",
    services: "Nearest services",
    gaugeLabel: "{metric}: {level}",
    kinds: { mosque: "Mosque", school: "School", pharmacy: "Pharmacy", market: "Market" },
  },
  neighbours: {
    title: "Neighbors",
    hint: "Neighbors on the {facade} façade. Only what exists is shown.",
    empty: "No neighboring buildings or streets on this façade.",
    cols: { kind: "Neighbor", height: "Height", distance: "Distance" },
    kinds: { street: "Street", villa: "Villa", building: "Building", land: "Empty land" },
  },

    diagrams: {
    title: "Analysis diagrams",
    hint: "Plans of the area within 800 m of the site. They use open map data, which may be incomplete in some areas.",
    loading: "Loading the diagram…",
    error: "The diagram data could not be loaded.",
    retry: "Try again",
    north: "N",
    sun: {
      title: "Sun path & wind",
      sunPath: "Sun path",
      hotWind: "Hot wind",
      coolWind: "Cool wind",
    },
    land: {
      title: "Land use",
      stats: "Radius {radius} m · {buildings} buildings ({source}) · {places} places",
      osmDown: " · OSM unavailable",
      selectedSite: "Selected site",
      uses: {
        residential: "Residential",
        commercial: "Commercial",
        industrial: "Industrial",
        education: "Education",
        religious: "Religious",
        health: "Health",
        civic: "Government / civic",
        park: "Parks & green areas",
        parking: "Parking",
        water: "Water",
        vacant: "Vacant / construction",
        other: "Unclassified buildings",
      },
    },
    roads: {
      title: "Roads & transport",
      stats: "Radius {radius} m · {bus} bus stops · {metro} rail/metro",
      arterial: "Arterial roads",
      collector: "Collector streets",
      local: "Local streets",
      busStop: "Bus stop",
      metro: "Metro / rail station",
    },
  },
  
  parcelNote:
    "Plot-level note: this plot's area ({area} m²) is close to the minimum needed to meet all setbacks with a practical building area. Check this with the municipality before detailed design. This note does not affect the validity of the recommendations.",
  disclaimer:
    "MAAMAR is an early decision-support tool. It does not replace a licensed architect or municipal approvals.",
  exportModal: {
    title: "Export report",
    language: "Report language",
    intro: "The report contains the design decisions and the indicators.",
    generate: "Generate report",
    working: "Generating the report…",
    ready: "The report is ready.",
    download: "Download report",
    failed: "The report could not be generated. Please try again.",
    retry: "Try again",
    close: "Close",
    note: "",
  },
  report: {
    title: "Site analysis report",
    plot: "Plot",
    footer: "Generated by the MAAMAR platform.",
  },
  dev: { label: "Account type preview (shown during development only)" },
};

export const resultsCopy = { ar, en };

// Returns the results text in the current language.
export function useResultsCopy(): ResultsCopy {
  const { lang } = useT();
  return resultsCopy[lang];
}

// Fills placeholders: fill("Hello {name}", { name: "Sara" }) -> "Hello Sara"
export function fill(text: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    text,
  );
}
