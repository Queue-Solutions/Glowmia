'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Sparkles, ArrowRight, Wand2, Shirt, MessageCircle, Search, Moon, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const designs = [
  {
    id: 1,
    title: 'Blush Motion',
    category: 'Evening Wear',
    season: 'SS26',
    description: 'A flowing silhouette with soft layers inspired by movement, lightness, and contemporary femininity.',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
    tags: ['Elegant', 'Soft Layers', 'Runway'],
  },
  {
    id: 2,
    title: 'Urban Pearl',
    category: 'Street Couture',
    season: 'FW26',
    description: 'A modern statement look balancing minimal tailoring with bold contrast and refined detailing.',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
    tags: ['Tailored', 'Minimal', 'Bold'],
  },
  {
    id: 3,
    title: 'Garden Frame',
    category: 'Editorial',
    season: 'Resort',
    description: 'A playful editorial piece using floral rhythm, texture, and sculpted volume for visual storytelling.',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
    tags: ['Editorial', 'Textured', 'Artistic'],
  },
  {
    id: 4,
    title: 'Ivory Code',
    category: 'Bridal Concept',
    season: 'Capsule',
    description: 'A conceptual bridal study combining clean cuts, subtle ornamentation, and architectural draping.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
    tags: ['Bridal', 'Clean Lines', 'Modern'],
  },
  {
    id: 5,
    title: 'Soft Voltage',
    category: 'Experimental',
    season: 'Studio',
    description: 'An exploration of color balance and futuristic form through layered materials and shape contrast.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
    tags: ['Experimental', 'Color', 'Concept'],
  },
  {
    id: 6,
    title: 'Midnight Fold',
    category: 'Ready-to-Wear',
    season: 'FW26',
    description: 'A refined ready-to-wear piece focused on practical elegance, structure, and effortless styling.',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
    tags: ['Wearable', 'Structured', 'Refined'],
  },
];

const tabs = ['Home', 'Designs', 'Agent'];
const filters = ['All', 'Evening Wear', 'Street Couture', 'Editorial', 'Bridal Concept', 'Experimental', 'Ready-to-Wear'];

