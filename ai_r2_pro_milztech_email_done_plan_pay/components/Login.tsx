
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = [
  'masashi@milz.tech', 
  'masashi@thisismerci.com'
];

interface LoginProps {
  onLogin: (user: any) => void;
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBack }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setSuccessMsg('');
    setLoading(true);

    const isAdmin = (email: string) => ADMIN_EMAILS.includes(email.toLowerCase().trim());

    try {
      if (isLoginView) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.includes('Email not confirmed')) {
            throw new Error('Verification Required. \nPlease check your inbox and click the activation link to continue.');
          }
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('Authentication Failed. \nInvalid password or account does not exist.');
          }
          throw signInError;
        }
      } else {
        const redirectUrl = window.location.origin;
        
        const { error: signUpError, data } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              role: isAdmin(email) ? 'admin' : 'user'
            },
            emailRedirectTo: redirectUrl
          }
        });
        
        if (signUpError) {
          throw signUpError;
        }
        
        if (data.user && data.session === null) {
          setSuccessMsg('Studio Invitation Dispatched. \nWe have sent a verification email. Please click the link to confirm your studio membership.');
        } else {
          setSuccessMsg('Account authorized. Redirecting to your archive...');
          setTimeout(() => window.location.reload(), 1000);
        }
      }
    } catch (err: any) {
      console.error("Auth Exception:", err);
      setError(err.message || 'Authentication error.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-20 relative overflow-hidden">
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-10 left-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all z-50 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          Back to Intro
        </button>
      )}

      <div className="max-w-lg w-full bg-white rounded-[3rem] shadow-2xl p-12 md:p-16 border border-slate-100 relative overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 rounded-bl-[5rem]"></div>
        
        <div className="text-center mb-16 relative z-10">
          <div className="serif text-5xl font-extrabold mb-10 uppercase tracking-tighter text-slate-900">StagingPro</div>
          <div className="inline-block px-4 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.4em]">
            Studio Entrance
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          {error && (
            <div className="bg-red-50 text-red-600 p-8 rounded-[2rem] border border-red-100 text-center animate-in fade-in slide-in-from-top-4 duration-500">
              <p className="text-[10px] font-black uppercase tracking-widest leading-loose whitespace-pre-wrap">
                {error}
              </p>
            </div>
          )}

          {successMsg && (
            <div className="bg-slate-900 text-white p-10 rounded-[2rem] border border-slate-800 text-center shadow-2xl animate-in zoom-in duration-500">
               <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
               </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-loose whitespace-pre-wrap">
                {successMsg}
              </p>
            </div>
          )}
          
          {!successMsg && (
            <>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-8 py-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-slate-900 transition-all outline-none font-medium text-slate-900"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Secure Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-8 py-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-slate-900 transition-all outline-none font-medium text-slate-900"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] hover:bg-black transition-all shadow-2xl disabled:opacity-50"
              >
                {loading ? 'SYNCING...' : (isLoginView ? 'Authenticate' : 'Join the Studio')}
              </button>
            </>
          )}
        </form>

        <div className="mt-16 pt-10 border-t border-slate-50 text-center flex flex-col gap-8">
          {!successMsg && (
            <button
              onClick={() => { setIsLoginView(!isLoginView); setError(''); setSuccessMsg(''); }}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-slate-900 transition-colors"
            >
              {isLoginView ? "Join the studio circle →" : "Return to sign in →"}
            </button>
          )}
          
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Contact & Support</p>
            <a href="mailto:info@milz.tech" className="text-[11px] font-bold text-slate-900 hover:underline tracking-widest">info@milz.tech</a>
          </div>
        </div>
      </div>
    </div>
  );
};
