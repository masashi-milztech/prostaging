import React from 'react';

interface CommercialDisclosureProps {
  onBack: () => void;
}

export const CommercialDisclosure: React.FC<CommercialDisclosureProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">Commercial Disclosure</h1>
          <p className="text-sm text-slate-500 font-medium">Based on the Specified Commercial Transactions Act (Japan)</p>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Distributor / Operator</span>
              <p className="font-bold text-slate-900 text-lg">Milztech</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Representative Director</span>
              <p className="font-bold text-slate-900 text-lg">Emi Wada</p>
            </div>
            <div className="md:col-span-2 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Address & Phone</span>
              <p className="font-bold text-slate-900 text-lg">5-20-10 Sakuragaoka, Setagaya-ku, Tokyo, Japan</p>
              <p className="font-bold text-slate-900 text-lg">03-6820-6049</p>
            </div>
            <div className="md:col-span-2 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Contact Email</span>
              <p className="font-bold text-slate-900 text-lg">info@milz.tech</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Payment Methods</span>
              <p className="font-bold text-slate-900 text-lg">Credit Card (Stripe)</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Delivery Time</span>
              <p className="font-bold text-slate-900 text-lg">Usually within 3 business days</p>
            </div>
            <div className="md:col-span-2 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Price</span>
              <p className="font-bold text-slate-900 text-lg">Refer to the pricing plans displayed on the service page.</p>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Cancellation & Refund Policy</h2>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-600 font-medium leading-relaxed text-sm mb-4">
                Due to the nature of digital content and custom architectural visualization services, we generally do not accept cancellations or refunds once the production process has begun.
              </p>
              <ul className="list-disc list-inside text-slate-900 font-bold text-sm space-y-2">
                <li>
                  <span className="text-slate-500 font-medium">Before "Editing" Status:</span> Cancellation is possible. Please contact support immediately.
                </li>
                <li>
                  <span className="text-red-600">After "Editing" Status:</span> Once the project status moves to "Editing" (In Progress), <span className="underline decoration-red-300 decoration-2 underline-offset-2">no cancellations or refunds are accepted</span> under any circumstances.
                </li>
              </ul>
            </div>
          </div>
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
