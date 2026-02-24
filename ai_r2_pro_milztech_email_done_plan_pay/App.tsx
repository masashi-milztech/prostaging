
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClientPlatform } from './components/ClientPlatform';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingPage } from './components/LandingPage';
import { CommercialDisclosure } from './components/CommercialDisclosure';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { PricingPage } from './components/PricingPage';
import { Submission, User, Editor, DEFAULT_PLANS, ArchiveProject, Plan } from './types';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { supabase, db } from './lib/supabase';
import { sendStudioEmail, EMAIL_TEMPLATES } from './lib/email';

const ADMIN_EMAILS = [
  'masashi@milz.tech', 
  'masashi@thisismerci.com'
];

const normalizeEmail = (email: string | undefined | null) => {
  if (!email) return '';
  return email.toLowerCase().trim().replace(/[\s\p{C}]/gu, '');
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [archiveProjects, setArchiveProjects] = useState<ArchiveProject[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>(DEFAULT_PLANS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const initializationId = useRef(0);

  // Simple routing check
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    if (path === '/') {
      window.location.href = '/';
      return;
    }
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const isCommercialDisclosure = currentPath.replace(/\/$/, '') === '/commercial-disclosure';
  const isPrivacyPolicy = currentPath.replace(/\/$/, '') === '/privacy-policy';
  const isTermsOfService = currentPath.replace(/\/$/, '') === '/terms-of-service';
  const isPricing = currentPath.replace(/\/$/, '') === '/pricing';

  const loadPlans = useCallback(async () => {
    try {
      const data = await db.plans.fetchAll() as any[];
      const planMap: Record<string, Plan> = {};
      if (data && data.length > 0) {
        data.forEach(p => { 
          // DBの is_visible (スネークケース) を isVisible (キャメルケース) に変換
          planMap[p.id] = { 
            ...p, 
            isVisible: p.is_visible !== false 
          }; 
        });
        setPlans(planMap);
      } else {
        setPlans({});
      }
    } catch (e) {
      console.warn("[Plans] Load failed (using defaults)");
    }
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      const data = await db.archive.fetchAll() as ArchiveProject[];
      setArchiveProjects(data || []);
    } catch (e) {
      console.warn("[Archive] Load failed (table might be missing)");
    }
  }, []);

  const loadSubmissions = useCallback(async (currentUserId: string, role: string, editorRecordId?: string) => {
    setIsSyncing(true);
    try {
      let subData: Submission[] = [];
      if (role === 'admin') {
        subData = await db.submissions.fetchAll() as Submission[];
      } else if (role === 'editor' && editorRecordId) {
        subData = await db.submissions.fetchByEditor(editorRecordId) as Submission[];
      } else {
        subData = await db.submissions.fetchByUser(currentUserId) as Submission[];
      }
      setSubmissions(subData || []);
    } catch (e) {
      console.error("[Data] Sync Error:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const identifyAndInitialize = async (authSession: any) => {
    const currentId = ++initializationId.current;
    
    // Load public data in background (non-blocking)
    loadArchive();
    loadPlans();

    try {
      if (authSession?.user) {
        const authEmail = normalizeEmail(authSession.user.email);
        let role: 'admin' | 'editor' | 'user' = 'user';
        if (ADMIN_EMAILS.some(e => normalizeEmail(e) === authEmail)) role = 'admin';

        let editorsList: Editor[] = [];
        try {
          editorsList = await db.editors.fetchAll() as Editor[];
          setEditors(editorsList);
        } catch (err) { console.warn("[Auth] Editor list failed", err); }

        if (currentId !== initializationId.current) return;

        const matchedEditor = editorsList.find(e => normalizeEmail(e.email) === authEmail);
        let editorRecordId: string | undefined = undefined;
        if (matchedEditor) {
          editorRecordId = matchedEditor.id;
          if (role !== 'admin') role = 'editor';
        }

        const finalUser: User = { id: authSession.user.id, email: authEmail, role, editorRecordId };
        await loadSubmissions(finalUser.id, finalUser.role, finalUser.editorRecordId);
        if (currentId !== initializationId.current) return;
        setUser(finalUser);
      } else {
        setUser(null);
        setSubmissions([]);
      }
    } catch (err) { 
      console.error("[Auth] Initialization error:", err); 
    } finally {
      if (currentId === initializationId.current) setIsInitializing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => identifyAndInitialize(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
        setIsInitializing(true);
      }
      identifyAndInitialize(session);
    });
    return () => subscription.unsubscribe();
  }, [loadSubmissions, loadArchive, loadPlans]);

  const handleLogout = async () => {
    setIsInitializing(true);
    await supabase.auth.signOut();
    setUser(null);
    setShowAuth(false);
    setSubmissions([]);
    setIsInitializing(false);
  };

  const handleUpdateStatus = async (id: string, updates: Partial<Submission>) => {
    try {
      await db.submissions.update(id, updates);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      
      const isFinalDelivery = updates.status === 'completed' || updates.status === 'reviewing';
      const hasResult = !!(updates.resultAddUrl || updates.resultDataUrl);

      if (isFinalDelivery && hasResult) {
        const { data: freshSub } = await supabase.from('submissions').select('*').eq('id', id).single();
        if (freshSub?.ownerEmail) {
          const planTitle = plans[freshSub.plan]?.title || 'Staging Service';
          const orderDateFormatted = new Date(freshSub.timestamp).toLocaleString();
          await sendStudioEmail(freshSub.ownerEmail, `Results Ready: ${freshSub.id}`, EMAIL_TEMPLATES.DELIVERY_READY({ 
            orderId: freshSub.id, 
            planName: planTitle, 
            date: orderDateFormatted, 
            thumbnail: (updates.resultAddUrl || updates.resultDataUrl || ''), 
            resultUrl: window.location.origin 
          }));
        }
      }
    } catch (err: any) {
      console.error("Database Update Error:", err);
      if (err.code === 'PGRST204') {
        alert(`Database Sync Error. Please check SQL configuration.`);
      } else {
        alert(`Update Failed: ${err.message}`);
      }
    }
  };

  const overlay = React.useMemo(() => {
    if (isCommercialDisclosure) return <CommercialDisclosure onBack={() => navigate('/')} />;
    if (isPrivacyPolicy) return <PrivacyPolicy onBack={() => navigate('/')} />;
    if (isTermsOfService) return <TermsOfServicePage onBack={() => navigate('/')} />;
    if (isPricing) return <PricingPage onBack={() => navigate('/')} plans={plans} />;
    return null;
  }, [currentPath, plans, isCommercialDisclosure, isPrivacyPolicy, isTermsOfService, isPricing]);

  const isInternalMember = user?.role === 'admin' || user?.role === 'editor';

  return (
    <>
      {overlay && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50">
           {overlay}
        </div>
      )}

      {isInitializing ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-[3px] border-slate-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-[3px] border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">Synchronizing Session</p>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Accessing StagingPro Studio</p>
          </div>
        </div>
      ) : !user ? (
        showAuth ? (
          <Login onLogin={() => {}} onBack={() => setShowAuth(false)} />
        ) : (
          <LandingPage onStart={() => setShowAuth(true)} archiveProjects={archiveProjects} plans={plans} />
        )
      ) : (
        <Layout user={user} onLogout={handleLogout} plans={plans}>
          {isInternalMember ? (
            <AdminDashboard 
              user={user} 
              submissions={submissions} 
              archiveProjects={archiveProjects}
              plans={plans}
              onDelete={(id) => db.submissions.delete(id).then(() => setSubmissions(s => s.filter(x => x.id !== id)))}
              onDeliver={(id, updates) => handleUpdateStatus(id, updates)}
              onRefresh={() => { loadSubmissions(user.id, user.role, user.editorRecordId); loadArchive(); loadPlans(); }}
              onAssign={(id, editorId) => handleUpdateStatus(id, { assignedEditorId: editorId || undefined, status: editorId ? 'processing' : 'pending' })}
              onApprove={(id) => handleUpdateStatus(id, { status: 'completed' })}
              onReject={async (id, notes) => handleUpdateStatus(id, { status: 'processing', revisionNotes: notes })}
              isSyncing={isSyncing} 
              editors={editors}
              onAddEditor={async (name, specialty, email) => {
                await db.editors.insert({ id: `ed_${Math.random().toString(36).substr(2, 5)}`, name, email: email?.toLowerCase().trim(), specialty });
                setEditors(await db.editors.fetchAll() as Editor[]);
              }}
              onDeleteEditor={(id) => db.editors.delete(id).then(() => setEditors(e => e.filter(x => x.id !== id)))}
              onUpdateArchive={loadArchive}
              onUpdatePlans={loadPlans}
            />
          ) : (
            <ClientPlatform 
              user={user} 
              plans={plans}
              onSubmission={async (s) => { await db.submissions.insert(s); setSubmissions(prev => [s, ...prev]); }} 
              userSubmissions={submissions} 
            />
          )}
        </Layout>
      )}
    </>
  );
};

export default App;
