
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
  
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<string>('');
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);
  const [planSchemaError, setPlanSchemaError] = useState<string | null>(null);

  const [newEditorName, setNewEditorName] = useState('');
  const [newEditorSpecialty, setNewEditorSpecialty] = useState('');
  const [newEditorEmail, setNewEditorEmail] = useState('');

  // States for Plan/Archive Management
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<Partial<Plan>>({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true });
  
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [archiveForm, setArchiveForm] = useState<Partial<ArchiveProject>>({ title: '', category: '', beforeurl: '', afterurl: '', description: '' });

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
    } catch (err) { 
      // ネットワークエラーは無視
    }
  };

  const handleUpdateQuote = async (id: string) => {
    const amount = parseInt(quoteAmount);
    if (isNaN(amount) || amount <= 0) return;
    setIsUpdatingQuote(true);
    try {
      await db.submissions.update(id, { quotedAmount: amount });
      const sub = submissions.find(s => s.id === id);
      if (sub && sub.ownerEmail) {
        try {
          await sendStudioEmail(sub.ownerEmail, `Quote Ready: ${id}`, EMAIL_TEMPLATES.QUOTE_READY({
            orderId: id, planName: plans[sub.plan]?.title || '3D Modeling',
            amount: `$ ${(amount/100).toFixed(2)}`, thumbnail: sub.dataUrl, actionUrl: window.location.origin
          }));
        } catch (e) { console.error("Email error:", e); }
      }
      setEditingQuoteId(null); setQuoteAmount(''); onRefresh();
    } catch (err: any) { setPlanSchemaError(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS "quotedAmount" bigint;`); } finally { setIsUpdatingQuote(false); }
  };

  const handleSavePlan = async () => {
    if (!planForm.id || !planForm.title) return;
    try {
      const { isVisible, ...rest } = planForm;
      const payload = { ...rest, is_visible: isVisible !== false };

      if (editingPlanId) await db.plans.update(editingPlanId, payload);
      else await db.plans.insert(payload);
      
      onUpdatePlans(); setEditingPlanId(null); setPlanSchemaError(null);
      setPlanForm({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true });
    } catch (err: any) {
      setPlanSchemaError(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;`);
    }
  };

  const startEditPlan = (p: Plan) => { setEditingPlanId(p.id); setPlanForm(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  
  const handleDeletePlan = async (id: string) => { 
    if (!confirm('Are you sure you want to permanently delete this plan? If it has order history, it cannot be deleted. Use "Hide" instead.')) return;
    try {
      await db.plans.delete(id);
      onUpdatePlans();
    } catch (err: any) {
      alert("Cannot delete plan: This plan is linked to existing order history. Please use the Visibility toggle (Eye Icon) to hide it from clients instead.");
    }
  };

  const togglePlanVisibility = async (p: Plan) => {
    const nextVal = p.isVisible === false ? true : false;
    try {
      await db.plans.update(p.id, { is_visible: nextVal });
      onUpdatePlans();
      setPlanSchemaError(null);
    } catch (err) {
      console.error("Plan visibility error:", err);
      setPlanSchemaError(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;`);
    }
  };

  const handleSaveArchive = async () => {
    if (!archiveForm.title || !archiveForm.afterurl || !archiveForm.category) {
      alert("Title, Category and After Image are required.");
      return;
    }
    const id = editingArchiveId || `arch_${Date.now()}`;
    const payload = { ...archiveForm, id, timestamp: Date.now() };
    if (editingArchiveId) await db.archive.delete(editingArchiveId); 
    await db.archive.insert(payload);
    onUpdateArchive(); setEditingArchiveId(null);
    setArchiveForm({ title: '', category: '', beforeurl: '', afterurl: '', description: '' });
  };

  const startEditArchive = (proj: ArchiveProject) => { setEditingArchiveId(proj.id); setArchiveForm(proj); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDeleteArchive = async (id: string) => { if (confirm('Delete archive?')) { await db.archive.delete(id); onUpdateArchive(); } };

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

  const handleAddEditor = () => {
    if (!newEditorName || !newEditorSpecialty) return;
    onAddEditor(newEditorName, newEditorSpecialty, newEditorEmail);
    setNewEditorName(''); setNewEditorSpecialty(''); setNewEditorEmail('');
  };

  const DeliveryDropZone = ({ submission, type }: { submission: Submission, type: 'remove' | 'add' | 'single' }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const label = type === 'remove' ? 'REMOVED' : type === 'add' ? 'STAGED' : 'FINAL RESULT';
    const currentUrl = type === 'remove' ? submission.resultRemoveUrl : (type === 'add' ? submission.resultAddUrl : (submission.resultAddUrl || submission.resultDataUrl));
    const handleUpload = async (file: File) => {
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const publicUrl = await db.storage.upload(`results/${submission.id}_${type}.jpg`, reader.result as string);
          const updates: Partial<Submission> = {};
          if (type === 'remove') updates.resultRemoveUrl = publicUrl;
          else { updates.resultAddUrl = publicUrl; updates.resultDataUrl = publicUrl; }
          let newStatus = submission.status;
          if (submission.plan === PlanType.FURNITURE_BOTH) {
            if ((type === 'remove' || submission.resultRemoveUrl) && (type === 'add' || submission.resultAddUrl)) newStatus = 'reviewing';
          } else { newStatus = 'reviewing'; }
          updates.status = newStatus; onDeliver(submission.id, updates);
        } finally { setUploading(false); }
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
            <img src={currentUrl} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity" alt="" />
            <div className="relative z-10 text-center">
              <span className="text-[7px] font-black text-emerald-600 tracking-widest block uppercase mb-1">{label}</span>
              <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }; input.click(); }} className="text-[8px] font-black text-slate-900 uppercase underline">Replace</button>
            </div>
          </>
        ) : uploading ? ( <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div> ) : (
          <div className="text-center p-2">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">DROP {label}</span>
            <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }; input.click(); }} className="text-[7px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 rounded-lg px-2 py-1">Browse</button>
          </div>
        )}
      </div>
    );
  };

  const ArchiveImageDropZone = ({ type, url, onUpload }: { type: 'before' | 'after', url?: string, onUpload: (url: string) => void }) => {
    const [dragging, setDragging] = useState(false);
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
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file); }}
        className={`relative aspect-video rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden group ${dragging ? 'border-slate-900 bg-slate-50' : url ? 'border-slate-100 bg-white' : 'border-slate-200 bg-slate-50/50'}`}
      >
        {url ? (
          <>
            <img src={url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
               <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Current {type}</span>
               <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleFile(e.target.files[0]); i.click(); }} className="px-6 py-2 bg-white text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest">Replace Image</button>
            </div>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Uploading Media...</span>
          </div>
        ) : (
          <div className="text-center p-10">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-300 group-hover:text-slate-900 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Drop {type} Image</p>
            <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e: any) => handleFile(e.target.files[0]); i.click(); }} className="mt-4 text-[8px] font-bold text-slate-400 uppercase tracking-widest underline underline-offset-4">or browse files</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 md:px-10 space-y-8">
      {viewingDetail && <DetailModal submission={viewingDetail} plans={plans} onClose={() => setViewingDetail(null)} />}
      {chattingSubmission && <ChatBoard submission={chattingSubmission} user={user} plans={plans} onClose={() => { setChattingSubmission(null); loadAllMessages(); }} />}
      
      {showEditorManager && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 border-b flex justify-between items-center bg-white">
                 <div className="space-y-1">
                   <h3 className="text-2xl font-black uppercase tracking-tight jakarta text-slate-900">Studio Team Manager</h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Add or manage architectural visualizers</p>
                 </div>
                 <button onClick={() => setShowEditorManager(false)} className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-900 hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
                 <div className="bg-slate-50 p-8 rounded-[2rem] space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Visualizer</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <input value={newEditorName} onChange={(e) => setNewEditorName(e.target.value)} placeholder="Name" className="px-6 py-4 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-slate-900 border border-slate-100" />
                       <input value={newEditorEmail} onChange={(e) => setNewEditorEmail(e.target.value)} placeholder="Email" className="px-6 py-4 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-slate-900 border border-slate-100" />
                       <input value={newEditorSpecialty} onChange={(e) => setNewEditorSpecialty(e.target.value)} placeholder="Specialty" className="px-6 py-4 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-slate-900 border border-slate-100" />
                    </div>
                    <button onClick={handleAddEditor} className="w-full py-5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Authorize Member</button>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editors.map(ed => (
                      <div key={ed.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-slate-900 transition-all">
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-slate-900">{ed.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{ed.specialty} • {ed.email}</p>
                        </div>
                        <button onClick={() => onDeleteEditor(ed.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
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
           {user?.role === 'admin' && <button onClick={() => setShowEditorManager(true)} className="flex-1 md:flex-none px-6 py-2.5 bg-white border-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-900 hover:text-white transition-all">Team Manager</button>}
           <button onClick={onRefresh} className="flex-1 md:flex-none px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full">Sync</button>
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
               {s === 'archive' ? 'Manage Archive' : s === 'plans' ? 'Manage Plans' : (s === 'comments' ? 'Communications' : s)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {statusFilter === 'plans' ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
             {planSchemaError && (
               <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[2.5rem] space-y-4 animate-in shake duration-500">
                 <div className="flex items-center gap-4 text-amber-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <h4 className="text-sm font-black uppercase tracking-widest">Database Schema Sync Required</h4>
                 </div>
                 <p className="text-[10px] font-medium text-amber-600 leading-relaxed italic">The 'isVisible' feature requires a database update. Please run the following SQL in your Supabase SQL Editor:</p>
                 <div className="bg-slate-900 p-4 rounded-xl">
                   <code className="text-[9px] font-mono text-emerald-400 block">ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;</code>
                 </div>
                 <button onClick={() => setPlanSchemaError(null)} className="text-[9px] font-black text-amber-700 uppercase tracking-widest underline">Dismiss warning</button>
               </div>
             )}

             <div className={`${editingPlanId ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'} p-10 rounded-[3rem] border space-y-8 transition-all`}>
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase tracking-tight jakarta">{editingPlanId ? 'Update Production Plan' : 'Register New Production Plan'}</h3>
                  {editingPlanId && <button onClick={() => {setEditingPlanId(null); setPlanForm({ id: '', title: '', price: '$', amount: 0, description: '', number: '', isVisible: true });}} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline">Cancel Editing</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <input disabled={!!editingPlanId} value={planForm.id} onChange={e => setPlanForm({...planForm, id: e.target.value})} placeholder="Plan ID" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900 disabled:opacity-50" />
                   <input value={planForm.title} onChange={e => setPlanForm({...planForm, title: e.target.value})} placeholder="Title" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                   <input value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} placeholder="Price (e.g. $45)" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                   <input type="number" value={planForm.amount} onChange={e => setPlanForm({...planForm, amount: parseInt(e.target.value)})} placeholder="Amount in Cents" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                   <input value={planForm.number} onChange={e => setPlanForm({...planForm, number: e.target.value})} placeholder="Plan No." className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                   <input value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} placeholder="Description" className="px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                </div>
                <button onClick={handleSavePlan} className={`w-full py-6 ${editingPlanId ? 'bg-indigo-600' : 'bg-slate-900'} text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] transition-all`}>{editingPlanId ? 'Update Existing Plan' : 'Publish Production Plan'}</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.values(plans) as any[]).map(p => (
                   <div key={p.id} className={`p-8 bg-white border rounded-[2.5rem] flex justify-between items-center group transition-all ${p.isVisible === false ? 'opacity-40 border-slate-100 grayscale' : 'border-slate-100 hover:border-slate-900'}`}>
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Plan {p.number}</p>
                           {p.isVisible === false && <span className="bg-rose-50 text-rose-500 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">Hidden</span>}
                         </div>
                         <h4 className="text-lg font-black uppercase text-slate-900">{p.title}</h4>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => togglePlanVisibility(p)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${p.isVisible === false ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white'}`} title={p.isVisible === false ? "Show in Landing" : "Hide from Landing"}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {p.isVisible === false ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              )}
                            </svg>
                         </button>
                         <button onClick={() => startEditPlan(p)} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                         <button onClick={() => handleDeletePlan(p.id)} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ) : statusFilter === 'archive' ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
             <div className={`${editingArchiveId ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'} p-10 rounded-[3rem] border space-y-8 transition-all`}>
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black uppercase tracking-tight jakarta">{editingArchiveId ? 'Edit Showcase Item' : 'Publish to Showcase Archive'}</h3>
                  {editingArchiveId && <button onClick={() => {setEditingArchiveId(null); setArchiveForm({ title: '', category: '', beforeurl: '', afterurl: '', description: '' });}} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Cancel Editing</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6 md:col-span-1">
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-2">Project Title</label>
                         <input value={archiveForm.title} onChange={e => setArchiveForm({...archiveForm, title: e.target.value})} placeholder="e.g. Luxury Apartment 3D" className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-2">Category (Plan Selection)</label>
                         <select 
                            value={archiveForm.category} 
                            onChange={e => setArchiveForm({...archiveForm, category: e.target.value})} 
                            className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900 bg-white"
                         >
                            <option value="">Select Service Category</option>
                            {(Object.values(plans) as any[]).map(plan => (
                              <option key={plan.id} value={plan.title}>{plan.title}</option>
                            ))}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-2">Description</label>
                         <textarea value={archiveForm.description} onChange={e => setArchiveForm({...archiveForm, description: e.target.value})} placeholder="Project summary..." className="w-full px-6 py-4 rounded-xl text-xs font-medium border border-slate-100 outline-none focus:ring-2 ring-slate-900 min-h-[120px] resize-none" />
                      </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:col-span-1">
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-2">Before Image (Source)</label>
                         <ArchiveImageDropZone type="before" url={archiveForm.beforeurl} onUpload={(url) => setArchiveForm({...archiveForm, beforeurl: url})} />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest px-2">After Image (Production)</label>
                         <ArchiveImageDropZone type="after" url={archiveForm.afterurl} onUpload={(url) => setArchiveForm({...archiveForm, afterurl: url})} />
                      </div>
                   </div>
                </div>
                <button onClick={handleSaveArchive} className={`w-full py-6 ${editingArchiveId ? 'bg-emerald-600' : 'bg-slate-900'} text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] transition-all`}>
                  {editingArchiveId ? 'Update Gallery Item' : 'Add to Global Showcase'}
                </button>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {archiveProjects.map(proj => (
                   <div key={proj.id} className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden group relative hover:border-slate-900 transition-all hover:shadow-2xl">
                      <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                         <img src={proj.afterurl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button onClick={() => startEditArchive(proj)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-xl hover:scale-110 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={() => handleDeleteArchive(proj.id)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-xl hover:scale-110 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                         </div>
                      </div>
                      <div className="p-6">
                         <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{proj.category}</p>
                         <h4 className="text-xs font-black uppercase text-slate-900">{proj.title}</h4>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1300px]">
               <thead>
                <tr className="bg-slate-50/50 border-b">
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Visual</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">ID / Plan</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Assignee</th>
                  <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Communication</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Editor Upload</th>
                  <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Final Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSubmissions.map(sub => {
                  const dueDate = getEstimatedDeliveryDate(sub.timestamp);
                  const isDone = sub.status === 'completed';
                  const quotePending = sub.plan === PlanType.FLOOR_PLAN_CG && sub.paymentStatus === 'quote_pending' && !isDone;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-4 text-center">
                         <button onClick={() => setViewingDetail(sub)} className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 hover:border-slate-900 shadow-sm bg-slate-50 inline-block"><img src={sub.dataUrl} className="w-full h-full object-cover" alt="" /></button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${sub.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : sub.status === 'reviewing' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{sub.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block leading-none">{plans[sub.plan]?.title || sub.plan}</span>
                        <div className="flex items-center gap-2 mt-1"> <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">ID: {sub.id}</span> </div>
                      </td>
                      <td className="px-6 py-4"> <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg"> {dueDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase()} </span> </td>
                      <td className="px-6 py-4">
                         <select value={sub.assignedEditorId || ''} onChange={(e) => onAssign(sub.id, e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none focus:bg-white transition-all w-full max-w-[1400px]">
                            <option value="">Unassigned</option>
                            {editors.map(ed => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                          </select>
                      </td>
                      <td className="px-6 py-4">
                         <button onClick={() => setChattingSubmission(sub)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 group relative ${submissionChatInfo[sub.id]?.hasNew ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-900 hover:bg-slate-900 hover:text-white'}`}>
                           <span>CHAT {submissionChatInfo[sub.id]?.count > 0 && `(${submissionChatInfo[sub.id].count})`}</span>
                         </button>
                      </td>
                      <td className="px-8 py-4">
                         <div className="flex items-center justify-center gap-2">
                            {sub.plan === PlanType.FURNITURE_BOTH ? ( <> <DeliveryDropZone submission={sub} type="remove" /> <DeliveryDropZone submission={sub} type="add" /> </> ) : <DeliveryDropZone submission={sub} type="single" />}
                         </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <div className="flex flex-col items-end gap-3">
                            {quotePending && (
                              <div className="flex flex-col items-end gap-2 w-full max-w-[200px]">
                                {editingQuoteId === sub.id ? (
                                  <div className="flex gap-2 animate-in slide-in-from-right-4 w-full">
                                    <input type="number" placeholder="Cents" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} className="flex-grow px-3 py-2 text-[10px] border-2 border-slate-900 rounded-xl outline-none" />
                                    <button onClick={() => handleUpdateQuote(sub.id)} disabled={isUpdatingQuote} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase">Set</button>
                                  </div>
                                ) : <button onClick={() => setEditingQuoteId(sub.id)} className="w-full px-4 py-3 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"> {sub.quotedAmount ? `Update Quote ($${(sub.quotedAmount/100).toFixed(2)})` : "Initialize Quote"} </button>}
                              </div>
                            )}
                            {isDone ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                 <span className="text-[9px] font-black uppercase tracking-widest">Completed</span>
                              </div>
                            ) : (
                              <div className={`flex items-center gap-2 transition-all ${sub.status === 'reviewing' && user.role === 'admin' ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                                 <button onClick={() => onDeliver(sub.id, { status: 'processing' })} className="px-4 py-2 bg-white border border-rose-100 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm">Reject</button>
                                 <button onClick={() => onApprove(sub.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20">Approve</button>
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
