import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Loader2, LogOut, Menu, Pencil, Plus, Shield, Star, Trash2, X } from 'lucide-react';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import type { Design } from '@/src/data/designs';
import { getAdminUsernameFromRequest, isAdminConfigured } from '@/src/lib/adminAuth';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';
import type { Language } from '@/src/content/glowmia';
import { fetchAdminCheckoutOrders, fetchAdminInsights, type AdminInsights, type CheckoutOrderEntry } from '@/src/services/engagement';

type AdminPageProps = { configured: boolean; authenticated: boolean; designs: Design[] };
type EditorMode = 'create' | 'edit' | null;
type OptionItem = { value: string; en: string; ar: string };
type AdminView = 'catalog' | 'insights' | 'orders';

type AdminFormState = {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  occasion: string;
  occasionAr: string;
  color: string;
  colorAr: string;
  sleeveType: string;
  sleeveTypeAr: string;
  length: string;
  lengthAr: string;
  style: string;
  styleAr: string;
  fabric: string;
  fabricAr: string;
  fit: string;
  fitAr: string;
  coverImageUrl: string;
  sideImageUrl: string;
  backImageUrl: string;
};

const initialAdminForm: AdminFormState = {
  name: '',
  nameAr: '',
  description: '',
  descriptionAr: '',
  category: 'evening',
  occasion: '',
  occasionAr: '',
  color: '',
  colorAr: '',
  sleeveType: '',
  sleeveTypeAr: '',
  length: '',
  lengthAr: '',
  style: '',
  styleAr: '',
  fabric: '',
  fabricAr: '',
  fit: '',
  fitAr: '',
  coverImageUrl: '',
  sideImageUrl: '',
  backImageUrl: '',
};

const splitCsv = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean);

const adminCopy = {
  en: {
    adminAccess: 'Admin access',
    pageTitle: 'Glowmia Admin',
    pageDescription: 'Manage the live catalog with a focused editor, bilingual fields, and direct image uploads.',
    addDesign: 'Add design',
    signOut: 'Sign out',
    currentDesigns: 'Current designs',
    currentDesignsDescription: 'Open any card to edit it in a focused side panel while keeping the gallery visible in the background.',
    designCount: (count: number) => `${count} design${count === 1 ? '' : 's'}`,
    noDesigns: 'No designs are in the catalog yet.',
    addFirstDesign: 'Add the first design',
    edit: 'Edit',
    remove: 'Remove',
    newBadge: 'New',
    currentlyEditing: 'Currently editing',
    editingLiveDesign: 'Editing live design',
    publishingNewDesign: 'Publishing new design',
    editDesign: 'Edit design',
    addDesignTitle: 'Add a design',
    close: 'Close',
    editorEditDescription: 'Update text, tags, and imagery in one place, then push the changes directly to Supabase.',
    editorCreateDescription: 'Create a new design with direct image uploads or manual URLs, then publish it straight into the live catalog.',
    storyNaming: 'Story and naming',
    storyNamingDescription: 'Keep the live card title, description, and bilingual copy together in one place.',
    attributesTags: 'Attributes and tags',
    attributesTagsDescription: 'These values shape the public detail page and design metadata.',
    imagesPreview: 'Images and preview',
    imagesPreviewDescription: 'Upload replacements directly or keep the current assets by leaving file inputs untouched.',
    saveDesign: 'Save design',
    updateDesign: 'Update design',
    savingDesign: 'Saving design...',
    updatingDesign: 'Updating design...',
    cancel: 'Cancel',
    adminSetupTitle: 'Admin setup needed',
    adminSetupDescription: 'Add ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET, and SUPABASE_SERVICE_ROLE_KEY to your local environment before using this page.',
    adminSetupHelper: 'Helper command: npm run admin:secrets -- "your-strong-password"',
    loginTitle: 'Admin sign in',
    loginDescription: 'Sign in with your admin credentials to manage the design catalog.',
    username: 'Username',
    password: 'Password',
    adminUsernamePlaceholder: 'Admin username',
    passwordPlaceholder: 'Secure password',
    enterAdmin: 'Enter admin',
    signingIn: 'Signing in...',
    loginFailed: 'Login failed.',
    loginUnavailable: 'Unable to sign in right now.',
    saveError: 'Unable to save this design.',
    deleteError: 'Unable to remove this design.',
    saveMessageCreate: 'Design saved to Supabase and ready for the public gallery.',
    saveMessageUpdate: 'Design updated in Supabase and reflected on the public website.',
    deleteMessage: 'Design removed from Supabase.',
    removeConfirm: 'Remove this design from Supabase and the public gallery?',
    imagesRequired: 'Add a cover/front image by upload or URL before saving.',
    coverUpload: 'Cover/front image upload',
    sideUpload: 'Side view upload',
    backUpload: 'Back view upload',
    coverUrl: 'Cover/front image URL',
    sideUrl: 'Side view URL',
    backUrl: 'Back view URL',
    keepingCurrentCover: 'Keeping current cover image unless you upload a replacement.',
    keepingCurrentSide: 'Keeping current side image unless you upload a replacement.',
    keepingCurrentBack: 'Keeping current back image unless you upload a replacement.',
    selectedFile: (name: string) => `Selected: ${name}`,
    coverPreview: 'Cover/front preview appears here.',
    sidePreview: 'Side view preview appears here.',
    backPreview: 'Back view preview appears here.',
    designName: 'Design name',
    designNameAr: 'Design name in Arabic',
    description: 'Description',
    descriptionAr: 'Description in Arabic',
    category: 'Category',
    color: 'Color',
    sleeveType: 'Sleeve type',
    length: 'Length',
    fabric: 'Fabric',
    fit: 'Fit',
    occasionTags: 'Occasion tags',
    occasionTagsAr: 'Occasion tags in Arabic',
    styleTags: 'Style tags',
    styleTagsAr: 'Style tags in Arabic',
    categoryOptions: { evening: 'Evening', formal: 'Formal', casual: 'Casual', other: 'Other' },
    selectColor: 'Select color',
    selectSleeveType: 'Select sleeve type',
    selectLength: 'Select length',
    selectFabric: 'Select fabric',
    selectFit: 'Select fit',
  },
  ar: {
    adminAccess: 'وصول المشرف',
    pageTitle: 'لوحة Glowmia',
    pageDescription: 'إدارة الكتالوج المباشر من خلال محرر مركّز وحقول ثنائية اللغة ورفع مباشر للصور.',
    addDesign: 'إضافة تصميم',
    signOut: 'تسجيل الخروج',
    currentDesigns: 'التصاميم الحالية',
    currentDesignsDescription: 'افتحي أي بطاقة لتعديلها في لوحة جانبية مركزة مع بقاء المعرض ظاهرًا في الخلفية.',
    designCount: (count: number) => `${count} تصميم`,
    noDesigns: 'لا توجد تصاميم في الكتالوج حتى الآن.',
    addFirstDesign: 'إضافة أول تصميم',
    edit: 'تعديل',
    remove: 'حذف',
    newBadge: 'جديد',
    currentlyEditing: 'التصميم الجاري تعديله',
    editingLiveDesign: 'تعديل تصميم مباشر',
    publishingNewDesign: 'نشر تصميم جديد',
    editDesign: 'تعديل التصميم',
    addDesignTitle: 'إضافة تصميم',
    close: 'إغلاق',
    editorEditDescription: 'حدّثي النصوص والوسوم والصور من مكان واحد ثم ارفعي التغييرات مباشرة إلى Supabase.',
    editorCreateDescription: 'أنشئي تصميمًا جديدًا برفع مباشر للصور أو روابط يدوية ثم انشريه مباشرة في الكتالوج.',
    storyNaming: 'الاسم والوصف',
    storyNamingDescription: 'اجمعي عنوان البطاقة والوصف والنسختين العربية والإنجليزية في مكان واحد.',
    attributesTags: 'الخصائص والوسوم',
    attributesTagsDescription: 'هذه القيم تتحكم في صفحة التصميم العامة والبيانات الوصفية.',
    imagesPreview: 'الصور والمعاينة',
    imagesPreviewDescription: 'ارفعي بدائل مباشرة أو احتفظي بالصور الحالية بترك حقول الرفع كما هي.',
    saveDesign: 'حفظ التصميم',
    updateDesign: 'تحديث التصميم',
    savingDesign: 'جارٍ حفظ التصميم...',
    updatingDesign: 'جارٍ تحديث التصميم...',
    cancel: 'إلغاء',
    adminSetupTitle: 'إعداد صفحة المشرف مطلوب',
    adminSetupDescription: 'أضيفي ADMIN_USERNAME و ADMIN_PASSWORD_HASH و ADMIN_SESSION_SECRET و SUPABASE_SERVICE_ROLE_KEY إلى البيئة المحلية قبل استخدام هذه الصفحة.',
    adminSetupHelper: 'أمر مساعد: npm run admin:secrets -- "your-strong-password"',
    loginTitle: 'تسجيل دخول المشرف',
    loginDescription: 'سجّلي الدخول ببيانات المشرف لإدارة كتالوج التصاميم.',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    adminUsernamePlaceholder: 'اسم مستخدم المشرف',
    passwordPlaceholder: 'كلمة مرور آمنة',
    enterAdmin: 'دخول المشرف',
    signingIn: 'جارٍ تسجيل الدخول...',
    loginFailed: 'فشل تسجيل الدخول.',
    loginUnavailable: 'تعذر تسجيل الدخول الآن.',
    saveError: 'تعذر حفظ هذا التصميم.',
    deleteError: 'تعذر حذف هذا التصميم.',
    saveMessageCreate: 'تم حفظ التصميم في Supabase وأصبح جاهزًا للمعرض العام.',
    saveMessageUpdate: 'تم تحديث التصميم في Supabase وانعكس على الموقع العام.',
    deleteMessage: 'تم حذف التصميم من Supabase.',
    removeConfirm: 'هل تريدين حذف هذا التصميم من Supabase ومن المعرض العام؟',
    imagesRequired: 'أضيفي صورة الغلاف أو الأمام عبر الرفع أو الرابط قبل الحفظ.',
    coverUpload: 'رفع صورة الغلاف/الأمام',
    sideUpload: 'رفع صورة الجانب',
    backUpload: 'رفع صورة الخلف',
    coverUrl: 'رابط صورة الغلاف/الأمام',
    sideUrl: 'رابط صورة الجانب',
    backUrl: 'رابط صورة الخلف',
    keepingCurrentCover: 'سيتم الاحتفاظ بصورة الغلاف الحالية ما لم ترفعي بديلًا.',
    keepingCurrentSide: 'سيتم الاحتفاظ بصورة الجانب الحالية ما لم ترفعي بديلًا.',
    keepingCurrentBack: 'سيتم الاحتفاظ بصورة الخلف الحالية ما لم ترفعي بديلًا.',
    selectedFile: (name: string) => `تم اختيار: ${name}`,
    coverPreview: 'ستظهر معاينة الغلاف/الأمام هنا.',
    sidePreview: 'ستظهر معاينة الجانب هنا.',
    backPreview: 'ستظهر معاينة الخلف هنا.',
    designName: 'اسم التصميم',
    designNameAr: 'اسم التصميم بالعربية',
    description: 'الوصف',
    descriptionAr: 'الوصف بالعربية',
    category: 'الفئة',
    color: 'اللون',
    sleeveType: 'نوع الكم',
    length: 'الطول',
    fabric: 'الخامة',
    fit: 'القصة',
    occasionTags: 'وسوم المناسبة',
    occasionTagsAr: 'وسوم المناسبة بالعربية',
    styleTags: 'وسوم الأسلوب',
    styleTagsAr: 'وسوم الأسلوب بالعربية',
    categoryOptions: { evening: 'مسائي', formal: 'رسمي', casual: 'كاجوال', other: 'أخرى' },
    selectColor: 'اختاري اللون',
    selectSleeveType: 'اختاري نوع الكم',
    selectLength: 'اختاري الطول',
    selectFabric: 'اختاري الخامة',
    selectFit: 'اختاري القصة',
  },
} as const;

