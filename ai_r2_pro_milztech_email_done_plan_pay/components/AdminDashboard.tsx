
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Submission, Plan, Editor, User, PlanType, Message, ArchiveProject, getEstimatedDeliveryDate } from '../types';
import { DetailModal } from './DetailModal';
import { ChatBoard } from './ChatBoard';
import { db } from '../lib/supabase';
import { sendStudioEmail, EMAIL_TEMPLATES } from '../lib/email';

interface AdminDashboardProps {
  user: User;
  submissions: Submission[];
  archiveProjects: ArchiveProject[];
  plans: Record<string, Plan>;
  onDelete: (id: string) => void;
  onDeliver: (id: string, updates: Partial<Submission>) => void;
  onRefresh: () => void;
  onAssign: (id: string, editorId: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, notes?: string) => void;
  isSyncing: boolean;
  editors: Editor[];
  onAddEditor: (name: string, specialty: string, email?: string) => void;
  onDeleteEditor: (id: string) => void;
  onUpdateArchive: () => void;
  onUpdatePlans: () => void;
}

type FilterStatus = 'all' | 'pending' | 'processing' | 'reviewing' | 'completed' | 'comments' | 'archive' | 'plans';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, submissions, archiveProjects, plans, onDelete, onDeliver, onRefresh, onAssign, onApprove, onReject, isSyncing, editors, onAddEditor, onDeleteEditor, onUpdateArchive, onUpdatePlans
}) => {
  if (!user) return null;

  const [showOnlyMine, setShowOnlyMine] = useState(user?.role === 'editor');
  const [statusFilter, setStatusFilter] = useState('all' as FilterStatus);
  const [viewingDetail, setViewingDetail] = useState<Submission | null>(null);
  const [chattingSubmission, setChattingSubmission] = useState<Submission | null>(null);
  const [showEditorManager, setShowEditorManager] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});
  const [lastReplaceTime, setLastReplaceTime] = useState<number>(Date.now());
  
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<string>('');
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);

  // States for Plan Management
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<Partial<Plan>>({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true });
  
  // States for Archive Management
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [archiveForm, setArchiveForm] = useState<Partial<ArchiveProject>>({ title: '', category: '', beforeurl: '', afterurl: '', description: '' });

  const [newEditorName, setNewEditorName] = useState('');
  const [newEditorSpecialty, setNewEditorSpecialty] = useState('');
  const [newEditorEmail, setNewEditorEmail] = useState('');

  useEffect(() => {
    loadAllMessages();
    const interval = setInterval(loadAllMessages, 10000);
    return () => clearInterval(interval);
  }, [submissions]);

  const loadAllMessages = async () => {
    try {
      const result = await db.messages.fetchAll();
      const msgs = Array.isArray(result) ? result : [];
      setAllMessages(msgs);
      
      const map: Record<string, number> = {};
      submissions.forEach(s => {
        const val = localStorage.getItem(`chat_last_read_${s.id}`);
        if (val) map[s.id] = parseInt(val);
      });
      setLastReadMap(map);
    } catch (err) { }
  };

  const submissionChatInfo = useMemo(() => {
    const info: Record<string, { count: number, lastMessage?: Message, hasNew: boolean }> = {};
    allMessages.forEach(msg => {
      const sId = msg.submission_id;
      if (!sId) return;
      if (!info[sId]) info[sId] = { count: 0, hasNew: false };
      info[sId].count += 1;
      const lastSeen = lastReadMap[sId] || 0;
      if (!info[sId].lastMessage || msg.timestamp > info[sId].lastMessage.timestamp) info[sId].lastMessage = msg;
      if (msg.sender_role === 'user' && msg.timestamp > lastSeen) info[sId].hasNew = true;
    });
    return info;
  }, [allMessages, lastReadMap]);

  const filteredSubmissions = useMemo(() => {
    let result = submissions.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'quote_pending');
    if (showOnlyMine && user?.editorRecordId) result = result.filter(s => String(s.assignedEditorId) === String(user.editorRecordId));
    if (statusFilter === 'comments') {
      result = result.filter(s => (submissionChatInfo[s.id]?.count || 0) > 0);
      result.sort((a, b) => (submissionChatInfo[b.id]?.lastMessage?.timestamp || 0) - (submissionChatInfo[a.id]?.lastMessage?.timestamp || 0));
    } else if (statusFilter !== 'all' && statusFilter !== 'archive' && statusFilter !== 'plans') {
      result = result.filter(s => s.status === statusFilter);
    }
    return result;
  }, [submissions, statusFilter, user?.editorRecordId, showOnlyMine, submissionChatInfo]);

  const stats = {
    total: submissions.filter(s => s.paymentStatus !== 'unpaid').length,
    pending: submissions.filter(s => s.status === 'pending' && s.paymentStatus !== 'unpaid').length,
    processing: submissions.filter(s => s.status === 'processing' && s.paymentStatus !== 'unpaid').length,
    completed: submissions.filter(s => s.status === 'completed' && s.paymentStatus !== 'unpaid').length,
  };

  const getSafeUrl = (rawUrl: string | undefined | null) => {
    if (!rawUrl) return null;
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}t=${lastReplaceTime}`;
  };

  const handleUpdateQuote = async (id: string) => {
    const amount = parseInt(quoteAmount);
    if (isNaN(amount) || amount <= 0) return;
    setIsUpdatingQuote(true);
    try {
      await db.submissions.update(id, { quotedAmount: amount });
      const sub = submissions.find(s => s.id === id);
      if (sub && sub.ownerEmail) {
        await sendStudioEmail(sub.ownerEmail, `Quote Prepared`, EMAIL_TEMPLATES.QUOTE_READY({
          orderId: id, planName: plans[sub.plan]?.title || '3D Modeling',
          amount: `$ ${(amount/100).toFixed(2)}`, thumbnail: sub.dataUrl, actionUrl: window.location.origin
        }));
      }
      onRefresh(); setEditingQuoteId(null); setQuoteAmount('');
    } catch (err) { alert("Quote update failed"); } finally { setIsUpdatingQuote(false); }
  };

  // Plan Handlers
  const handleSavePlan = async () => {
    if (!planForm.id || !planForm.title) return;
    try {
      const payload = { ...planForm, is_visible: planForm.isVisible !== false };
      if (editingPlanId) await db.plans.update(editingPlanId, payload);
      else await db.plans.insert(payload);
      onUpdatePlans(); setEditingPlanId(null);
      setPlanForm({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true });
    } catch (err) { alert("Save plan failed"); }
  };

  const togglePlanVisibility = async (p: Plan) => {
    try {
      await db.plans.update(p.id, { is_visible: p.isVisible === false });
      onUpdatePlans();
    } catch (err) { }
  };

  // Archive Handlers
  const handleSaveArchive = async () => {
    if (!archiveForm.title || !archiveForm.afterurl) return;
    try {
      const id = editingArchiveId || `arch_${Date.now()}`;
      await db.archive.insert({ ...archiveForm, id, timestamp: Date.now() });
      onUpdateArchive(); setEditingArchiveId(null);
      setArchiveForm({ title: '', category: '', beforeurl: '', afterurl: '', description: '' });
    } catch (err) { alert("Save archive failed"); }
  };

  const DeliveryDropZone = ({ submission, type }: { submission: Submission, type: 'remove' | 'add' | 'single' }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const label = type === 'remove' ? 'REMOVED' : type === 'add' ? 'STAGED' : 'FINAL';
    const currentUrlRaw = type === 'remove' ? submission.resultRemoveUrl : (type === 'add' ? submission.resultAddUrl : (submission.resultAddUrl || submission.resultDataUrl));
    const currentUrl = getSafeUrl(currentUrlRaw);

    const handleUpload = async (file: File) => {
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const path = `results/${submission.id}_${type}_${Date.now()}.jpg`;
          const publicUrl = await db.storage.upload(path, reader.result as string);
          const updates: Partial<Submission> = {};
          if (type === 'remove') updates.resultRemoveUrl = publicUrl;
          else { updates.resultAddUrl = publicUrl; updates.resultDataUrl = publicUrl; }
          let newStatus = submission.status;
          if (submission.plan === PlanType.FURNITURE_BOTH) {
            const other = type === 'remove' ? !!submission.resultAddUrl : !!submission.resultRemoveUrl;
            newStatus = other ? 'reviewing' : 'processing';
          } else { newStatus = 'reviewing'; }
          updates.status = newStatus;
          await onDeliver(submission.id, updates);
          setLastReplaceTime(Date.now());
          onRefresh();
        } catch (err) { alert("Upload failed"); } finally { setUploading(false); }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleUpload(file); }}
        className={`relative group rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-2 overflow-hidden min-h-[100px] w-full max-w-[120px] ${dragging ? 'border-slate-900 bg-slate-50' : currentUrl ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 bg-white'}`}
      >
        {currentUrl ? (
          <>
            <img src={currentUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" alt="" />
            <div className="relative z-10 text-center">
              <span className="text-[7px] font-black text-emerald-600 tracking-widest block uppercase mb-1">{label}</span>
              <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleUpload(e.target.files[0]); i.click(); }} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase">Replace</button>
            </div>
          </>
        ) : uploading ? ( <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div> ) : (
          <div className="text-center p-2">
            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest block mb-1">DROP {label}</span>
            <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleUpload(e.target.files[0]); i.click(); }} className="text-[7px] font-black text-slate-400 border border-slate-100 rounded-lg px-2 py-1">Browse</button>
          </div>
        )}
      </div>
    );
  };

  const ArchiveImageDropZone = ({ type, url, onUpload }: { type: 'before' | 'after', url?: string, onUpload: (url: string) => void }) => {
    const [uploading, setUploading] = useState(false);
    const handleFile = async (file: File) => {
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const path = `archive/${Date.now()}_${type}.jpg`;
          const publicUrl = await db.storage.upload(path, reader.result as string);
          onUpload(publicUrl);
        } catch (e) { alert("Upload failed"); } finally { setUploading(false); }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className={`relative aspect-video rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group ${url ? 'border-slate-100 bg-white' : 'border-slate-200 bg-slate-50'}`}>
        {url ? (
          <>
            <img src={url} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleFile(e.target.files[0]); i.click(); }} className="px-4 py-2 bg-white text-slate-900 rounded-lg text-[10px] font-black uppercase">Replace Image</button>
            </div>
          </>
        ) : uploading ? ( <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div> ) : (
          <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleFile(e.target.files[0]); i.click(); }} className="text-center p-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select {type}</p>
          </button>
        )}
      </div>
    );
  };

  const getFilterIcon = (filter: FilterStatus) => {
    switch (filter) {
      case 'all': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" /></svg>;
      case 'pending': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'processing': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
      case 'reviewing': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
      case 'completed': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>;
      case 'comments': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>;
      case 'archive': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      case 'plans': return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
      default: return null;
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 md:px-10 space-y-8 text-left">
      {viewingDetail && <DetailModal submission={viewingDetail} plans={plans} onClose={() => setViewingDetail(null)} />}
      {chattingSubmission && <ChatBoard submission={chattingSubmission} user={user} plans={plans} onClose={() => { setChattingSubmission(null); loadAllMessages(); }} />}
      
      {/* Team Manager Modal */}
      {showEditorManager && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b flex justify-between items-center bg-white">
                 <h3 className="text-xl font-black uppercase tracking-tight jakarta text-slate-900">Team Manager</h3>
                 <button onClick={() => setShowEditorManager(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-900 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
                 <div className="bg-slate-50 p-8 rounded-[2rem] space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Member</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <input value={newEditorName} onChange={(e) => setNewEditorName(e.target.value)} placeholder="Name" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none" />
                       <input value={newEditorEmail} onChange={(e) => setNewEditorEmail(e.target.value)} placeholder="Email" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none" />
                       <input value={newEditorSpecialty} onChange={(e) => setNewEditorSpecialty(e.target.value)} placeholder="Specialty" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none" />
                    </div>
                    <button onClick={() => { onAddEditor(newEditorName, newEditorSpecialty, newEditorEmail); setNewEditorName(''); setNewEditorEmail(''); setNewEditorSpecialty(''); }} className="w-full py-5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Authorize Member</button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editors.map(ed => (
                      <div key={ed.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                        <div>
                          <p className="text-xs font-black uppercase text-slate-900">{ed.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{ed.specialty}</p>
                        </div>
                        <button onClick={() => onDeleteEditor(ed.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      <header className="flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase jakarta">Production Hub</h1>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 md:pb-0 w-full md:w-auto">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap shadow-sm">
                {k}: <span className="text-slate-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           {user?.role === 'admin' && <button onClick={() => setShowEditorManager(true)} className="flex-1 md:flex-none px-6 py-2.5 bg-white border-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2">
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" /></svg>
             Team Manager
           </button>}
           <button onClick={onRefresh} className="flex-1 md:flex-none px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center justify-center gap-2">
             <svg className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             Sync
           </button>
        </div>
      </header>

      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button onClick={() => setShowOnlyMine(!showOnlyMine)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showOnlyMine ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
            {user?.role === 'admin' ? 'My Assignments' : 'My Current Queue'}
          </button>
          <div className="w-px h-6 bg-slate-100 mx-1"></div>
          {(['all', 'pending', 'processing', 'reviewing', 'completed', 'comments', 'archive', 'plans'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${statusFilter === s ? 'text-slate-900 bg-slate-50' : 'text-slate-300 hover:text-slate-400'}`}>
               {getFilterIcon(s)}
               {s === 'comments' ? 'Communications' : s === 'archive' ? 'Manage Archive' : s === 'plans' ? 'Manage Plans' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {statusFilter === 'plans' ? (
           <div className="space-y-10 animate-in fade-in">
              <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-8">
                <h3 className="text-xl font-black uppercase jakarta text-slate-900">{editingPlanId ? 'Edit Plan' : 'Add Plan'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <input disabled={!!editingPlanId} value={planForm.id} onChange={e => setPlanForm({...planForm, id: e.target.value})} placeholder="Plan ID (Unique)" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none disabled:opacity-50" />
                  <input value={planForm.title} onChange={e => setPlanForm({...planForm, title: e.target.value})} placeholder="Title" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none" />
                  <input value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} placeholder="Price Display (e.g. $45)" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none" />
                  <input type="number" value={planForm.amount} onChange={e => setPlanForm({...planForm, amount: parseInt(e.target.value)})} placeholder="Stripe Amount (Cents)" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none" />
                  <input value={planForm.number} onChange={e => setPlanForm({...planForm, number: e.target.value})} placeholder="Plan Number (e.g. 01)" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none" />
                  <input value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} placeholder="Description" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none" />
                </div>
                <div className="flex gap-4">
                  <button onClick={handleSavePlan} className="flex-grow py-6 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Save Production Plan</button>
                  {editingPlanId && (
                    <button onClick={() => { setEditingPlanId(null); setPlanForm({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true }); }} className="px-10 py-6 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel Edit</button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.values(plans) as Plan[]).map(p => (
                  <div key={p.id} className={`p-8 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-center group transition-all ${p.isVisible === false ? 'opacity-40' : ''}`}>
                    <div className="space-y-1 text-left">
                       <p className="text-[10px] font-black text-slate-300 uppercase">Plan {p.number}</p>
                       <h4 className="text-lg font-black uppercase text-slate-900">{p.title}</h4>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => togglePlanVisibility(p)} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={p.isVisible === false ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                       </button>
                       <button onClick={() => { setEditingPlanId(p.id); setPlanForm(p); }} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        ) : statusFilter === 'archive' ? (
           <div className="space-y-10 animate-in fade-in">
              <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 space-y-8">
                 <h3 className="text-xl font-black uppercase jakarta text-slate-900">{editingArchiveId ? 'Update Showcase' : 'Add Showcase'}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6 text-left">
                       <input value={archiveForm.title} onChange={e => setArchiveForm({...archiveForm, title: e.target.value})} placeholder="Project Title" className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none bg-white" />
                       <select value={archiveForm.category} onChange={e => setArchiveForm({...archiveForm, category: e.target.value})} className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none bg-white">
                          <option value="">Select Category</option>
                          {(Object.values(plans) as Plan[]).map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                       </select>
                       <textarea value={archiveForm.description} onChange={e => setArchiveForm({...archiveForm, description: e.target.value})} placeholder="Project Context..." className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-200 outline-none min-h-[120px] bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <ArchiveImageDropZone type="before" url={archiveForm.beforeurl} onUpload={url => setArchiveForm({...archiveForm, beforeurl: url})} />
                       <ArchiveImageDropZone type="after" url={archiveForm.afterurl} onUpload={url => setArchiveForm({...archiveForm, afterurl: url})} />
                    </div>
                 </div>
                 <div className="flex gap-4">
                  <button onClick={handleSaveArchive} className="flex-grow py-6 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Publish to Showcase</button>
                  {editingArchiveId && (
                    <button onClick={() => { setEditingArchiveId(null); setArchiveForm({ title: '', category: '', beforeurl: '', afterurl: '', description: '' }); }} className="px-10 py-6 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel Edit</button>
                  )}
                 </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                 {archiveProjects.map(proj => (
                    <div key={proj.id} className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden group">
                       <div className="aspect-[4/3] bg-slate-100 relative">
                          <img src={proj.afterurl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <button onClick={() => { setEditingArchiveId(proj.id); setArchiveForm(proj); }} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                             <button onClick={() => onDelete(proj.id)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                       </div>
                       <div className="p-6 text-left">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{proj.category}</p>
                          <h4 className="text-[12px] font-black uppercase text-slate-900 truncate">{proj.title}</h4>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm overflow-x-auto no-scrollbar animate-in fade-in">
            <table className="w-full text-left border-collapse min-w-[1300px]">
               <thead>
                <tr className="bg-slate-50/50 border-b">
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Visual</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">ID / Plan</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Assignee</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Chat</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Editor Upload</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSubmissions.map(sub => {
                  const dueDate = getEstimatedDeliveryDate(sub.timestamp);
                  const chatInfo = submissionChatInfo[sub.id];
                  const hasNewMessage = chatInfo?.hasNew;
                  const visualUrl = getSafeUrl(sub.dataUrl);
                  const isDone = sub.status === 'completed';
                  const needsQuote = sub.plan === PlanType.FLOOR_PLAN_CG && sub.paymentStatus === 'quote_pending' && !isDone;

                  return (
                    <tr key={sub.id} className={`hover:bg-slate-50/50 transition-all ${hasNewMessage ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-8 py-4 text-center">
                         <button onClick={() => setViewingDetail(sub)} className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 hover:border-slate-900 shadow-sm bg-slate-50 inline-block">
                           <img src={visualUrl || ''} className="w-full h-full object-cover" alt="" />
                         </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>{sub.status}</span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block leading-none">{plans[sub.plan]?.title || sub.plan}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">ID: {sub.id}</span>
                      </td>
                      <td className="px-6 py-4 text-left"> <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg"> {dueDate.toLocaleDateString('ja-JP')} </span> </td>
                      <td className="px-6 py-4">
                         <select value={sub.assignedEditorId || ''} onChange={(e) => onAssign(sub.id, e.target.value)} className="bg-slate-50 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none focus:bg-white transition-all w-full">
                            <option value="">Unassigned</option>
                            {editors.map(ed => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                          </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="relative inline-block">
                            <button 
                              onClick={() => {
                                setChattingSubmission(sub);
                                if (hasNewMessage) {
                                   const ts = chatInfo.lastMessage?.timestamp || Date.now();
                                   localStorage.setItem(`chat_last_read_${sub.id}`, ts.toString());
                                   setLastReadMap(prev => ({ ...prev, [sub.id]: ts }));
                                }
                              }} 
                              className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${hasNewMessage ? 'bg-rose-500 text-white shadow-xl shadow-rose-200 border-rose-400 animate-pulse' : 'bg-slate-900 text-white'}`}
                            >
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                               <span>CHAT {chatInfo?.count > 0 && `(${chatInfo.count})`}</span>
                            </button>
                            {hasNewMessage && <span className="absolute -top-3 -right-3 bg-rose-600 text-white text-[7px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-white tracking-widest z-10">NEW</span>}
                         </div>
                      </td>
                      <td className="px-8 py-4">
                         <div className="flex items-center justify-center gap-2">
                            {sub.plan === PlanType.FURNITURE_BOTH ? ( <> <DeliveryDropZone submission={sub} type="remove" /> <DeliveryDropZone submission={sub} type="add" /> </> ) : <DeliveryDropZone submission={sub} type="single" />}
                         </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <div className="flex flex-col items-end gap-3">
                            {needsQuote && (
                               <div className="flex gap-2">
                                  {editingQuoteId === sub.id ? (
                                     <div className="flex gap-2 animate-in slide-in-from-right-2">
                                        <input type="number" placeholder="Cents" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} className="w-24 px-3 py-2 border rounded-lg text-xs" />
                                        <button onClick={() => handleUpdateQuote(sub.id)} className="px-3 py-2 bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase">Send</button>
                                     </div>
                                  ) : <button onClick={() => setEditingQuoteId(sub.id)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase">Set Quote</button>}
                               </div>
                            )}
                            {isDone ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><span className="text-[9px] font-black uppercase">Completed</span></div>
                            ) : (
                              <div className={`flex items-center gap-2 ${sub.status === 'reviewing' && user.role === 'admin' ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                                 <button onClick={() => onDeliver(sub.id, { status: 'processing' })} className="px-4 py-2 bg-white border border-rose-100 text-rose-500 rounded-xl text-[9px] font-black uppercase">Reject</button>
                                 <button onClick={() => onApprove(sub.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase">Approve</button>
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
