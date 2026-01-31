
import React from 'react';
import { Plan } from '../types';

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: (type: any) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, isSelected, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(plan.id)}
      className={`group relative flex flex-col md:flex-row items-center w-full p-6 md:p-8 text-left transition-all duration-500 rounded-[2rem] border-2 gap-6 ${
        isSelected 
          ? 'bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.01] z-10' 
          : 'bg-white border-slate-50 text-slate-800 hover:border-slate-200 shadow-sm'
      }`}
    >
      {/* プラン番号 - アクセント */}
      <div className={`text-4xl md:text-5xl font-black jakarta leading-none transition-colors ${
        isSelected ? 'text-white/20' : 'text-slate-100 group-hover:text-slate-200'
      }`}>
        {plan.number}
      </div>

      {/* メインコンテンツ */}
      <div className="flex-grow space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg md:text-xl font-bold tracking-tight jakarta uppercase">
            {plan.title}
          </h3>
          {isSelected && (
            <span className="bg-emerald-400 text-slate-900 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
              Selected
            </span>
          )}
        </div>
        <p className={`text-[10px] md:text-xs leading-relaxed font-medium italic line-clamp-2 ${
          isSelected ? 'text-slate-400' : 'text-slate-400 group-hover:text-slate-500'
        }`}>
          {plan.description}
        </p>
      </div>

      {/* 右側：価格とステータス */}
      <div className={`flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 min-w-[120px] pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-white/10 ${
        isSelected ? 'border-white/10' : 'border-slate-50'
      } md:pl-8 w-full md:w-auto`}>
        <div className="flex flex-col items-end">
          <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${
            isSelected ? 'text-slate-500' : 'text-slate-300'
          }`}>Rate</span>
          <span className="text-2xl font-black tracking-tighter jakarta leading-none">
            {plan.price}
          </span>
        </div>
        
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
          isSelected ? 'border-white bg-white' : 'border-slate-100 bg-transparent group-hover:border-slate-300'
        }`}>
          {isSelected ? (
            <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-200 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
};