const dropdownOptions = {
  color: [
    { value: 'burgundy', en: 'Burgundy', ar: 'خمري' },
    { value: 'black', en: 'Black', ar: 'أسود' },
    { value: 'white', en: 'White', ar: 'أبيض' },
    { value: 'red', en: 'Red', ar: 'أحمر' },
    { value: 'navy', en: 'Navy', ar: 'كحلي' },
    { value: 'gold', en: 'Gold', ar: 'ذهبي' },
    { value: 'silver', en: 'Silver', ar: 'فضي' },
    { value: 'blush', en: 'Blush', ar: 'وردي فاتح' },
    { value: 'champagne', en: 'Champagne', ar: 'شمباني' },
    { value: 'emerald', en: 'Emerald', ar: 'زمردي' },
  ],
  sleeveType: [
    { value: 'sleeveless', en: 'Sleeveless', ar: 'بدون أكمام' },
    { value: 'short sleeve', en: 'Short sleeve', ar: 'كم قصير' },
    { value: 'long sleeve', en: 'Long sleeve', ar: 'كم طويل' },
    { value: 'off shoulder', en: 'Off shoulder', ar: 'أكتاف مكشوفة' },
    { value: 'cap sleeve', en: 'Cap sleeve', ar: 'كم قصير ناعم' },
    { value: 'flutter sleeve', en: 'Flutter sleeve', ar: 'كم متموج' },
    { value: 'bell sleeve', en: 'Bell sleeve', ar: 'كم جرس' },
    { value: 'kimono sleeve', en: 'Kimono sleeve', ar: 'كم كيمونو' },
  ],
  length: [
    { value: 'mini', en: 'Mini', ar: 'قصير جدًا' },
    { value: 'knee-length', en: 'Knee-length', ar: 'حتى الركبة' },
    { value: 'midi', en: 'Midi', ar: 'متوسط' },
    { value: 'maxi', en: 'Maxi', ar: 'طويل' },
    { value: 'floor-length', en: 'Floor-length', ar: 'حتى الأرض' },
    { value: 'asymmetrical', en: 'Asymmetrical', ar: 'غير متماثل' },
  ],
  fabric: [
    { value: 'silk', en: 'Silk', ar: 'حرير' },
    { value: 'satin', en: 'Satin', ar: 'ساتان' },
    { value: 'chiffon', en: 'Chiffon', ar: 'شيفون' },
    { value: 'tulle', en: 'Tulle', ar: 'تول' },
    { value: 'lace', en: 'Lace', ar: 'دانتيل' },
    { value: 'cotton', en: 'Cotton', ar: 'قطن' },
    { value: 'blend', en: 'Blend', ar: 'خليط' },
    { value: 'velvet', en: 'Velvet', ar: 'مخمل' },
    { value: 'crepe', en: 'Crepe', ar: 'كريب' },
    { value: 'organza', en: 'Organza', ar: 'أورجانزا' },
  ],
  fit: [
    { value: 'fitted', en: 'Fitted', ar: 'محدد' },
    { value: 'slim', en: 'Slim', ar: 'ناعم' },
    { value: 'relaxed', en: 'Relaxed', ar: 'مريح' },
    { value: 'loose', en: 'Loose', ar: 'واسع' },
    { value: 'bodycon', en: 'Bodycon', ar: 'ضيق جدًا' },
    { value: 'A-line', en: 'A-line', ar: 'شكل A' },
    { value: 'ballgown', en: 'Ballgown', ar: 'فستان منفوش' },
    { value: 'wrap', en: 'Wrap', ar: 'ملتف' },
  ],
} satisfies Record<string, OptionItem[]>;

