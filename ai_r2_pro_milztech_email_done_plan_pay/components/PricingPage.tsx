import React from 'react';
import { Plan } from '../types';

interface PricingPageProps {
  onBack: () => void;
  plans: Record<string, Plan>;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onBack, plans }) => {
  const visiblePlans = (Object.values(plans) as Plan[]).filter(p => p.isVisible !== false);

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-[1000px] mx-auto space-y-16 md:space-y-24">
        <div className="text-center space-y-4 md:space-y-6">
          <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-[0.6em] md:tracking-[0.8em]">Frameworks</span>
          <h2 className="text-4xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase jakarta leading-none">Plans</h2>
        </div>

        <div className="space-y-4 md:space-y-6">
          {visiblePlans.map((plan) => (
            <div 
              key={plan.id} 
              className="group relative flex flex-col md:flex-row items-center gap-6 md:gap-12 p-6 md:p-12 bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 hover:border-slate-900 hover:shadow-2xl transition-all duration-500 text-left"
            >
              <div className="hidden md:block text-5xl md:text-7xl font-black text-slate-50 group-hover:text-slate-100 transition-colors pointer-events-none select-none jakarta">
                {plan.number}
              </div>
              
              <div className="flex-1 space-y-3 md:space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-lg text-[7px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-all">Studio Protocol {plan.number}</div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight jakarta leading-tight">{plan.title}</h3>
                <p className="text-slate-400 text-[11px] md:text-sm font-medium leading-relaxed italic max-w-xl line-clamp-3 md:line-clamp-none">{plan.description}</p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-5 min-w-[180px] w-full md:w-auto pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-slate-50 md:pl-12">
                 <div className="text-center md:text-right">
                    <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-0.5 md:mb-1">Rate</span>
                    <span className="text-2xl md:text-4xl font-black text-slate-900 jakarta tracking-tighter">
                      {plan.price}
                    </span>
                 </div>
                 <button onClick={onBack} className="w-full px-8 py-4 md:py-5 rounded-[1rem] md:rounded-2xl bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all">
                    Back to Home
                 </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center">
          <button 
            onClick={onBack} 
            className="inline-block px-8 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
