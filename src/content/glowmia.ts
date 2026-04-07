export type Language = 'en' | 'ar';

type CopyTree = {
  header: {
    nav: Array<{ href: string; label: { en: string; ar: string } }>;
    languageToggle: { en: string; ar: string };
    themeToggle: { en: string; ar: string };
  };
  home: {
    heroEyebrow: { en: string; ar: string };
    heroTitle: { en: string; ar: string };
    heroDescription: { en: string; ar: string };
    heroPrimary: { en: string; ar: string };
    heroSecondary: { en: string; ar: string };
    introTitle: { en: string; ar: string };
    introBody: { en: string; ar: string };
    featureLabel: { en: string; ar: string };
    featureTitle: { en: string; ar: string };
    featureDescription: { en: string; ar: string };
    featureCta: { en: string; ar: string };
    agentEyebrow: { en: string; ar: string };
    agentTitle: { en: string; ar: string };
    agentDescription: { en: string; ar: string };
    agentCta: { en: string; ar: string };
  };
  designs: {
    title: { en: string; ar: string };
    description: { en: string; ar: string };
    searchPlaceholder: { en: string; ar: string };
    filters: Record<string, { en: string; ar: string }>;
    emptyTitle: { en: string; ar: string };
    emptyDescription: { en: string; ar: string };
    clearFilters: { en: string; ar: string };
    featuredLabel: { en: string; ar: string };
  };
  detail: {
    back: { en: string; ar: string };
    storyLabel: { en: string; ar: string };
    detailsLabel: { en: string; ar: string };
    galleryLabel: { en: string; ar: string };
    relatedLabel: { en: string; ar: string };
    relatedDescription: { en: string; ar: string };
    feedbackLabel: { en: string; ar: string };
    attributes: Record<string, { en: string; ar: string }>;
  };
  feedback: {
    title: { en: string; ar: string };
    description: { en: string; ar: string };
    empty: { en: string; ar: string };
    nameLabel: { en: string; ar: string };
    namePlaceholder: { en: string; ar: string };
    messageLabel: { en: string; ar: string };
    messagePlaceholder: { en: string; ar: string };
    submit: { en: string; ar: string };
  };
  favorites: {
    save: { en: string; ar: string };
    saved: { en: string; ar: string };
  };
  agent: {
    eyebrow: { en: string; ar: string };
    title: { en: string; ar: string };
    description: { en: string; ar: string };
    note: { en: string; ar: string };
    cta: { en: string; ar: string };
  };
  footer: {
    strapline: { en: string; ar: string };
    copyright: { en: string; ar: string };
  };
};