function localized(language: Language, value: { en: string; ar: string }) {
  return value[language] || value.en || value.ar;
}

function optionLabel(language: Language, option: OptionItem) {
  return option[language];
}

function autoTranslate(text: string, from: Language, to: Language): string {
  if (!text) return '';

  for (const options of Object.values(dropdownOptions)) {
    const match = options.find((option) => option[from].toLowerCase() === text.toLowerCase() || option.value.toLowerCase() === text.toLowerCase());
    if (match) {
      return match[to];
    }
  }

  return text;
}

function getDesignViewImages(design: Design) {
  const images = Array.from(new Set(design.galleryImages.filter((image) => image && image !== design.coverImage)));
  const sideImage = images.find((image) => image.includes('/admin-uploads/side/')) ?? images[0] ?? '';
  const backImage = images.find((image) => image.includes('/admin-uploads/back/')) ?? images.find((image) => image !== sideImage) ?? '';

  return [sideImage, backImage];
}

function designToFormState(design: Design): AdminFormState {
  const viewImages = getDesignViewImages(design);

  return {
    name: design.name.en,
    nameAr: design.name.ar === design.name.en ? '' : design.name.ar,
    description: design.description.en,
    descriptionAr: design.description.ar === design.description.en ? '' : design.description.ar,
    category: design.category,
    occasion: design.occasion.en,
    occasionAr: design.occasion.ar === design.occasion.en ? '' : design.occasion.ar,
    color: design.color.en,
    colorAr: design.color.ar === design.color.en ? '' : design.color.ar,
    sleeveType: design.sleeveType.en,
    sleeveTypeAr: design.sleeveType.ar === design.sleeveType.en ? '' : design.sleeveType.ar,
    length: design.length.en,
    lengthAr: design.length.ar === design.length.en ? '' : design.length.ar,
    style: design.style.en,
    styleAr: design.style.ar === design.style.en ? '' : design.style.ar,
    fabric: design.fabric.en,
    fabricAr: design.fabric.ar === design.fabric.en ? '' : design.fabric.ar,
    fit: design.fit.en,
    fitAr: design.fit.ar === design.fit.en ? '' : design.fit.ar,
    coverImageUrl: design.coverImage,
    sideImageUrl: viewImages[0] ?? '',
    backImageUrl: viewImages[1] ?? '',
  };
}

