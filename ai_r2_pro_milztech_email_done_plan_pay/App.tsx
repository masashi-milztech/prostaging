
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClientPlatform } from './components/ClientPlatform';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingPage } from './components/LandingPage';
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
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const initializationId = useRef(0);

  const loadPlans = useCallback(async () => {
    try {
      const data = await db.plans.fetchAll() as any[];
      const planMap: Record<string, Plan> = {};
      if (data && data.length > 0) {
        data.forEach(p => { 
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

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('submissions_realtime_main')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'submissions'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSub = payload.new as Submission;
            if (user.role === 'admin' || (user.role === 'user' && newSub.ownerId === user.id)) {
              setSubmissions(prev => {
                if (prev.some(s => s.id === newSub.id)) return prev;
                return [newSub, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedSub = payload.new as Submission;
            setSubmissions(prev => prev.map(s => s.id === updatedSub.id ? { ...s, ...updatedSub } : s));
          } else if (payload.eventType === 'DELETE') {
            setSubmissions(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const identifyAndInitialize = async (authSession: any) => {
    const currentId = ++initializationId.current;
    try {
      await Promise.all([loadArchive(), loadPlans()]);
      
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
    // UIを即座に更新
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    try {
      await db.submissions.update(id, updates);
      
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
      // エラー時は元の状態に戻すか再読み込み
      onRefresh();
    }
  };

  const onRefresh = () => {
    if (user) {
      loadSubmissions(user.id, user.role, user.editorRecordId);
      loadArchive();
      loadPlans();
    }
  };

  if (isInitializing) return (
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
  );

  if (!user) {
    if (showAuth) {
      return <Login onLogin={() => {}} onBack={() => setShowAuth(false)} />;
    }
    return <LandingPage onStart={() => setShowAuth(true)} archiveProjects={archiveProjects} plans={plans} />;
  }

  const isInternalMember = user.role === 'admin' || user.role === 'editor';

  return (
    <Layout user={user} onLogout={handleLogout} plans={plans}>
      <div className="relative">
        {isInternalMember ? (
          <AdminDashboard 
            user={user} 
            submissions={submissions} 
            archiveProjects={archiveProjects}
            plans={plans}
            onDelete={(id) => db.submissions.delete(id)}
            onDeliver={(id, updates) => handleUpdateStatus(id, updates)}
            onRefresh={onRefresh}
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
            onSubmission={async (s) => { await db.submissions.insert(s); }}
            onRefreshSubmissions={() => loadSubmissions(user.id, user.role)}
            userSubmissions={submissions} 
          />
        )}
        
        {/* Realtime Status Indicator */}
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur border border-slate-100 rounded-full shadow-lg pointer-events-none transition-all">
          <div className={`w-2 h-2 rounded-full ${isRealtimeActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            {isRealtimeActive ? 'Live Studio Link' : 'Connecting...'}
          </span>
        </div>
      </div>
    </Layout>
  );
};

export default App;