export default function FashionStudentPortfolio() {
  const [activeTab, setActiveTab] = useState('Home');
  const [activeFilter, setActiveFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('ar');
  const [darkMode, setDarkMode] = useState(false);

  const translations = {
    en: {
      home: 'Home',
      designs: 'Designs',
      agent: 'Agent',
      mainTitle: 'Glowmia',
      mainHeading: 'Clean, expressive fashion work presented with a smart digital experience.',
      description: 'Explore curated collections, concept pieces, and visual stories from a fashion student portfolio designed to feel soft, modern, and memorable.',
      viewDesigns: 'View Designs',
      aboutDesigner: 'About the Designer',
      selectedWork: 'Selected Work',
      designCollection: 'Design Collection',
      browsePortfolio: 'Browse the portfolio by category and explore each design through a clean visual gallery.',
      searchPlaceholder: 'Search designs, moods, or categories',
      noDesigns: 'No designs found',
      tryAnother: 'Try another keyword or switch the category filter.',
      agentComing: 'Agent page coming later',
      agentDescription: 'This tab is reserved for the AI fashion assistant that will recommend designs and guide users based on their preferences.',
    },
    ar: {
      home: 'الرئيسية',
      designs: 'التصاميم',
      agent: 'الوكيل',
      mainTitle: 'Glowmia',
      mainHeading: 'ملابس عصرية و انيقة تناسب الجميع',
      description: 'استكشف المجموعات المختارة و القطع الانيقة التي تناسب جميع الازواق',
      viewDesigns: 'عرض التصاميم',
      aboutDesigner: 'عن المصمم',
      selectedWork: 'الأعمال المختارة',
      designCollection: 'مجموعة التصاميم',
      browsePortfolio: 'تصفح المحفظة حسب الفئة واستكشف كل تصميم من خلال معرض بصري نظيف.',
      searchPlaceholder: 'ابحث عن التصاميم أو المزاجات أو الفئات',
      noDesigns: 'لم يتم العثور على تصاميم',
      tryAnother: 'جرب كلمة مفتاحية أخرى أو غير مرشح الفئة.',
      agentComing: 'ستأتي صفحة الوكيل لاحقاً',
      agentDescription: 'يتم حجز هذه التبويبة لمساعد الذكاء الاصطناعي للأزياء التي ستوصي بالتصاميم وتوجه المستخدمين بناءً على تفضيلاتهم.',
    }
  };

  const t = translations[language];

  const filteredDesigns = useMemo(() => {
    return designs.filter((design) => {
      const matchesFilter = activeFilter === 'All' || design.category === activeFilter;
      const matchesQuery =
        design.title.toLowerCase().includes(query.toLowerCase()) ||
        design.category.toLowerCase().includes(query.toLowerCase()) ||
        design.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  return (
    <div className={`w-full min-h-screen ${darkMode ? 'bg-[#091413] text-white' : 'bg-[#FCF9EA] text-slate-800'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className={`sticky top-0 z-30 border-b ${darkMode ? 'border-slate-700 bg-[#091413]' : 'border-white/50 bg-[#FCF9EA]'} backdrop-blur-xl`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <img src="/glowmia-logo.svg" alt="Glowmia Logo" className="h-8 w-auto" />
          </div>

          <nav className="hidden items-center gap-2 rounded-full bg-white/80 p-1 shadow-sm md:flex">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab
                    ? darkMode ? 'bg-[#285A48] text-white shadow-sm' : 'bg-[#FF8F8F] text-black shadow-sm'
                    : darkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t[tab.toLowerCase()]}
              </button>
            ))}
          </nav>

          <button 
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className={`rounded-full px-3 py-2 text-sm font-medium shadow-sm ${darkMode ? 'bg-[#285A48] text-white hover:bg-[#1f4434]' : 'bg-white/80 text-slate-900 hover:bg-slate-100'}`}
          >
            {language === 'en' ? 'AR' : 'EN'}
          </button>

          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`rounded-full px-3 py-2 text-sm font-medium shadow-sm ${darkMode ? 'bg-[#285A48] text-yellow-400 hover:bg-[#1f4434]' : 'bg-white/80 text-slate-900 hover:bg-slate-100'}`}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {activeTab === 'Home' && (
          <section className="space-y-10">
            <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <h1 className={`text-5xl font-bold tracking-tight font-playwrite leading-relaxed ${darkMode ? 'bg-gradient-to-r from-purple-500 via-purple-400 to-blue-400 bg-clip-text text-transparent' : 'text-[#FF8F8F]'}`}>Glowmia</h1>
                  <h2 className={`max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl ${darkMode ? 'text-[#B0E4CC]' : 'text-[#FF8F8F]'}`}>
                    {t.mainHeading}
                  </h2>
                  <p className={`max-w-xl text-base leading-7 md:text-lg ${darkMode ? 'text-[#B0E4CC]' : 'text-black'}`}>
                    {t.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setActiveTab('Designs')}
                    className={`rounded-full px-6 py-6 text-sm uppercase tracking-widest font-sans ${darkMode ? 'bg-[#285A48] hover:bg-[#1f4434] text-white' : 'bg-[#FF8F8F] hover:bg-[#FF7A7A] text-black'}`}
                  >
                    {t.viewDesigns} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className={`rounded-full px-6 py-6 text-sm uppercase tracking-widest font-sans ${darkMode ? 'border-[#285A48] bg-transparent text-white hover:bg-[#285A48]' : 'border-[#FF8F8F] bg-white text-black hover:bg-[#FF8F8F] hover:text-white'}`}
                  >
                    {t.aboutDesigner}
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative"
              >
                <div className="rounded-[32px] overflow-hidden shadow-lg">
                  <img
                    src="/burgandy-front-view.png"
                    alt="Burgandy Design Front View"
                    className="w-full h-auto object-cover"
                  />
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {activeTab === 'Designs' && (
          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="rounded-full border-0 bg-violet-100 px-4 py-1 text-violet-700 hover:bg-violet-100">
                  {t.selectedWork}
                </Badge>
                <h2 className={`mt-3 text-3xl font-semibold tracking-tight md:text-5xl ${darkMode ? 'text-[#B0E4CC]' : 'text-[#FF8F8F]'}`}>{t.designCollection}</h2>
                <p className={`mt-2 max-w-2xl ${darkMode ? 'text-[#B0E4CC]' : 'text-[#81A6C6]'}`}>
                  {t.browsePortfolio}
                </p>
              </div>

              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="h-11 rounded-full border-white bg-white pl-10 shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredDesigns.map((design, index) => (
                <motion.div
                  key={design.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                >
                  <Card className="group overflow-hidden rounded-[30px] border-white/70 bg-white/80 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative overflow-hidden">
                      <img
                        src={design.image}
                        alt={design.title}
                        className="h-[340px] w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-4 top-4">
                        <Badge className="rounded-full border-0 bg-white/85 text-slate-700 shadow-sm hover:bg-white/85">
                          {design.season}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-500">{design.category}</p>
                          <h3 className="mt-1 text-xl font-semibold tracking-tight">{design.title}</h3>
                        </div>
                        <button className="rounded-full bg-rose-50 p-2 text-rose-500 transition hover:bg-rose-100">
                          <Heart className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{design.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {design.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredDesigns.length === 0 && (
              <Card className="rounded-[28px] border-white/70 bg-white/80 shadow-sm">
                <CardContent className="p-10 text-center">
                  <h3 className={`text-xl font-semibold tracking-tight ${darkMode ? 'text-[#B0E4CC]' : 'text-slate-800'}`}>{t.noDesigns}</h3>
                  <p className={`mt-2 ${darkMode ? 'text-[#B0E4CC]' : 'text-slate-600'}`}>{t.tryAnother}</p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {activeTab === 'Agent' && (
          <section className="flex min-h-[60vh] items-center justify-center">
            <Card className="w-full max-w-2xl rounded-[32px] border-white/70 bg-white/80 shadow-sm">
              <CardContent className="p-10 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-violet-100">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className={`text-3xl font-semibold tracking-tight ${darkMode ? 'text-[#B0E4CC]' : 'text-slate-800'}`}>{t.agentComing}</h2>
                <p className={`mx-auto mt-3 max-w-lg ${darkMode ? 'text-[#B0E4CC]' : 'text-slate-600'}`}>
                  {t.agentDescription}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
