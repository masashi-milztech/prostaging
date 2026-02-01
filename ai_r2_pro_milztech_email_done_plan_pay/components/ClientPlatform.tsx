
import React, { useState, useEffect, useMemo } from 'react';
import { PlanType, Submission, User, Plan, ReferenceImage, Message, getEstimatedDeliveryDate } from '../types';
import { PlanCard } from './PlanCard';
import { FileUpload } from './FileUpload';
import { DetailModal } from './DetailModal';
import { ChatBoard } from './ChatBoard';
import { ReferenceImageUpload } from './ReferenceImageUpload';
import { db, supabase } from '../lib/supabase';
import { sendStudioEmail, EMAIL_TEMPLATES } from '../lib/email';

interface ClientPlatformProps {
  user: User;
  onSubmission: (submission: Submission) => Promise<void>;
  onRefreshSubmissions: () => Promise<void>;
  userSubmissions: Submission[];
  plans: Record<string, Plan>;
}

const FLOOR_PLAN_GUIDE = `Please provide the following details:
1. Floor Plan Type: (e.g., 2LDK, 3-Bedroom House)
2. Total Floor Area: (e.g., 85 sqm / 915 sqft)
3. Flooring Preference: (e.g., Oak Wood, Gray Tile)
4. Interior Style: (e.g., Mid-Century Modern, Japandi)
5. Furniture Requirements: (e.g., Large island kitchen, L-shaped sofa)
6. Other Specifics:`;

const STUDIO_CONTACT_EMAIL = 'info@milz.tech';

const resizeImageForAI = (base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
};