function Field({
  label,
  children,
  span = false,
}: {
  label: string;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={`space-y-2 ${span ? 'md:col-span-2' : ''}`}>
      <span className="text-sm text-[color:var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async ({ req }) => {
  const configured = isAdminConfigured();
  const authenticated = Boolean(getAdminUsernameFromRequest(req));

  if (!configured || !authenticated) {
    return { props: { configured, authenticated: false, designs: [] } };
  }

  return {
    props: {
      configured,
      authenticated: true,
      designs: await getAllDesignsFromSupabase(),
    },
  };
};

export default function AtelierVaultPage({
  configured,
  authenticated,
  designs,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const { darkMode, language, toggleLanguage } = useSitePreferencesContext();
  const ui = adminCopy[language];
  const insightsUi =
    language === 'ar'
      ? {
          catalogTab: 'التصاميم',
          insightsTab: 'الرؤى',
          ordersTab: 'طلبات الشراء',
          refresh: 'تحديث',
          insightsTitle: 'رؤى Glowmia',
          insightsDescription: 'شاهدي التفاعل على التصاميم وآراء الزوار وتقييمات الوكيل في مكان واحد.',
          totalLikes: 'إجمالي الإعجابات',
          designFeedback: 'آراء التصاميم',
          agentFeedback: 'آراء الوكيل',
          savedOrders: 'الطلبات المحفوظة',
          averageAgent: 'متوسط تقييم الوكيل',
          averageDesign: 'متوسط تقييم التصاميم',
          topLikedDesigns: 'أكثر التصاميم إعجابًا',
          latestDesignFeedback: 'أحدث آراء التصاميم',
          latestAgentFeedback: 'تقييمات Glowmia Stylist',
          savedOrdersTitle: 'طلبات التصاميم المحفوظة',
          noLikedDesigns: 'لا توجد إعجابات مسجلة حتى الآن.',
          noDesignFeedback: 'لا توجد آراء على التصاميم حتى الآن.',
          noAgentFeedback: 'لا توجد تقييمات للوكيل حتى الآن.',
          noSavedOrders: 'لا توجد طلبات محفوظة حتى الآن.',
          likesCount: (count: number) => `${count} إعجاب`,
          anonymous: 'زائر',
          unknownDesign: 'تصميم غير معروف',
          emptyInsights: 'لا توجد بيانات تفاعل بعد.',
          customerName: 'الاسم',
          customerPhone: 'الهاتف',
          customerAddress: 'العنوان',
          customerCity: 'المدينة',
          orderNotes: 'الملاحظات',
          orderStatus: 'الحالة',
          viewDesign: 'عرض التصميم',
          checkoutOrdersTitle: 'طلبات الشراء',
          checkoutOrdersDescription: 'راجعي طلبات صفحة الدفع مع بيانات العميل والفساتين المختارة.',
          noCheckoutOrders: 'لا توجد طلبات شراء بعد.',
          orderReference: 'رقم الطلب',
          size: 'المقاس',
          quantity: 'الكمية',
          dressId: 'رقم التصميم',
          color: 'اللون',
        }
      : {
          catalogTab: 'Catalog',
          insightsTab: 'Insights',
          ordersTab: 'Orders',
          refresh: 'Refresh',
          insightsTitle: 'Glowmia insights',
          insightsDescription: 'See design engagement, visitor comments, and agent ratings in one place.',
          totalLikes: 'Total likes',
          designFeedback: 'Design feedback',
          agentFeedback: 'Agent feedback',
          savedOrders: 'Saved orders',
          averageAgent: 'Avg. agent rating',
          averageDesign: 'Avg. design rating',
          topLikedDesigns: 'Most liked designs',
          latestDesignFeedback: 'Latest design feedback',
          latestAgentFeedback: 'Glowmia Stylist ratings',
          savedOrdersTitle: 'Saved design orders',
          noLikedDesigns: 'No design likes recorded yet.',
          noDesignFeedback: 'No design feedback yet.',
          noAgentFeedback: 'No agent ratings yet.',
          noSavedOrders: 'No saved design orders yet.',
          likesCount: (count: number) => `${count} like${count === 1 ? '' : 's'}`,
          anonymous: 'Visitor',
          unknownDesign: 'Unknown design',
          emptyInsights: 'No engagement data yet.',
          customerName: 'Name',
          customerPhone: 'Phone',
          customerAddress: 'Address',
          customerCity: 'City',
          orderNotes: 'Notes',
          orderStatus: 'Status',
          viewDesign: 'View design',
          checkoutOrdersTitle: 'Checkout orders',
          checkoutOrdersDescription: 'Review checkout-page orders with buyer credentials and selected dresses.',
          noCheckoutOrders: 'No checkout orders yet.',
          orderReference: 'Order reference',
          size: 'Size',
          quantity: 'Qty',
          dressId: 'Design ID',
          color: 'Color',
        };

  const [catalogDesigns, setCatalogDesigns] = useState(designs);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [formState, setFormState] = useState<AdminFormState>(initialAdminForm);
  const [saveState, setSaveState] = useState<'idle' | 'saving'>('idle');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [panelMessage, setPanelMessage] = useState('');
  const [panelError, setPanelError] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>('catalog');
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [checkoutOrders, setCheckoutOrders] = useState<CheckoutOrderEntry[] | null>(null);
  const [checkoutOrdersLoading, setCheckoutOrdersLoading] = useState(false);
  const [checkoutOrdersError, setCheckoutOrdersError] = useState('');
  const [orderPreview, setOrderPreview] = useState<{ src: string; alt: string } | null>(null);

  const editorOpen = editorMode !== null;
  const editingDesign = useMemo(() => catalogDesigns.find((design) => design.id === editingDesignId) ?? null, [catalogDesigns, editingDesignId]);
  const designMap = useMemo(() => new Map(catalogDesigns.map((design) => [design.id, design])), [catalogDesigns]);

  useEffect(() => {
    setCatalogDesigns(designs);
  }, [designs]);

  useEffect(() => {
    if (!editorOpen && !orderPreview) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = original;
    };
  }, [editorOpen, orderPreview]);

  useEffect(() => {
    if (editorOpen) {
      setMobileAdminMenuOpen(false);
    }
  }, [editorOpen]);

  const resetEditor = () => {
    setEditorMode(null);
    setEditingDesignId(null);
    setFormState(initialAdminForm);
    setCoverFile(null);
    setSideFile(null);
    setBackFile(null);
  };

  const openCreateEditor = () => {
    setPanelError('');
    setPanelMessage('');
    resetEditor();
    setEditorMode('create');
  };

  const openEditEditor = (design: Design) => {
    setPanelError('');
    setPanelMessage('');
    setEditorMode('edit');
    setEditingDesignId(design.id);
    setFormState(designToFormState(design));
    setCoverFile(null);
    setSideFile(null);
    setBackFile(null);
  };

  const uploadAdminImage = async (file: File, kind: 'front' | 'side' | 'back', dressId: string) => {
    const uploadForm = new FormData();
    uploadForm.append('kind', kind);
    uploadForm.append('dressId', dressId);
    uploadForm.append('file', file);

    const response = await fetch('/api/admin/uploads', { method: 'POST', body: uploadForm });
    const payload = (await response.json()) as { error?: string; path?: string; publicUrl?: string };

    if (!response.ok || !payload.publicUrl || !payload.path) {
      throw new Error(payload.error ?? `Unable to upload the ${kind} image.`);
    }

    return { path: payload.path, publicUrl: payload.publicUrl };
  };

  const cleanupUploadedImages = async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    try {
      await fetch('/api/admin/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
    } catch (error) {
      console.error('Unable to clean up uploaded dress images after a failed save:', error);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setLoginError(payload.error ?? ui.loginFailed);
        return;
      }

      await router.replace(router.asPath);
    } catch {
      setLoginError(ui.loginUnavailable);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    await router.replace(router.asPath);
  };

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError('');

    try {
      setInsights(await fetchAdminInsights());
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : 'Unable to load insights.');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadCheckoutOrders = useCallback(async () => {
    setCheckoutOrdersLoading(true);
    setCheckoutOrdersError('');

    try {
      setCheckoutOrders(await fetchAdminCheckoutOrders());
    } catch (error) {
      setCheckoutOrdersError(error instanceof Error ? error.message : 'Unable to load checkout orders.');
    } finally {
      setCheckoutOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated || !configured || activeView !== 'insights' || insightsLoading || insights) {
      return;
    }

    void loadInsights();
  }, [activeView, authenticated, configured, insights, insightsLoading, loadInsights]);

  useEffect(() => {
    if (!authenticated || !configured || activeView !== 'orders' || checkoutOrdersLoading || checkoutOrders) {
      return;
    }

    void loadCheckoutOrders();
  }, [activeView, authenticated, checkoutOrders, checkoutOrdersLoading, configured, loadCheckoutOrders]);

  const scrollToDesigns = () => {
    setActiveView('catalog');
    setMobileAdminMenuOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('admin-designs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const handleSubmitDesign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState('saving');
    setPanelError('');
    setPanelMessage('');
    const uploadedImagePaths: string[] = [];

    try {
      const isEditing = editorMode === 'edit' && Boolean(editingDesignId);
      const targetDressId = isEditing ? editingDesignId as string : crypto.randomUUID();
      const uploadViewImage = async (file: File, kind: 'front' | 'side' | 'back') => {
        const uploaded = await uploadAdminImage(file, kind, targetDressId);
        uploadedImagePaths.push(uploaded.path);
        return uploaded.publicUrl;
      };
      const coverImageUrl = coverFile ? await uploadViewImage(coverFile, 'front') : formState.coverImageUrl.trim();
      const sideImageUrl = sideFile ? await uploadViewImage(sideFile, 'side') : formState.sideImageUrl.trim();
      const backImageUrl = backFile ? await uploadViewImage(backFile, 'back') : formState.backImageUrl.trim();

      if (!coverImageUrl) {
        await cleanupUploadedImages(uploadedImagePaths);
        setPanelError(ui.imagesRequired);
        return;
      }

      const response = await fetch(isEditing ? `/api/admin/designs/${editingDesignId}` : '/api/admin/designs', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          id: isEditing ? undefined : targetDressId,
          coverImageUrl,
          imageUrl: coverImageUrl,
          frontViewUrl: coverImageUrl,
          sideViewUrl: sideImageUrl,
          backViewUrl: backImageUrl,
          occasion: splitCsv(formState.occasion),
          occasionAr: splitCsv(formState.occasionAr),
          style: splitCsv(formState.style),
          styleAr: splitCsv(formState.styleAr),
        }),
      });

      const payload = (await response.json()) as { error?: string; design?: Design | null };

      if (!response.ok) {
        await cleanupUploadedImages(uploadedImagePaths);
        setPanelError(payload.error ?? ui.saveError);
        return;
      }

      const normalizedDesign = payload.design ?? null;
      if (normalizedDesign) {
        setCatalogDesigns((current) =>
          isEditing
            ? current.map((design) => (design.id === normalizedDesign.id ? normalizedDesign : design))
            : [normalizedDesign, ...current],
        );
      }

      resetEditor();
      setPanelMessage(isEditing ? ui.saveMessageUpdate : ui.saveMessageCreate);
    } catch (error) {
      await cleanupUploadedImages(uploadedImagePaths);
      setPanelError(error instanceof Error ? error.message : ui.saveError);
    } finally {
      setSaveState('idle');
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!window.confirm(ui.removeConfirm)) {
      return;
    }

    setDeleteId(designId);
    setPanelError('');
    setPanelMessage('');

    try {
      const response = await fetch(`/api/admin/designs/${designId}`, { method: 'DELETE' });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setPanelError(payload.error ?? ui.deleteError);
        return;
      }

      if (editingDesignId === designId) {
        resetEditor();
      }

      setCatalogDesigns((current) => current.filter((design) => design.id !== designId));
      setPanelMessage(ui.deleteMessage);
    } catch {
      setPanelError(ui.deleteError);
    } finally {
      setDeleteId(null);
    }
  };

  const renderSelect = (
    key: keyof typeof dropdownOptions,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="field-input">
      <option value="">{placeholder}</option>
      {dropdownOptions[key].map((option) => (
        <option key={option.value} value={option.value}>
          {optionLabel(language, option)}
        </option>
      ))}
    </select>
  );

  const formatAdminDate = (value: string) =>
    new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const insightsView = (
    <section className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="font-display text-3xl text-[color:var(--text-primary)] sm:text-4xl md:text-5xl">{insightsUi.insightsTitle}</h2>
          <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] md:text-base md:leading-8">{insightsUi.insightsDescription}</p>
        </div>
        <button type="button" onClick={() => void loadInsights()} className="secondary-button" disabled={insightsLoading}>
          {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {insightsUi.refresh}
        </button>
      </div>

      {insightsError ? <div className="rounded-[1.5rem] border border-[#b2555d]/20 bg-[#b2555d]/10 px-4 py-4 text-sm text-[#b2555d]">{insightsError}</div> : null}

      {!insights && !insightsLoading ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
          {insightsUi.emptyInsights}
        </div>
      ) : null}

      {insightsLoading && !insights ? (
        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {insightsUi.refresh}
          </span>
        </div>
      ) : null}

      {insights ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {[
              { label: insightsUi.totalLikes, value: insights.totals.totalLikes },
              { label: insightsUi.designFeedback, value: insights.totals.designFeedbackCount },
              { label: insightsUi.agentFeedback, value: insights.totals.agentFeedbackCount },
              { label: insightsUi.savedOrders, value: insights.totals.savedDesignOrdersCount },
              { label: insightsUi.averageDesign, value: insights.totals.averageDesignRating > 0 ? insights.totals.averageDesignRating.toFixed(1) : '0.0' },
              { label: insightsUi.averageAgent, value: insights.totals.averageAgentRating > 0 ? insights.totals.averageAgentRating.toFixed(1) : '0.0' },
            ].map((item) => (
              <article key={item.label} className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <Heart className="h-5 w-5 text-[color:var(--accent)]" />
                <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{insightsUi.topLikedDesigns}</h3>
              </div>

              <div className="grid gap-3">
                {insights.designLikes.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)]">{insightsUi.noLikedDesigns}</p>
                ) : (
                  insights.designLikes.map((entry) => {
                    const design = designMap.get(entry.designId);
                    const designName = design ? localized(language, design.name) : insightsUi.unknownDesign;
                    const designImage = design?.coverImage ?? '/glowmia-logo.svg';

                    return (
                      <article key={entry.designId} className="grid gap-3 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 sm:grid-cols-[5.25rem_minmax(0,1fr)_auto] sm:items-center">
                        <div className="overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface-base)]">
                          <img src={designImage} alt={designName} className="h-24 w-full object-cover object-top sm:h-20" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-semibold text-[color:var(--text-primary)]">{designName}</h4>
                          <p className="text-sm text-[color:var(--text-muted)]">{entry.updatedAt ? formatAdminDate(entry.updatedAt) : '—'}</p>
                        </div>
                        <div className="rounded-full border border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--text-primary)]">{insightsUi.likesCount(entry.count)}</div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <Star className="h-5 w-5 text-[color:var(--accent)]" />
                <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{insightsUi.latestAgentFeedback}</h3>
              </div>

              <div className="grid gap-3">
                {insights.agentFeedback.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)]">{insightsUi.noAgentFeedback}</p>
                ) : (
                  insights.agentFeedback.slice(0, 8).map((entry) => (
                    <article key={entry.id} className="rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 text-[color:var(--accent)]">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star key={`${entry.id}-rating-${index + 1}`} className={`h-4 w-4 ${index < entry.rating ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{formatAdminDate(entry.createdAt)}</span>
                      </div>
                      {entry.message ? <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">{entry.message}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] md:p-5">
              <h3 className="mb-4 text-xl font-semibold text-[color:var(--text-primary)]">{insightsUi.latestDesignFeedback}</h3>
              <div className="grid gap-3">
                {insights.designFeedback.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)]">{insightsUi.noDesignFeedback}</p>
                ) : (
                  insights.designFeedback.slice(0, 10).map((entry) => {
                    const design = designMap.get(entry.designId);
                    const designName = design ? localized(language, design.name) : insightsUi.unknownDesign;

                    return (
                      <article key={entry.id} className="rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-[color:var(--text-primary)]">{entry.author || insightsUi.anonymous}</p>
                            <p className="text-sm text-[color:var(--text-muted)]">{designName}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[color:var(--accent)]">
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star key={`${entry.id}-design-rating-${index + 1}`} className={`h-4 w-4 ${index < entry.rating ? 'fill-current' : ''}`} />
                            ))}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">{entry.message}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{formatAdminDate(entry.createdAt)}</p>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] md:p-5">
              <h3 className="mb-4 text-xl font-semibold text-[color:var(--text-primary)]">{insightsUi.savedOrdersTitle}</h3>
              <div className="grid gap-3">
                {insights.savedDesignOrders.length === 0 ? (
                  <p className="text-sm text-[color:var(--text-muted)]">{insightsUi.noSavedOrders}</p>
                ) : (
                  insights.savedDesignOrders.slice(0, 12).map((entry) => (
                    <article key={entry.id} className="grid gap-3 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 sm:grid-cols-[5.25rem_minmax(0,1fr)]">
                      <button
                        type="button"
                        onClick={() => setOrderPreview({ src: entry.editedImageUrl, alt: entry.dressName })}
                        className="overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface-base)] transition hover:scale-[1.01] hover:border-[color:var(--accent)]"
                        aria-label={insightsUi.viewDesign}
                        title={insightsUi.viewDesign}
                      >
                        <img src={entry.editedImageUrl} alt={entry.dressName} className="h-24 w-full object-cover object-top sm:h-full" />
                      </button>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-[color:var(--text-primary)]">{entry.dressName}</h4>
                            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{formatAdminDate(entry.createdAt)}</p>
                          </div>
                        </div>

                        <div className="grid gap-1 text-sm text-[color:var(--text-muted)]">
                          <p>
                            <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerName}:</span>{' '}
                            {entry.customerName}
                          </p>
                          <p>
                            <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerPhone}:</span>{' '}
                            {entry.customerPhone}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );

  const checkoutOrdersView = (
    <section className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="font-display text-3xl text-[color:var(--text-primary)] sm:text-4xl md:text-5xl">{insightsUi.checkoutOrdersTitle}</h2>
          <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] md:text-base md:leading-8">{insightsUi.checkoutOrdersDescription}</p>
        </div>
        <button type="button" onClick={() => void loadCheckoutOrders()} className="secondary-button" disabled={checkoutOrdersLoading}>
          {checkoutOrdersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {insightsUi.refresh}
        </button>
      </div>

      {checkoutOrdersError ? <div className="rounded-[1.5rem] border border-[#b2555d]/20 bg-[#b2555d]/10 px-4 py-4 text-sm text-[#b2555d]">{checkoutOrdersError}</div> : null}

      {!checkoutOrders && !checkoutOrdersLoading ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
          {insightsUi.noCheckoutOrders}
        </div>
      ) : null}

      {checkoutOrdersLoading && !checkoutOrders ? (
        <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {insightsUi.refresh}
          </span>
        </div>
      ) : null}

      {checkoutOrders ? (
        checkoutOrders.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-10 text-center text-sm text-[color:var(--text-muted)]">
            {insightsUi.noCheckoutOrders}
          </div>
        ) : (
          <div className="grid gap-4">
            {checkoutOrders.map((order) => (
              <article key={order.id} className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] md:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{formatAdminDate(order.createdAt)}</p>
                      <h3 className="mt-2 break-all text-xl font-semibold text-[color:var(--text-primary)]">{order.id}</h3>
                    </div>

                    <div className="grid gap-2 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 text-sm text-[color:var(--text-muted)]">
                      <p>
                        <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerName}:</span>{' '}
                        {order.customer.name}
                      </p>
                      <p>
                        <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerPhone}:</span>{' '}
                        {order.customer.phone}
                      </p>
                      <p>
                        <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerAddress}:</span>{' '}
                        {order.customer.address}
                      </p>
                      <p>
                        <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.customerCity}:</span>{' '}
                        {order.customer.city}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">
                        {insightsUi.orderStatus}: {order.status}
                      </span>
                    </div>
                    {order.notes ? (
                      <div className="grid gap-2 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 text-sm text-[color:var(--text-muted)]">
                        <p>
                          <span className="font-medium text-[color:var(--text-primary)]">{insightsUi.orderNotes}:</span>{' '}
                          {order.notes}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {order.items.map((item) => (
                      <article key={`${order.id}-${item.designId}-${item.size ?? 'custom'}`} className="grid gap-3 rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                        <button
                          type="button"
                          onClick={() => setOrderPreview({ src: item.imageUrl, alt: item.designName })}
                          className="overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface-base)] transition hover:scale-[1.01] hover:border-[color:var(--accent)]"
                          aria-label={insightsUi.viewDesign}
                          title={insightsUi.viewDesign}
                        >
                          <img src={item.imageUrl} alt={item.designName} className="h-28 w-full object-cover object-top sm:h-full" />
                        </button>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-[color:var(--text-primary)]">{item.designName}</h4>
                              <p className="break-all text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                                {insightsUi.dressId}: {item.designId}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {item.size ? (
                              <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-base)] px-3 py-1 text-xs text-[color:var(--text-muted)]">
                                {insightsUi.size}: {item.size}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-base)] px-3 py-1 text-xs text-[color:var(--text-muted)]">
                              {insightsUi.quantity}: {item.quantity}
                            </span>
                            {item.color ? (
                              <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-base)] px-3 py-1 text-xs text-[color:var(--text-muted)]">
                                {insightsUi.color}: {item.color}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </section>
  );

  const renderAuthless = !configured ? (
    <section className="rounded-[2rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-8">
      <h2 className="font-display text-3xl text-[color:var(--text-primary)]">{ui.adminSetupTitle}</h2>
      <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--text-muted)]">{ui.adminSetupDescription}</p>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">{ui.adminSetupHelper}</p>
    </section>
  ) : (
    <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <form onSubmit={handleLogin} className="grid gap-5">
        <div className="space-y-2">
          <h2 className="font-display text-4xl text-[color:var(--text-primary)]">{ui.loginTitle}</h2>
          <p className="text-base leading-8 text-[color:var(--text-muted)]">{ui.loginDescription}</p>
        </div>
        <Field label={ui.username}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="field-input" placeholder={ui.adminUsernamePlaceholder} />
        </Field>
        <Field label={ui.password}>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="field-input" placeholder={ui.passwordPlaceholder} />
        </Field>
        {loginError ? <p className="text-sm text-[#b2555d]">{loginError}</p> : null}
        <button type="submit" disabled={loginLoading} className="primary-button w-full">
          {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loginLoading ? ui.signingIn : ui.enterAdmin}
        </button>
      </form>
    </section>
  );

  return (
    <>
      <Head>
        <title>{ui.pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={`site-theme ${darkMode ? 'theme-dark' : 'theme-light'} ${language === 'ar' ? 'lang-ar' : ''}`}>
        <div className="site-background" />
        <main className="site-shell min-h-screen px-3 py-4 pb-24 sm:px-5 md:px-10 md:py-8 md:pb-8">
          <div className="mx-auto grid w-full max-w-7xl gap-4 md:gap-8">
            <section className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--surface)]/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl md:rounded-[2rem] md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                  <span className="eyebrow-chip">
                    <Shield className="h-4 w-4" />
                    {ui.adminAccess}
                  </span>
                  <div className="space-y-2">
                    <h1 className="font-display text-4xl text-[color:var(--text-primary)] sm:text-5xl md:text-6xl">{ui.pageTitle}</h1>
                    <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base md:text-lg md:leading-8">{ui.pageDescription}</p>
                  </div>
                </div>

                {authenticated ? (
                  <div className="hidden flex-wrap gap-3 md:flex">
                    <button type="button" onClick={toggleLanguage} className="secondary-button">
                      {language === 'en' ? 'العربية' : 'English'}
                    </button>
                    <button type="button" onClick={openCreateEditor} className="primary-button">
                      <Plus className="h-4 w-4" />
                      {ui.addDesign}
                    </button>
                    <button type="button" onClick={handleLogout} className="secondary-button">
                      <LogOut className="h-4 w-4" />
                      {ui.signOut}
                    </button>
                  </div>
                ) : null}
              </div>

              {authenticated ? (
                <div className="mt-4 flex items-center gap-3 md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileAdminMenuOpen((current) => !current)}
                    className="secondary-button min-h-[2.9rem] px-4"
                    aria-label={mobileAdminMenuOpen ? ui.close : ui.adminAccess}
                  >
                    {mobileAdminMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </button>
                </div>
              ) : null}

              <AnimatePresence>
                {authenticated && mobileAdminMenuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="mt-4 grid gap-2 rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-2 shadow-[var(--shadow-soft)] md:hidden"
                  >
                    <button type="button" onClick={toggleLanguage} className="secondary-button w-full justify-center">
                      {language === 'en' ? 'العربية' : 'English'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAdminMenuOpen(false);
                        scrollToDesigns();
                      }}
                      className="secondary-button w-full justify-center"
                    >
                      {insightsUi.catalogTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAdminMenuOpen(false);
                        setActiveView('insights');
                        if (!insightsLoading) {
                          void loadInsights();
                        }
                      }}
                      className="secondary-button w-full justify-center"
                    >
                      {insightsUi.insightsTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAdminMenuOpen(false);
                        setActiveView('orders');
                        if (!checkoutOrdersLoading) {
                          void loadCheckoutOrders();
                        }
                      }}
                      className="secondary-button w-full justify-center"
                    >
                      {insightsUi.ordersTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAdminMenuOpen(false);
                        openCreateEditor();
                      }}
                      className="primary-button w-full justify-center"
                    >
                      <Plus className="h-4 w-4" />
                      {ui.addDesign}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAdminMenuOpen(false);
                        if (activeView === 'orders') {
                          void loadCheckoutOrders();
                        } else {
                          void loadInsights();
                        }
                      }}
                      className="secondary-button w-full justify-center"
                      disabled={activeView === 'orders' ? checkoutOrdersLoading : insightsLoading}
                    >
                      {(activeView === 'orders' ? checkoutOrdersLoading : insightsLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {insightsUi.refresh}
                    </button>
                    <button type="button" onClick={handleLogout} className="secondary-button w-full justify-center">
                      <LogOut className="h-4 w-4" />
                      {ui.signOut}
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {authenticated ? (
                <div className="mt-4 hidden flex-wrap gap-2 md:flex">
                  <button
                    type="button"
                    onClick={() => setActiveView('catalog')}
                    className={activeView === 'catalog' ? 'primary-button' : 'secondary-button'}
                  >
                    {insightsUi.catalogTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('insights');
                      if (!insightsLoading) {
                        void loadInsights();
                      }
                    }}
                    className={activeView === 'insights' ? 'primary-button' : 'secondary-button'}
                  >
                    {insightsUi.insightsTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('orders');
                      if (!checkoutOrdersLoading) {
                        void loadCheckoutOrders();
                      }
                    }}
                    className={activeView === 'orders' ? 'primary-button' : 'secondary-button'}
                  >
                    {insightsUi.ordersTab}
                  </button>
                </div>
              ) : null}
            </section>

            {!authenticated || !configured ? (
              renderAuthless
            ) : (
              <>
                {panelError ? <div className="rounded-[1.5rem] border border-[#b2555d]/20 bg-[#b2555d]/10 px-4 py-4 text-sm text-[#b2555d]">{panelError}</div> : null}
                {panelMessage ? <div className="rounded-[1.5rem] border border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)] px-4 py-4 text-sm text-[color:var(--text-primary)]">{panelMessage}</div> : null}

                {activeView === 'catalog' ? (
                  <section id="admin-designs" className="space-y-4 md:space-y-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-2">
                        <h2 className="font-display text-3xl text-[color:var(--text-primary)] sm:text-4xl md:text-5xl">{ui.currentDesigns}</h2>
                        <p className="max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] md:text-base md:leading-8">{ui.currentDesignsDescription}</p>
                      </div>
                      <div className="w-fit rounded-full border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm text-[color:var(--text-muted)]">
                        {ui.designCount(catalogDesigns.length)}
                      </div>
                    </div>

                    {catalogDesigns.length === 0 ? (
                      <div className="rounded-[2rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-12 text-center">
                        <p className="text-base leading-7 text-[color:var(--text-muted)]">{ui.noDesigns}</p>
                        <button type="button" onClick={openCreateEditor} className="primary-button mt-6">
                          <Plus className="h-4 w-4" />
                          {ui.addFirstDesign}
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:gap-5 xl:grid-cols-2">
                        {catalogDesigns.map((design) => (
                          <article
                            key={design.id}
                            className={`overflow-hidden rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] shadow-[var(--shadow-soft)] transition md:rounded-[1.8rem] ${editingDesignId === design.id && editorOpen ? 'ring-1 ring-[color:var(--accent)]' : ''}`}
                          >
                            <div className="grid gap-4 p-4 sm:grid-cols-[10rem_minmax(0,1fr)] md:gap-5 md:p-5">
                              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 sm:grid-cols-1 sm:gap-3">
                                <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]">
                                  <img src={design.coverImage} alt={localized(language, design.name)} className="h-44 w-full object-cover object-top sm:h-52" />
                                </div>
                                {design.detailImage ? (
                                  <div className="overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface)]">
                                    <img
                                      src={design.detailImage}
                                      alt={`${localized(language, design.name)} detail`}
                                      className="h-44 w-full object-contain object-top bg-[color:var(--surface-base)] sm:h-28"
                                    />
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex min-w-0 flex-col justify-between gap-4 md:gap-5">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">{localized(language, design.categoryLabel)}</span>
                                    {design.isNew ? <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">{ui.newBadge}</span> : null}
                                  </div>
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] md:text-2xl">{localized(language, design.name)}</h3>
                                    <p className="text-sm text-[color:var(--text-muted)]">{localized(language, design.subtitle)}</p>
                                    <p className="line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">{localized(language, design.description)}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {localized(language, design.occasion).split(', ').filter(Boolean).map((tag) => (
                                      <span key={`${design.id}-${tag}`} className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--text-muted)]">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                                  <button type="button" onClick={() => openEditEditor(design)} className="primary-button w-full justify-center sm:w-auto">
                                    <Pencil className="h-4 w-4" />
                                    {ui.edit}
                                  </button>
                                  <button type="button" onClick={() => handleDeleteDesign(design.id)} className="secondary-button w-full justify-center sm:w-auto" disabled={deleteId === design.id}>
                                    {deleteId === design.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    {ui.remove}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ) : activeView === 'insights' ? (
                  insightsView
                ) : (
                  checkoutOrdersView
                )}
              </>
            )}
          </div>
        </main>

        <AnimatePresence>
          {configured && authenticated && orderPreview ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60]">
              <button
                type="button"
                onClick={() => setOrderPreview(null)}
                className="absolute inset-0 bg-[rgba(16,10,9,0.72)] backdrop-blur-[2px]"
                aria-label={ui.close}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute inset-3 flex items-center justify-center md:inset-8"
              >
                <div className="relative flex max-h-full w-full max-w-5xl items-center justify-center rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--surface-base)] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-5">
                  <button
                    type="button"
                    onClick={() => setOrderPreview(null)}
                    className="secondary-button absolute right-3 top-3 z-10 min-h-[2.5rem] px-3 md:right-5 md:top-5"
                  >
                    <X className="h-4 w-4" />
                    {ui.close}
                  </button>

                  <img src={orderPreview.src} alt={orderPreview.alt} className="max-h-[85vh] w-auto max-w-full rounded-[1.2rem] object-contain" />
                </div>
              </motion.div>
            </motion.div>
          ) : null}

          {configured && authenticated && editorOpen ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
              <button type="button" onClick={resetEditor} className="absolute inset-0 bg-[rgba(16,10,9,0.48)] backdrop-blur-[2px]" aria-label={ui.close} />

              <motion.aside
                initial={{ x: language === 'ar' ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: language === 'ar' ? '-100%' : '100%' }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                className={`absolute inset-y-0 ${language === 'ar' ? 'left-0' : 'right-0'} w-full max-w-3xl overflow-y-auto bg-[color:var(--surface-base)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]`}
              >
                <div className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--surface-base)]/95 px-4 py-3 backdrop-blur md:px-8 md:py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--text-muted)]">
                        {editorMode === 'edit' ? ui.editingLiveDesign : ui.publishingNewDesign}
                      </p>
                      <h2 className="font-display text-3xl text-[color:var(--text-primary)] md:text-4xl">
                        {editorMode === 'edit' ? ui.editDesign : ui.addDesignTitle}
                      </h2>
                      <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                        {editorMode === 'edit' ? ui.editorEditDescription : ui.editorCreateDescription}
                      </p>
                    </div>

                    <button type="button" onClick={resetEditor} className="secondary-button shrink-0">
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">{ui.close}</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 px-4 py-4 md:gap-8 md:px-8 md:py-6">
                  {editingDesign ? (
                    <section className="grid gap-4 rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 md:grid-cols-[11rem_minmax(0,1fr)] md:rounded-[1.8rem] md:p-5">
                      <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]">
                        <img src={editingDesign.coverImage} alt={localized(language, editingDesign.name)} className="h-56 w-full object-cover object-top" />
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--text-muted)]">{ui.currentlyEditing}</p>
                        <h3 className="text-2xl font-semibold text-[color:var(--text-primary)]">{localized(language, editingDesign.name)}</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">{localized(language, editingDesign.description)}</p>
                      </div>
                    </section>
                  ) : null}

                  <form onSubmit={handleSubmitDesign} className="grid gap-4 md:gap-8">
                    <section className="grid gap-4 rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 md:grid-cols-2 md:rounded-[1.8rem] md:p-5">
                      <div className="space-y-1 md:col-span-2">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{ui.storyNaming}</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">{ui.storyNamingDescription}</p>
                      </div>

                      <Field label={ui.designName} span>
                        <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.designNameAr} span>
                        <input value={formState.nameAr} onChange={(event) => setFormState((current) => ({ ...current, nameAr: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.description} span>
                        <textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} rows={4} className="field-input min-h-[9rem] resize-y" />
                      </Field>
                      <Field label={ui.descriptionAr} span>
                        <textarea value={formState.descriptionAr} onChange={(event) => setFormState((current) => ({ ...current, descriptionAr: event.target.value }))} rows={4} className="field-input min-h-[9rem] resize-y" />
                      </Field>
                    </section>

                    <section className="grid gap-4 rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 md:grid-cols-2 md:rounded-[1.8rem] md:p-5">
                      <div className="space-y-1 md:col-span-2">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{ui.attributesTags}</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">{ui.attributesTagsDescription}</p>
                      </div>

                      <Field label={ui.category}>
                        <select value={formState.category} onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))} className="field-input">
                          {Object.entries(ui.categoryOptions).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={ui.color}>
                        {renderSelect('color', formState.color, (value) => setFormState((current) => ({ ...current, color: value, colorAr: autoTranslate(value, 'en', 'ar') })), ui.selectColor)}
                      </Field>
                      <Field label={ui.sleeveType}>
                        {renderSelect('sleeveType', formState.sleeveType, (value) => setFormState((current) => ({ ...current, sleeveType: value, sleeveTypeAr: autoTranslate(value, 'en', 'ar') })), ui.selectSleeveType)}
                      </Field>
                      <Field label={ui.length}>
                        {renderSelect('length', formState.length, (value) => setFormState((current) => ({ ...current, length: value, lengthAr: autoTranslate(value, 'en', 'ar') })), ui.selectLength)}
                      </Field>
                      <Field label={ui.fabric}>
                        {renderSelect('fabric', formState.fabric, (value) => setFormState((current) => ({ ...current, fabric: value, fabricAr: autoTranslate(value, 'en', 'ar') })), ui.selectFabric)}
                      </Field>
                      <Field label={ui.fit}>
                        {renderSelect('fit', formState.fit, (value) => setFormState((current) => ({ ...current, fit: value, fitAr: autoTranslate(value, 'en', 'ar') })), ui.selectFit)}
                      </Field>
                      <Field label={ui.occasionTags} span>
                        <input value={formState.occasion} onChange={(event) => setFormState((current) => ({ ...current, occasion: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.occasionTagsAr} span>
                        <input value={formState.occasionAr} onChange={(event) => setFormState((current) => ({ ...current, occasionAr: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.styleTags} span>
                        <input value={formState.style} onChange={(event) => setFormState((current) => ({ ...current, style: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.styleTagsAr} span>
                        <input value={formState.styleAr} onChange={(event) => setFormState((current) => ({ ...current, styleAr: event.target.value }))} className="field-input" />
                      </Field>
                    </section>

                    <section className="grid gap-4 rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-4 md:grid-cols-2 md:rounded-[1.8rem] md:p-5">
                      <div className="space-y-1 md:col-span-2">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{ui.imagesPreview}</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">{ui.imagesPreviewDescription}</p>
                      </div>

                      <Field label={ui.coverUpload}>
                        <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:text-[color:var(--text-primary)]" />
                        {coverFile ? <p className="text-xs text-[color:var(--text-muted)]">{ui.selectedFile(coverFile.name)}</p> : null}
                        {!coverFile && formState.coverImageUrl ? <p className="text-xs text-[color:var(--text-muted)]">{ui.keepingCurrentCover}</p> : null}
                      </Field>
                      <Field label={ui.sideUpload}>
                        <input type="file" accept="image/*" onChange={(event) => setSideFile(event.target.files?.[0] ?? null)} className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:text-[color:var(--text-primary)]" />
                        {sideFile ? <p className="text-xs text-[color:var(--text-muted)]">{ui.selectedFile(sideFile.name)}</p> : null}
                        {!sideFile && formState.sideImageUrl ? <p className="text-xs text-[color:var(--text-muted)]">{ui.keepingCurrentSide}</p> : null}
                      </Field>
                      <Field label={ui.backUpload}>
                        <input type="file" accept="image/*" onChange={(event) => setBackFile(event.target.files?.[0] ?? null)} className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:text-[color:var(--text-primary)]" />
                        {backFile ? <p className="text-xs text-[color:var(--text-muted)]">{ui.selectedFile(backFile.name)}</p> : null}
                        {!backFile && formState.backImageUrl ? <p className="text-xs text-[color:var(--text-muted)]">{ui.keepingCurrentBack}</p> : null}
                      </Field>
                      <Field label={ui.coverUrl}>
                        <input value={formState.coverImageUrl} onChange={(event) => setFormState((current) => ({ ...current, coverImageUrl: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.sideUrl}>
                        <input value={formState.sideImageUrl} onChange={(event) => setFormState((current) => ({ ...current, sideImageUrl: event.target.value }))} className="field-input" />
                      </Field>
                      <Field label={ui.backUrl}>
                        <input value={formState.backImageUrl} onChange={(event) => setFormState((current) => ({ ...current, backImageUrl: event.target.value }))} className="field-input" />
                      </Field>

                      <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                        <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-white">
                          {formState.coverImageUrl ? (
                            <img src={formState.coverImageUrl} alt="Cover/front preview" className="aspect-[4/5] w-full object-contain object-center bg-white p-3" />
                          ) : (
                            <div className="grid aspect-[4/5] w-full place-items-center px-6 text-center text-sm text-[color:var(--text-muted)]">{ui.coverPreview}</div>
                          )}
                        </div>
                        <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-white">
                          {formState.sideImageUrl ? (
                            <img
                              src={formState.sideImageUrl}
                              alt="Side view preview"
                              className="aspect-[4/5] w-full object-contain object-center bg-white p-3"
                            />
                          ) : (
                            <div className="grid aspect-[4/5] w-full place-items-center px-6 text-center text-sm text-[color:var(--text-muted)]">{ui.sidePreview}</div>
                          )}
                        </div>
                        <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-white">
                          {formState.backImageUrl ? (
                            <img
                              src={formState.backImageUrl}
                              alt="Back view preview"
                              className="aspect-[4/5] w-full object-contain object-center bg-white p-3"
                            />
                          ) : (
                            <div className="grid aspect-[4/5] w-full place-items-center px-6 text-center text-sm text-[color:var(--text-muted)]">{ui.backPreview}</div>
                          )}
                        </div>
                      </div>
                    </section>

                    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-[color:var(--line)] bg-[color:var(--surface-base)]/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
                      <button type="submit" disabled={saveState === 'saving'} className="primary-button flex-1 justify-center md:flex-none">
                        {saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {saveState === 'saving' ? (editorMode === 'edit' ? ui.updatingDesign : ui.savingDesign) : editorMode === 'edit' ? ui.updateDesign : ui.saveDesign}
                      </button>
                      <button type="button" onClick={resetEditor} className="secondary-button justify-center">
                        <X className="h-4 w-4" />
                        {ui.cancel}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </>
  );
}
