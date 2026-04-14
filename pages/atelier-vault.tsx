import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LogOut, Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { getAllDesignsFromSupabase } from '@/src/services/dresses';
import type { Design } from '@/src/data/designs';
import { getAdminUsernameFromRequest, isAdminConfigured } from '@/src/lib/adminAuth';
import { useSitePreferencesContext } from '@/src/context/SitePreferencesContext';

type AdminPageProps = { configured: boolean; authenticated: boolean; designs: Design[] };
type EditorMode = 'create' | 'edit' | null;
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
  imageUrl: string;
};

const initialAdminForm: AdminFormState = {
  name: '', nameAr: '', description: '', descriptionAr: '', category: 'evening', occasion: '', occasionAr: '',
  color: '', colorAr: '', sleeveType: '', sleeveTypeAr: '', length: '', lengthAr: '', style: '', styleAr: '',
  fabric: '', fabricAr: '', fit: '', fitAr: '', coverImageUrl: '', imageUrl: '',
};

const splitCsv = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean);

function designToFormState(design: Design): AdminFormState {
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
    imageUrl: design.detailImage || design.galleryImages[0] || design.coverImage,
  };
}

function Field({
  label, children, span = false,
}: { label: string; children: React.ReactNode; span?: boolean }) {
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
  if (!configured || !authenticated) return { props: { configured, authenticated: false, designs: [] } };
  return { props: { configured, authenticated: true, designs: await getAllDesignsFromSupabase() } };
};

