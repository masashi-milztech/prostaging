
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
      
      // クライアント（user）からのメッセージかつ、アドミンがまだ見ていない場合
      if (msg.sender_role === 'user' && msg.timestamp > lastSeen) {
        info[sId].hasNew = true;
      }
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

  // URLにタイムスタンプを付与する共通関数
  const getSafeUrl = (rawUrl: string | undefined | null) => {
    if (!rawUrl) return null;
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}t=${lastReplaceTime}`;
  };

  const DeliveryDropZone = ({ submission, type }: { submission: Submission, type: 'remove' | 'add' | 'single' }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const label = type === 'remove' ? 'REMOVED' : type === 'add' ? 'STAGED' : 'FINAL RESULT';
    const currentUrlRaw = type === 'remove' ? submission.resultRemoveUrl : (type === 'add' ? submission.resultAddUrl : (submission.resultAddUrl || submission.resultDataUrl));
    
    const currentUrl = getSafeUrl(currentUrlRaw);

    const handleUpload = async (file: File) => {
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const uniquePath = `results/${submission.id}_${type}_${Date.now()}.jpg`;
          const publicUrl = await db.storage.upload(uniquePath, reader.result as string);
          
          const updates: Partial<Submission> = {};
          if (type === 'remove') updates.resultRemoveUrl = publicUrl;
          else { updates.resultAddUrl = publicUrl; updates.resultDataUrl = publicUrl; }
          
          let newStatus = submission.status;
          if (submission.plan === PlanType.FURNITURE_BOTH) {
            const otherDone = type === 'remove' ? !!submission.resultAddUrl : !!submission.resultRemoveUrl;
            newStatus = otherDone ? 'reviewing' : 'processing';
          } else { newStatus = 'reviewing'; }
          updates.status = newStatus; 
          
          await onDeliver(submission.id, updates);
          setLastReplaceTime(Date.now());
          onRefresh();
        } catch (err) {
          alert("Upload failed.");
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
              <button onClick={() => { 
                const input = document.createElement('input'); 
                input.type = 'file'; 
                input.accept = 'image/*'; 
                input.onchange = (e: any) => { 
                  const file = e.target.files?.[0]; 
                  if (file) handleUpload(file); 
                }; 
                input.click(); 
              }} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-900 uppercase shadow-sm hover:bg-slate-900 hover:text-white transition-all">Replace</button>
            </div>
          </>
        ) : uploading ? ( <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div> ) : (
          <div className="text-center p-2">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">DROP {label}</span>
            <button onClick={() => { 
              const input = document.createElement('input'); 
              input.type = 'file'; 
              input.accept = 'image/*'; 
              input.onchange = (e: any) => { 
                const file = e.target.files?.[0]; 
                if (file) handleUpload(file); 
              }; 
              input.click(); 
            }} className="text-[7px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 rounded-lg px-2 py-1">Browse</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 md:px-10 space-y-8">
      {viewingDetail && <DetailModal submission={viewingDetail} plans={plans} onClose={() => setViewingDetail(null)} />}
      {chattingSubmission && <ChatBoard submission={chattingSubmission} user={user} plans={plans} onClose={() => { setChattingSubmission(null); loadAllMessages(); }} />}
      
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
           {user?.role === 'admin' && <button onClick={() => setShowEditorManager(true)} className="flex-1 md:flex-none px-6 py-2.5 bg-white border-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full">Team Manager</button>}
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
               {s === 'comments' ? 'Communications' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm overflow-x-auto no-scrollbar">
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

                return (
                  <tr key={sub.id} className={`hover:bg-slate-50/50 transition-all ${hasNewMessage ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-8 py-4 text-center">
                       <button onClick={() => setViewingDetail(sub)} className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 hover:border-slate-900 shadow-sm bg-slate-50 inline-block">
                         <img src={visualUrl || ''} className="w-full h-full object-cover" alt="" />
                       </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${sub.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>{sub.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block leading-none">{plans[sub.plan]?.title}</span>
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">ID: {sub.id}</span>
                    </td>
                    <td className="px-6 py-4"> <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg"> {dueDate.toLocaleDateString('ja-JP')} </span> </td>
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
                            className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group border ${hasNewMessage ? 'bg-rose-500 text-white shadow-xl shadow-rose-200 border-rose-400 animate-pulse' : 'bg-slate-900 text-white'}`}
                          >
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                             <span>CHAT {chatInfo?.count > 0 && `(${chatInfo.count})`}</span>
                          </button>
                          {hasNewMessage && (
                            <span className="absolute -top-3 -right-3 bg-rose-600 text-white text-[7px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-white tracking-widest z-10">NEW</span>
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-4">
                       <div className="flex items-center justify-center gap-2">
                          {sub.plan === PlanType.FURNITURE_BOTH ? ( <> <DeliveryDropZone submission={sub} type="remove" /> <DeliveryDropZone submission={sub} type="add" /> </> ) : <DeliveryDropZone submission={sub} type="single" />}
                       </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                       <div className="flex flex-col items-end gap-3">
                          {sub.status === 'completed' ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                               <span className="text-[9px] font-black uppercase tracking-widest text-center">Completed</span>
                            </div>
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
      </div>
    </div>
  );
};