export const glowmiaCopy: CopyTree = {
  header: {
    nav: [
      { href: '/', label: { en: 'Home', ar: 'الرئيسية' } },
      { href: '/designs', label: { en: 'Designs', ar: 'التصاميم' } },
      { href: '/agent', label: { en: 'AI Agent', ar: 'الوكيل الذكي' } },
    ],
    languageToggle: { en: 'العربية', ar: 'English' },
    themeToggle: { en: 'Theme', ar: 'المظهر' },
  },
  home: {
    heroEyebrow: { en: 'Glowmia Portfolio', ar: 'بورتفوليو جلووميا' },
    heroTitle: {
      en: 'Quiet luxury dresses shaped for memorable entrances.',
      ar: 'فساتين بهدوء فاخر مصممة للحضور الذي لا يُنسى.',
    },
    heroDescription: {
      en: 'A curated fashion showcase of modern silhouettes, tactile fabrics, and evening-focused dress stories.',
      ar: 'عرض أزياء منسق يبرز القصّات الحديثة والخامات الراقية وحكايات الفساتين المناسبة للمساء.',
    },
    heroPrimary: { en: 'Explore designs', ar: 'استكشفي التصاميم' },
    heroSecondary: { en: 'Meet the brand', ar: 'تعرفي على العلامة' },
    introTitle: {
      en: 'Glowmia blends editorial restraint with feminine precision.',
      ar: 'تمزج جلووميا بين الرقي التحريري والدقة الأنثوية.',
    },
    introBody: {
      en: 'Every design is presented as a complete portfolio piece with mood, material story, and a clean visual rhythm that lets the dresses speak first.',
      ar: 'يُعرض كل تصميم كقطعة بورتفوليو متكاملة تحمل مزاجاً خاصاً وحكاية خامة وإيقاعاً بصرياً نظيفاً يجعل الفستان يتصدر المشهد.',
    },
    featureLabel: { en: 'Featured designs', ar: 'تصاميم مميزة' },
    featureTitle: {
      en: 'A refined selection from the current collection.',
      ar: 'اختيار راقٍ من المجموعة الحالية.',
    },
    featureDescription: {
      en: 'Browse the standout silhouettes first, then move into the full archive for more detail.',
      ar: 'تصفحي القصّات الأبرز أولاً ثم انتقلي إلى الأرشيف الكامل لمزيد من التفاصيل.',
    },
    featureCta: { en: 'View all designs', ar: 'شاهدي كل التصاميم' },
    agentEyebrow: { en: 'AI Agent', ar: 'الوكيل الذكي' },
    agentTitle: {
      en: 'A styling assistant is on the way.',
      ar: 'مساعد تنسيق الأزياء قادم قريباً.',
    },
    agentDescription: {
      en: 'Glowmia Agent will guide outfit discovery, silhouette matching, and mood-based recommendations in a future release.',
      ar: 'سيساعد وكيل جلووميا مستقبلاً في اكتشاف الإطلالات واختيار القصّات المناسبة وتوصيات تعتمد على المزاج العام.',
    },
    agentCta: { en: 'Visit agent page', ar: 'زيارة صفحة الوكيل' },
  },
  designs: {
    title: { en: 'Design Gallery', ar: 'معرض التصاميم' },
    description: {
      en: 'A curated portfolio of dresses designed for evening moments, polished tailoring, and graceful movement.',
      ar: 'بورتفوليو منسق لفساتين صُممت للحظات المساء والتفصيل المتقن والحركة الانسيابية.',
    },
    searchPlaceholder: { en: 'Search designs', ar: 'ابحثي عن تصميم' },
    filters: {
      all: { en: 'All', ar: 'الكل' },
      evening: { en: 'Evening', ar: 'مسائي' },
      casual: { en: 'Casual', ar: 'كاجوال' },
      formal: { en: 'Formal', ar: 'رسمي' },
      new: { en: 'New', ar: 'جديد' },
    },
    emptyTitle: { en: 'No designs found', ar: 'لم يتم العثور على تصاميم' },
    emptyDescription: {
      en: 'Try a different search or switch to another category.',
      ar: 'جربي بحثاً مختلفاً أو انتقلي إلى فئة أخرى.',
    },
    clearFilters: { en: 'Reset filters', ar: 'إعادة التصفية' },
    featuredLabel: { en: 'Featured', ar: 'مميز' },
  },
  detail: {
    back: { en: 'Back to designs', ar: 'العودة إلى التصاميم' },
    storyLabel: { en: 'Design story', ar: 'حكاية التصميم' },
    detailsLabel: { en: 'Design details', ar: 'تفاصيل التصميم' },
    galleryLabel: { en: 'Gallery', ar: 'المعرض' },
    relatedLabel: { en: 'Related designs', ar: 'تصاميم مشابهة' },
    relatedDescription: {
      en: 'More silhouettes with a matching mood and finish.',
      ar: 'تصاميم إضافية تحمل المزاج نفسه واللمسة نفسها.',
    },
    feedbackLabel: { en: 'Feedback', ar: 'الآراء' },
    attributes: {
      category: { en: 'Category', ar: 'الفئة' },
      occasion: { en: 'Occasion', ar: 'المناسبة' },
      color: { en: 'Color', ar: 'اللون' },
      sleeveType: { en: 'Sleeve', ar: 'الأكمام' },
      length: { en: 'Length', ar: 'الطول' },
      style: { en: 'Style', ar: 'الأسلوب' },
      fabric: { en: 'Fabric', ar: 'الخامة' },
      fit: { en: 'Fit', ar: 'القَصّة' },
    },
  },
  feedback: {
    title: { en: 'Leave your impression', ar: 'اتركي انطباعك' },
    description: {
      en: 'Share what stands out to you about this design.',
      ar: 'شاركي ما الذي لفت انتباهك في هذا التصميم.',
    },
    empty: { en: 'No feedback yet. Be the first to leave a note.', ar: 'لا توجد آراء بعد. كوني أول من يترك ملاحظة.' },
    nameLabel: { en: 'Name', ar: 'الاسم' },
    namePlaceholder: { en: 'Your name', ar: 'اسمك' },
    messageLabel: { en: 'Message', ar: 'الرسالة' },
    messagePlaceholder: { en: 'What do you think about this design?', ar: 'ما رأيك في هذا التصميم؟' },
    submit: { en: 'Submit feedback', ar: 'إرسال الرأي' },
  },
  favorites: {
    save: { en: 'Save', ar: 'حفظ' },
    saved: { en: 'Saved', ar: 'محفوظ' },
  },
  agent: {
    eyebrow: { en: 'Coming soon', ar: 'قريباً' },
    title: { en: 'Glowmia AI Agent', ar: 'وكيل جلووميا الذكي' },
    description: {
      en: 'A future experience for guided inspiration, design discovery, and mood-led wardrobe conversations.',
      ar: 'تجربة قادمة للإلهام الموجّه واكتشاف التصاميم وحوارات الأناقة المبنية على المزاج.',
    },
    note: {
      en: 'The interface is under development and will launch in a future milestone.',
      ar: 'هذه الواجهة قيد التطوير وسيتم إطلاقها في مرحلة لاحقة.',
    },
    cta: { en: 'Back to gallery', ar: 'العودة إلى المعرض' },
  },
  footer: {
    strapline: {
      en: 'A contemporary dress portfolio focused on silhouette, finish, and feeling.',
      ar: 'بورتفوليو معاصر للفساتين يركز على القَصّة واللمسة والإحساس.',
    },
    copyright: { en: 'All portfolio rights reserved.', ar: 'جميع حقوق البورتفوليو محفوظة.' },
  },
};

export function copyFor(language: Language, value: { en: string; ar: string }) {
  return value[language];
}