export default function AtelierVaultPage({
  configured, authenticated, designs,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const { darkMode } = useSitePreferencesContext();
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
  const [fullFile, setFullFile] = useState<File | null>(null);

  const editorOpen = editorMode !== null;
  const editingDesign = useMemo(() => catalogDesigns.find((design) => design.id === editingDesignId) ?? null, [catalogDesigns, editingDesignId]);

  useEffect(() => {
    setCatalogDesigns(designs);
  }, [designs]);

  useEffect(() => {
    if (!editorOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [editorOpen]);

  const resetEditor = () => {
    setEditorMode(null);
    setEditingDesignId(null);
    setFormState(initialAdminForm);
    setCoverFile(null);
    setFullFile(null);
  };

  const openCreateEditor = () => { setPanelError(''); setPanelMessage(''); resetEditor(); setEditorMode('create'); };
  const openEditEditor = (design: Design) => {
    setPanelError(''); setPanelMessage(''); setEditorMode('edit'); setEditingDesignId(design.id);
    setFormState(designToFormState(design)); setCoverFile(null); setFullFile(null);
  };

  const uploadAdminImage = async (file: File, kind: 'cover' | 'full') => {
    const uploadForm = new FormData();
    uploadForm.append('kind', kind);
    uploadForm.append('file', file);
    const response = await fetch('/api/admin/uploads', { method: 'POST', body: uploadForm });
    const payload = (await response.json()) as { error?: string; publicUrl?: string };
    if (!response.ok || !payload.publicUrl) throw new Error(payload.error ?? `Unable to upload the ${kind} image.`);
    return payload.publicUrl;
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true); setLoginError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setLoginError(payload.error ?? 'Login failed.'); return; }
      await router.replace(router.asPath);
    } catch { setLoginError('Unable to sign in right now.'); } finally { setLoginLoading(false); }
  };

  const handleLogout = async () => { await fetch('/api/admin/session', { method: 'DELETE' }); await router.replace(router.asPath); };

  const handleSubmitDesign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState('saving'); setPanelError(''); setPanelMessage('');
    try {
      const coverImageUrl = coverFile ? await uploadAdminImage(coverFile, 'cover') : formState.coverImageUrl.trim();
      const imageUrl = fullFile ? await uploadAdminImage(fullFile, 'full') : formState.imageUrl.trim();
      if (!coverImageUrl || !imageUrl) { setPanelError('Add a cover image and a full image by upload or URL before saving.'); return; }
      const isEditing = editorMode === 'edit' && Boolean(editingDesignId);
      const response = await fetch(isEditing ? `/api/admin/designs/${editingDesignId}` : '/api/admin/designs', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState, coverImageUrl, imageUrl,
          occasion: splitCsv(formState.occasion), occasionAr: splitCsv(formState.occasionAr),
          style: splitCsv(formState.style), styleAr: splitCsv(formState.styleAr),
        }),
      });
      const payload = (await response.json()) as { error?: string; design?: Design | null };
      if (!response.ok) { setPanelError(payload.error ?? 'Unable to save this design.'); return; }
      const normalizedDesign = payload.design ?? null;
      if (normalizedDesign) {
        setCatalogDesigns((current) => (
          isEditing
            ? current.map((design) => (design.id === normalizedDesign.id ? normalizedDesign : design))
            : [normalizedDesign, ...current]
        ));
      }
      resetEditor();
      setPanelMessage(isEditing ? 'Design updated in Supabase and reflected on the public website.' : 'Design saved to Supabase and ready for the public gallery.');
    } catch (error) { setPanelError(error instanceof Error ? error.message : 'Unable to save this design right now.'); }
    finally { setSaveState('idle'); }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!window.confirm('Remove this design from Supabase and the public gallery?')) return;
    setDeleteId(designId); setPanelError(''); setPanelMessage('');
    try {
      const response = await fetch(`/api/admin/designs/${designId}`, { method: 'DELETE' });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setPanelError(payload.error ?? 'Unable to remove this design.'); return; }
      if (editingDesignId === designId) resetEditor();
      setCatalogDesigns((current) => current.filter((design) => design.id !== designId));
      setPanelMessage('Design removed from Supabase.');
    } catch { setPanelError('Unable to remove this design right now.'); }
    finally { setDeleteId(null); }
  };

  const renderAuthless = !configured ? (
    <section className="rounded-[2rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-8">
      <h2 className="font-display text-3xl text-[color:var(--text-primary)]">Admin setup needed</h2>
      <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--text-muted)]">
        Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` to your local environment before using this page.
      </p>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">Helper command: `npm run admin:secrets -- "your-strong-password"`</p>
    </section>
  ) : (
    <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <form onSubmit={handleLogin} className="grid gap-5">
        <div className="space-y-2">
          <h2 className="font-display text-4xl text-[color:var(--text-primary)]">Admin sign in</h2>
          <p className="text-base leading-8 text-[color:var(--text-muted)]">This route is intentionally not linked from the public site. Sign in to manage the design catalog.</p>
        </div>
        <Field label="Username"><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="field-input" placeholder="Admin username" /></Field>
        <Field label="Password"><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="field-input" placeholder="Secure password" /></Field>
        {loginError ? <p className="text-sm text-[#b2555d]">{loginError}</p> : null}
        <button type="submit" disabled={loginLoading} className="primary-button w-full">{loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{loginLoading ? 'Signing in...' : 'Enter vault'}</button>
      </form>
    </section>
  );

  return (
    <>
      <Head><title>Glowmia Vault</title><meta name="robots" content="noindex,nofollow" /></Head>
      <div className={`site-theme ${darkMode ? 'theme-dark' : 'theme-light'}`}>
        <div className="site-background" />
        <main className="site-shell min-h-screen px-6 py-8 md:px-10">
          <div className="mx-auto grid w-full max-w-7xl gap-8">
            <section className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--surface)]/95 p-6 shadow-[var(--shadow-soft)] backdrop-blur-xl md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                  <span className="eyebrow-chip"><Shield className="h-4 w-4" />Hidden admin access</span>
                  <div className="space-y-2">
                    <h1 className="font-display text-5xl text-[color:var(--text-primary)] md:text-6xl">Glowmia Vault</h1>
                    <p className="max-w-3xl text-base leading-8 text-[color:var(--text-muted)] md:text-lg">Manage the live catalog with richer cards and a focused slide-over editor instead of a long top-of-page form.</p>
                  </div>
                </div>
                {authenticated ? <div className="flex flex-wrap gap-3"><button type="button" onClick={openCreateEditor} className="primary-button"><Plus className="h-4 w-4" />Add design</button><button type="button" onClick={handleLogout} className="secondary-button"><LogOut className="h-4 w-4" />Sign out</button></div> : null}
              </div>
            </section>

            {!authenticated || !configured ? renderAuthless : (
              <section className="space-y-6">
                {panelError ? <div className="rounded-[1.5rem] border border-[#b2555d]/20 bg-[#b2555d]/10 px-4 py-4 text-sm text-[#b2555d]">{panelError}</div> : null}
                {panelMessage ? <div className="rounded-[1.5rem] border border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)] px-4 py-4 text-sm text-[color:var(--text-primary)]">{panelMessage}</div> : null}

                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <h2 className="font-display text-4xl text-[color:var(--text-primary)] md:text-5xl">Current designs</h2>
                    <p className="max-w-3xl text-base leading-8 text-[color:var(--text-muted)]">Open any card to edit it in a focused side panel while keeping the gallery visible in the background.</p>
                  </div>
                  <div className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm text-[color:var(--text-muted)]">{catalogDesigns.length} design{catalogDesigns.length === 1 ? '' : 's'}</div>
                </div>

                {catalogDesigns.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-12 text-center">
                    <p className="text-base leading-7 text-[color:var(--text-muted)]">No designs are in the catalog yet.</p>
                    <button type="button" onClick={openCreateEditor} className="primary-button mt-6"><Plus className="h-4 w-4" />Add the first design</button>
                  </div>
                ) : (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {catalogDesigns.map((design) => (
                      <article key={design.id} className={`overflow-hidden rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] shadow-[var(--shadow-soft)] transition ${editingDesignId === design.id && editorOpen ? 'ring-1 ring-[color:var(--accent)]' : ''}`}>
                        <div className="grid gap-5 p-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                          <div className="grid gap-3">
                            <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]">
                              <img src={design.coverImage} alt={design.name.en} className="h-52 w-full object-cover object-top" />
                            </div>
                            {design.detailImage ? <div className="overflow-hidden rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--surface)]"><img src={design.detailImage} alt={`${design.name.en} detail`} className="h-24 w-full object-cover object-center" /></div> : null}
                          </div>
                          <div className="flex min-w-0 flex-col justify-between gap-5">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">{design.categoryLabel.en}</span>
                                {design.isNew ? <span className="eyebrow-chip !px-3 !py-2 !text-[0.65rem]">New</span> : null}
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">{design.name.en}</h3>
                                <p className="text-sm text-[color:var(--text-muted)]">{design.subtitle.en}</p>
                                <p className="line-clamp-2 text-sm leading-7 text-[color:var(--text-muted)]">{design.description.en}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {design.occasion.en.split(', ').filter(Boolean).map((tag) => <span key={`${design.id}-${tag}`} className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--text-muted)]">{tag}</span>)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button type="button" onClick={() => openEditEditor(design)} className="primary-button"><Pencil className="h-4 w-4" />Edit</button>
                              <button type="button" onClick={() => handleDeleteDesign(design.id)} className="secondary-button" disabled={deleteId === design.id}>{deleteId === design.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Remove</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>

        <AnimatePresence>
          {configured && authenticated && editorOpen ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
              <button type="button" onClick={resetEditor} className="absolute inset-0 bg-[rgba(16,10,9,0.48)] backdrop-blur-[2px]" aria-label="Close editor" />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l border-[color:var(--line)] bg-[color:var(--surface-base)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
              >
                <div className="sticky top-0 z-[1] border-b border-[color:var(--line)] bg-[color:var(--surface)]/95 px-5 py-4 backdrop-blur-xl md:px-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--text-muted)]">{editorMode === 'edit' ? 'Editing live design' : 'Publishing new design'}</p>
                      <h2 className="font-display text-4xl text-[color:var(--text-primary)]">{editorMode === 'edit' ? 'Edit design' : 'Add a design'}</h2>
                      <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                        {editorMode === 'edit'
                          ? 'Update text, tags, and imagery in one place, then push the changes directly to Supabase.'
                          : 'Create a new design with direct image uploads or manual URLs, then publish it straight into the live catalog.'}
                      </p>
                    </div>
                    <button type="button" onClick={resetEditor} className="secondary-button"><X className="h-4 w-4" />Close</button>
                  </div>
                </div>
                <div className="px-5 py-6 md:px-8 md:py-8">
                  <form onSubmit={handleSubmitDesign} className="grid gap-8">
                    {editingDesign ? (
                      <section className="grid gap-4 rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-5 md:grid-cols-[11rem_minmax(0,1fr)]">
                        <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]"><img src={editingDesign.coverImage} alt={editingDesign.name.en} className="h-56 w-full object-cover object-top" /></div>
                        <div className="space-y-3">
                          <p className="text-sm uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Currently editing</p>
                          <h3 className="text-2xl font-semibold text-[color:var(--text-primary)]">{editingDesign.name.en}</h3>
                          <p className="text-sm leading-7 text-[color:var(--text-muted)]">{editingDesign.description.en}</p>
                          <div className="flex flex-wrap gap-2">{editingDesign.occasion.en.split(', ').filter(Boolean).map((tag) => <span key={`${editingDesign.id}-editing-${tag}`} className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--text-muted)]">{tag}</span>)}</div>
                        </div>
                      </section>
                    ) : null}

                    <section className="grid gap-4 rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-5 md:grid-cols-2">
                      <div className="md:col-span-2 space-y-1">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Story and naming</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">Keep the live card title, description, and bilingual copy together in one place.</p>
                      </div>
                      <Field label="Design name" span><input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="field-input" placeholder="Burgundy Off-Shoulder Evening Dress" /></Field>
                      <Field label="Design name in Arabic" span><input value={formState.nameAr} onChange={(event) => setFormState((current) => ({ ...current, nameAr: event.target.value }))} className="field-input" placeholder="Optional Arabic name" /></Field>
                      <Field label="Description" span><textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} rows={4} className="field-input min-h-[9rem] resize-y" placeholder="Describe the silhouette, mood, and key details." /></Field>
                      <Field label="Description in Arabic" span><textarea value={formState.descriptionAr} onChange={(event) => setFormState((current) => ({ ...current, descriptionAr: event.target.value }))} rows={4} className="field-input min-h-[9rem] resize-y" placeholder="Optional Arabic description" /></Field>
                    </section>

                    <section className="grid gap-4 rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-5 md:grid-cols-2">
                      <div className="md:col-span-2 space-y-1">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Attributes and tags</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">These values shape the public detail page and design metadata.</p>
                      </div>
                      <Field label="Category"><select value={formState.category} onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))} className="field-input"><option value="evening">Evening</option><option value="formal">Formal</option><option value="casual">Casual</option><option value="other">Other</option></select></Field>
                      <Field label="Color"><input value={formState.color} onChange={(event) => setFormState((current) => ({ ...current, color: event.target.value }))} className="field-input" placeholder="burgundy" /></Field>
                      <Field label="Color in Arabic"><input value={formState.colorAr} onChange={(event) => setFormState((current) => ({ ...current, colorAr: event.target.value }))} className="field-input" placeholder="Optional Arabic color" /></Field>
                      <Field label="Sleeve type"><input value={formState.sleeveType} onChange={(event) => setFormState((current) => ({ ...current, sleeveType: event.target.value }))} className="field-input" placeholder="off shoulder" /></Field>
                      <Field label="Sleeve type in Arabic"><input value={formState.sleeveTypeAr} onChange={(event) => setFormState((current) => ({ ...current, sleeveTypeAr: event.target.value }))} className="field-input" placeholder="Optional Arabic sleeve type" /></Field>
                      <Field label="Length"><input value={formState.length} onChange={(event) => setFormState((current) => ({ ...current, length: event.target.value }))} className="field-input" placeholder="maxi" /></Field>
                      <Field label="Length in Arabic"><input value={formState.lengthAr} onChange={(event) => setFormState((current) => ({ ...current, lengthAr: event.target.value }))} className="field-input" placeholder="Optional Arabic length" /></Field>
                      <Field label="Fabric"><input value={formState.fabric} onChange={(event) => setFormState((current) => ({ ...current, fabric: event.target.value }))} className="field-input" placeholder="silk blend" /></Field>
                      <Field label="Fabric in Arabic"><input value={formState.fabricAr} onChange={(event) => setFormState((current) => ({ ...current, fabricAr: event.target.value }))} className="field-input" placeholder="Optional Arabic fabric" /></Field>
                      <Field label="Fit"><input value={formState.fit} onChange={(event) => setFormState((current) => ({ ...current, fit: event.target.value }))} className="field-input" placeholder="slim" /></Field>
                      <Field label="Fit in Arabic"><input value={formState.fitAr} onChange={(event) => setFormState((current) => ({ ...current, fitAr: event.target.value }))} className="field-input" placeholder="Optional Arabic fit" /></Field>
                      <Field label="Occasion tags" span><input value={formState.occasion} onChange={(event) => setFormState((current) => ({ ...current, occasion: event.target.value }))} className="field-input" placeholder="evening, party, reception" /></Field>
                      <Field label="Occasion tags in Arabic" span><input value={formState.occasionAr} onChange={(event) => setFormState((current) => ({ ...current, occasionAr: event.target.value }))} className="field-input" placeholder="Optional Arabic occasion tags" /></Field>
                      <Field label="Style tags" span><input value={formState.style} onChange={(event) => setFormState((current) => ({ ...current, style: event.target.value }))} className="field-input" placeholder="elegant, soft, modern" /></Field>
                      <Field label="Style tags in Arabic" span><input value={formState.styleAr} onChange={(event) => setFormState((current) => ({ ...current, styleAr: event.target.value }))} className="field-input" placeholder="Optional Arabic style tags" /></Field>
                    </section>

                    <section className="grid gap-4 rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--surface-elevated)] p-5 md:grid-cols-2">
                      <div className="md:col-span-2 space-y-1">
                        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Images and preview</h3>
                        <p className="text-sm leading-7 text-[color:var(--text-muted)]">Upload replacements directly or keep the current assets by leaving file inputs untouched.</p>
                      </div>
                      <Field label="Cover image upload"><input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:text-[color:var(--text-primary)]" />{coverFile ? <p className="text-xs text-[color:var(--text-muted)]">Selected: {coverFile.name}</p> : null}{!coverFile && formState.coverImageUrl ? <p className="text-xs text-[color:var(--text-muted)]">Keeping current cover image unless you upload a replacement.</p> : null}</Field>
                      <Field label="Full image upload"><input type="file" accept="image/*" onChange={(event) => setFullFile(event.target.files?.[0] ?? null)} className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:text-[color:var(--text-primary)]" />{fullFile ? <p className="text-xs text-[color:var(--text-muted)]">Selected: {fullFile.name}</p> : null}{!fullFile && formState.imageUrl ? <p className="text-xs text-[color:var(--text-muted)]">Keeping current full image unless you upload a replacement.</p> : null}</Field>
                      <Field label="Cover image URL" span><input value={formState.coverImageUrl} onChange={(event) => setFormState((current) => ({ ...current, coverImageUrl: event.target.value }))} className="field-input" placeholder="Optional if you upload a cover image directly" /></Field>
                      <Field label="Full image URL" span><input value={formState.imageUrl} onChange={(event) => setFormState((current) => ({ ...current, imageUrl: event.target.value }))} className="field-input" placeholder="Optional if you upload a full image directly" /></Field>
                      <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                        <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]">{formState.coverImageUrl ? <img src={formState.coverImageUrl} alt="Cover preview" className="h-64 w-full object-cover object-top" /> : <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-[color:var(--text-muted)]">Cover preview appears here.</div>}</div>
                        <div className="overflow-hidden rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--surface)]">{formState.imageUrl ? <img src={formState.imageUrl} alt="Full preview" className="h-64 w-full object-contain bg-[color:var(--surface-base)]" /> : <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-[color:var(--text-muted)]">Full-image preview appears here.</div>}</div>
                      </div>
                    </section>

                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={saveState === 'saving'} className="primary-button">{saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saveState === 'saving' ? (editorMode === 'edit' ? 'Updating design...' : 'Saving design...') : editorMode === 'edit' ? 'Update design' : 'Save design'}</button>
                      <button type="button" onClick={resetEditor} className="secondary-button"><X className="h-4 w-4" />Cancel</button>
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