export const ClientPlatform: React.FC<ClientPlatformProps> = ({ user, onSubmission, onRefreshSubmissions, userSubmissions, plans }) => {
  const visiblePlansList = useMemo(() => (Object.values(plans) as Plan[]).filter(p => p.isVisible !== false), [plans]);
  
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(visiblePlansList[0]?.id as PlanType || PlanType.FURNITURE_REMOVE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOutId, setIsCheckingOutId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [viewingDetailId, setViewingDetailId] = useState<string | null>(null); 
  const [chattingSubmissionId, setChattingSubmissionId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});

  const viewingDetail = useMemo(() => userSubmissions.find(s => s.id === viewingDetailId) || null, [userSubmissions, viewingDetailId]);
  const chattingSubmission = useMemo(() => userSubmissions.find(s => s.id === chattingSubmissionId) || null, [userSubmissions, chattingSubmissionId]);

  const isQuotePlan = selectedPlan === PlanType.FLOOR_PLAN_CG;

  useEffect(() => {
    loadAllMessages();
    const interval = setInterval(loadAllMessages, 10000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const orderId = params.get('order_id');
    const paymentStatus = params.get('payment');
    if (sessionId && orderId && paymentStatus === 'success') {
      handlePaymentSuccess(orderId, sessionId);
    }
  }, []);

  const loadAllMessages = async () => {
    try {
      const msgs = await db.messages.fetchAll() as Message[];
      setAllMessages(msgs);
      const map: Record<string, number> = {};
      userSubmissions.forEach(s => {
        const val = localStorage.getItem(`chat_last_read_${s.id}`);
        if (val) map[s.id] = parseInt(val);
      });
      setLastReadMap(map);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const submissionChatInfo = useMemo(() => {
    const info: Record<string, { count: number, hasNew: boolean }> = {};
    allMessages.forEach(msg => {
      const sId = msg.submission_id;
      if (!sId) return;
      if (!info[sId]) info[sId] = { count: 0, hasNew: false };
      info[sId].count += 1;
      const lastSeen = lastReadMap[sId] || 0;
      const isFromStudio = msg.sender_role === 'admin' || msg.sender_role === 'editor';
      if (isFromStudio && msg.timestamp > lastSeen) info[sId].hasNew = true;
    });
    return info;
  }, [allMessages, lastReadMap]);

  const handlePlanChange = (type: PlanType) => {
    setSelectedPlan(type);
    if (type === PlanType.FLOOR_PLAN_CG && !instructions.trim()) {
      setInstructions(FLOOR_PLAN_GUIDE);
    } else if (type !== PlanType.FLOOR_PLAN_CG && instructions === FLOOR_PLAN_GUIDE) {
      setInstructions('');
    }
  };

  const runAiAnalysis = async (imageBase64: string) => {
    if (isQuotePlan) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const optimizedImage = await resizeImageForAI(imageBase64);
      const res = await fetch('/api/analyze-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: optimizedImage }),
      });
      const data = await res.json();
      if (data.analysis) setAiAnalysis(data.analysis);
    } catch (e) {
      console.error("AI Analysis failed", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        setPreviewUrl(url);
        runAiAnalysis(url);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
      setAiAnalysis(null);
    }
  };

  const triggerCheckout = async (orderId: string, planTitle: string, amount: number) => {
    setIsCheckingOutId(orderId);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTitle: planTitle,
          amount: amount,
          orderId: orderId,
          userEmail: user.email
        }),
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || "Checkout failed.");
      }
    } catch (err: any) {
      alert(`STRIPE ERROR: ${err.message}`);
      setIsCheckingOutId(null);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!selectedFile || !previewUrl || isSubmitting) return;
    const planInfo = plans[selectedPlan];
    setIsSubmitting(true);
    setIsConfirming(false); 
    try {
      const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const storagePath = `${user.id}/${orderId}_source.jpg`;
      const publicImageUrl = await db.storage.upload(storagePath, previewUrl);
      const uploadedReferences = await Promise.all(
        referenceImages.map(async (ref, idx) => {
          const refPath = `${user.id}/${orderId}_ref_${idx}.jpg`;
          const url = await db.storage.upload(refPath, ref.dataUrl);
          return { ...ref, dataUrl: url };
        })
      );
      const submission: Submission = {
        id: orderId,
        ownerId: user.id,
        ownerEmail: user.email,
        plan: selectedPlan,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        dataUrl: publicImageUrl,
        instructions: (aiAnalysis ? `[AI Vision: ${aiAnalysis}]\n\n` : '') + instructions.trim(),
        referenceImages: uploadedReferences,
        timestamp: Date.now(),
        status: isQuotePlan ? 'quote_request' : 'pending',
        paymentStatus: isQuotePlan ? 'quote_pending' : 'unpaid'
      };
      await onSubmission(submission);
      
      if (isQuotePlan) {
        // 見積もり依頼メール送信
        const emailContent = EMAIL_TEMPLATES.ORDER_CONFIRMED({
          orderId: submission.id,
          planName: planInfo?.title || 'Quote Request',
          price: 'Custom Quote (Requested)',
          date: new Date(submission.timestamp).toLocaleString(),
          delivery: 'TBD (Quote Pending)',
          thumbnail: submission.dataUrl
        });

        // 1. お客様へ
        await sendStudioEmail(user.email, `Quote Request Received: ${submission.id}`, emailContent);
        // 2. 運営（info@milz.tech）へ
        await sendStudioEmail(STUDIO_CONTACT_EMAIL, `New Quote Request: ${submission.id}`, emailContent);

        setShowSuccess(true);
        setIsSubmitting(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setAiAnalysis(null);
        setInstructions('');
        setReferenceImages([]);
        return;
      }
      
      const finalAmount = planInfo ? Number(planInfo.amount) : 0;
      await triggerCheckout(orderId, planInfo?.title || 'Staging Service', finalAmount);
    } catch (err: any) {
      alert(`PROCESS FAILED: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (orderId: string, sessionId: string) => {
    try {
      // 1. データベースの支払ステータスを更新
      await db.submissions.update(orderId, { 
        paymentStatus: 'paid',
        stripeSessionId: sessionId,
        status: 'pending'
      });

      // 2. 最新のオーダーデータをUIに反映させるために再取得
      await onRefreshSubmissions();

      // 3. メール送信ロジック（確実に送信先情報を取得）
      // 再取得した userSubmissions から対象の注文を探す
      const sub = userSubmissions.find(s => s.id === orderId) || (await supabase.from('submissions').select('*').eq('id', orderId).single()).data;
      
      if (sub) {
        const planInfo = plans[sub.plan];
        const estDeliveryDate = getEstimatedDeliveryDate(sub.timestamp).toLocaleDateString('ja-JP');
        const emailContent = EMAIL_TEMPLATES.ORDER_CONFIRMED({
          orderId: sub.id,
          planName: planInfo?.title || 'Staging Service',
          price: planInfo?.price || 'Paid',
          date: new Date(sub.timestamp).toLocaleString(),
          delivery: `${estDeliveryDate} (3 Business Days)`,
          thumbnail: sub.dataUrl
        });

        // お客様と運営（info@milz.tech）へメール送信
        await sendStudioEmail(sub.ownerEmail || user.email, `Order Confirmation: ${sub.id}`, emailContent);
        await sendStudioEmail(STUDIO_CONTACT_EMAIL, `New Paid Order: ${sub.id}`, emailContent);
      }

      // 4. URLをクリーンアップ
      window.history.replaceState({}, document.title, "/");
      
      // 5. 成功メッセージを表示
      setShowSuccess(true);
    } catch (err) {
      console.error("Payment confirmation failed", err);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-16 px-6 lg:px-12">
      {viewingDetail && <DetailModal submission={viewingDetail} plans={plans} onClose={() => setViewingDetailId(null)} onTriggerCheckout={triggerCheckout} />}
      {/* Fix: changed property name from chattingSubmission to submission to match ChatBoardProps */}
      {chattingSubmission && <ChatBoard submission={chattingSubmission} user={user} plans={plans} onClose={() => { setChattingSubmissionId(null); loadAllMessages(); }} />}

      {isConfirming && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 md:p-14 space-y-10 animate-in zoom-in duration-300">
              <div className="space-y-4">
                 <h3 className="text-3xl font-black uppercase tracking-tight jakarta text-slate-900">Final Review</h3>
                 <p className="text-sm font-medium text-slate-500 italic">Please confirm your project details before initialization.</p>
              </div>
              <div className="flex gap-8 items-start bg-slate-50 p-6 rounded-3xl">
                 <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-200">
                    {previewUrl && <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />}
                 </div>
                 <div className="flex-grow space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{plans[selectedPlan]?.number} PLAN</span>
                    <h4 className="text-xl font-black uppercase text-slate-900">{plans[selectedPlan]?.title}</h4>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fee: {plans[selectedPlan]?.price}</p>
                    </div>
                 </div>
              </div>
              <div className="flex gap-4 pt-4">
                 <button onClick={() => setIsConfirming(false)} className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Edit Order</button>
                 <button onClick={handleConfirmAndPay} className="flex-2 px-12 py-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all">
                   {isQuotePlan ? 'Confirm Request' : 'Proceed to Payment'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 text-center space-y-10 animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black uppercase tracking-tighter jakarta text-slate-900 leading-tight">Project <br/> Initialized.</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed italic px-6">
                Thank you. Our architectural visualizers have begun processing your assets.
              </p>
            </div>
            <div className="pt-4">
              <button onClick={() => setShowSuccess(false)} className="w-full py-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-xl hover:bg-black transition-all">Enter Archive</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-20 items-start">
        <div className="flex-1 space-y-12">
          <header className="space-y-6">
            <h1 className="text-7xl font-black text-slate-900 tracking-tighter uppercase leading-[0.85] jakarta">Order <br/> Staging.</h1>
          </header>
          <div className="space-y-8">
            <div className="card-premium rounded-[3rem] p-10 md:p-14">
              <div className="flex items-center gap-6 mb-12"><span className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-2xl font-black text-lg">01</span><h2 className="text-2xl font-black text-slate-900 uppercase">Select Service</h2></div>
              <div className="flex flex-col gap-4">
                {visiblePlansList.map((p) => (
                  <PlanCard key={p.id} plan={p} isSelected={selectedPlan === p.id} onSelect={handlePlanChange} />
                ))}
              </div>
            </div>
            <div className="card-premium rounded-[3rem] p-10 md:p-14">
              <div className="flex items-center gap-6 mb-12"><span className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-2xl font-black text-lg">02</span><h2 className="text-2xl font-black text-slate-900 uppercase">Upload Assets</h2></div>
              <div className="space-y-12">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">{isQuotePlan ? 'Upload Floor Plan (Drawing)' : 'Select Canvas Photo'}</h3>
                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
                {(isAnalyzing || aiAnalysis) && (
                  <div className="p-8 bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>
                          </div>
                          <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Studio AI Vision</span>
                       </div>
                       {isAnalyzing && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    <div className="relative">
                      {isAnalyzing ? (
                        <p className="text-xs font-medium text-slate-400 italic animate-pulse">Analyzing spatial architecture...</p>
                      ) : (
                        <p className="text-xs md:text-sm font-medium text-slate-200 leading-relaxed italic border-l-2 border-emerald-500 pl-6">
                          "{aiAnalysis}"
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Project Requirements</h3>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={isQuotePlan ? "Describe property details..." : "Specific requests..."} className="w-full bg-slate-50 p-8 rounded-[2rem] min-h-[220px] text-sm font-medium outline-none transition-all resize-none italic" />
                </div>
                <ReferenceImageUpload references={referenceImages} setReferences={setReferenceImages} />
                <button onClick={() => setIsConfirming(true)} disabled={!selectedFile || isSubmitting} className={`w-full py-8 rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 group ${!selectedFile || isSubmitting ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'}`}>
                  {isSubmitting ? <div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div><span>SYNCING...</span></div> : <span>{isQuotePlan ? 'Request Quote & Initialize' : 'Submit & Proceed to Checkout'}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[450px] space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900">Live Archive</h2>
            </div>
            <div className="w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">
              {userSubmissions.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'quote_pending').length}
            </div>
          </div>
          <div className="space-y-4">
            {userSubmissions.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'quote_pending').length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No projects yet</p>
              </div>
            ) : userSubmissions.filter(s => s.paymentStatus === 'paid' || s.paymentStatus === 'quote_pending').map((sub) => {
              const needsPayment = sub.plan === PlanType.FLOOR_PLAN_CG && sub.paymentStatus === 'quote_pending' && sub.quotedAmount;
              const isCheckingOut = isCheckingOutId === sub.id;
              const hasNewMessage = submissionChatInfo[sub.id]?.hasNew;
              
              // 納品目安日の計算
              const estDate = getEstimatedDeliveryDate(sub.timestamp);
              const estDateStr = estDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

              return (
                <div key={sub.id} className={`group flex flex-col p-6 bg-white rounded-[2.5rem] border transition-all relative ${needsPayment ? 'border-indigo-500 shadow-xl ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-900 animate-in fade-in duration-500'}`}>
                  {hasNewMessage && (
                    <div className="absolute top-4 right-6 animate-bounce z-10">
                       <div className="bg-emerald-500 text-white text-[7px] font-black px-2 py-1 rounded-full shadow-lg shadow-emerald-500/20 tracking-widest flex items-center gap-1.5">
                          <span className="w-1 h-1 bg-white rounded-full animate-ping"></span>NEW MESSAGE
                       </div>
                    </div>
                  )}
                  <div className="flex gap-4 mb-4">
                    <div onClick={() => setViewingDetailId(sub.id)} className="w-20 h-20 rounded-[1.2rem] overflow-hidden flex-shrink-0 bg-slate-100 relative cursor-pointer group-hover:shadow-lg transition-all">
                      <img src={sub.dataUrl} className="w-full h-full object-cover" alt="" />
                      {sub.status === 'completed' && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg transform scale-75">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <span onClick={() => setViewingDetailId(sub.id)} className="text-[10px] font-black text-slate-900 uppercase tracking-widest truncate block mb-1 cursor-pointer">{plans[sub.plan]?.title || sub.plan}</span>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border w-fit ${sub.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : sub.status === 'quote_request' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </div>
                        {sub.status !== 'completed' && sub.paymentStatus === 'paid' && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Est. Delivery: {estDateStr}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {needsPayment && (
                      <button type="button" onClick={() => triggerCheckout(sub.id, plans[sub.plan]?.title || 'Staging Service', sub.quotedAmount!)} disabled={isCheckingOut} className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                        {isCheckingOut ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : `Pay $ ${(sub.quotedAmount!/100).toFixed(2)} Now`}
                      </button>
                    )}
                    <button type="button" onClick={() => setChattingSubmissionId(sub.id)} className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${hasNewMessage ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
                      Contact Studio {hasNewMessage && `(${submissionChatInfo[sub.id].count})`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
