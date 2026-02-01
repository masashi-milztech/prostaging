
import React, { useState, useEffect, useRef } from 'react';
import { Submission, Message, User, Plan } from '../types';
import { db, supabase, isOperationalError } from '../lib/supabase';

interface ChatBoardProps {
  submission: Submission;
  user: User;
  plans: Record<string, Plan>;
  onClose: () => void;
}

export const ChatBoard: React.FC<ChatBoardProps> = ({ submission, user, plans, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`chat_${submission.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `submission_id=eq.${submission.id}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submission.id]);

  useEffect(() => {
    if (messages.length > 0) {
      const latestTimestamp = Math.max(...messages.map(m => m.timestamp));
      localStorage.setItem(`chat_last_read_${submission.id}`, latestTimestamp.toString());
    }
  }, [messages, submission.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const result = await db.messages.fetchBySubmission(submission.id);
      if (result && (result as any).error === 'TABLE_MISSING') {
        setIsTableMissing(true);
      } else if (Array.isArray(result)) {
        setMessages(result as Message[]);
        setIsTableMissing(false);
        setIsMaintenance(false);
      }
    } catch (err) {
      if (isOperationalError(err)) {
        setIsMaintenance(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || isTableMissing || isMaintenance) return;

    setIsSending(true);

    const payload = {
      submission_id: submission.id,
      sender_id: user.id,
      sender_name: user.email.split('@')[0],
      sender_role: user.role,
      content: input.trim(),
      timestamp: Date.now()
    };

    try {
      await db.messages.insert(payload);
      setInput('');
    } catch (err: any) {
      if (err.code === 'PGRST205') {
        setIsTableMissing(true);
      } else {
        console.warn("Message send failed during sync/maintenance", err);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300 text-left">
      <div className="bg-white w-full max-w-2xl h-[90vh] md:h-[85vh] rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl overflow-hidden border border-slate-100 flex-shrink-0">
               <img src={submission.dataUrl} className="w-full h-full object-cover" alt="" />
            </div>
            <div>
              <h3 className="text-[12px] md:text-sm font-black uppercase tracking-tight jakarta text-slate-900">
                {plans[submission.plan]?.title}
              </h3>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                ID: {submission.id} • Studio Link
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-100 hover:bg-slate-900 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar bg-slate-50/50">
          {loading ? (
             <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            const isAdmin = msg.sender_role === 'admin' || msg.sender_role === 'editor';
            
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${isAdmin ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                  {isAdmin ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  )}
                </div>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{msg.sender_name}</span>
                    <span className="text-[7px] font-bold text-slate-200 uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`px-5 py-3 rounded-2xl text-[12px] font-medium leading-relaxed shadow-sm ${isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 md:p-8 bg-white border-t border-slate-100">
          <form onSubmit={handleSendMessage} className="flex gap-4">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-slate-50 border-2 border-transparent px-6 py-4 rounded-2xl text-xs font-medium focus:bg-white focus:border-slate-900 outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={!input.trim() || isSending}
              className="px-8 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
            >
              {isSending ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9-2-9-18-9 18 9 2zm0 0v-8" /></svg>}
              <span>SEND</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
