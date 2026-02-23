import React, { useState } from 'react';

interface LegalModalProps {
  onClose: () => void;
  initialSection?: 'terms' | 'privacy' | 'commercial';
}

type Tab = 'commercial' | 'terms' | 'privacy';

export const LegalModal: React.FC<LegalModalProps> = ({ onClose, initialSection = 'commercial' }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialSection as Tab);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl h-[85vh] md:h-[90vh] rounded-[2rem] md:rounded-[3rem] shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 md:p-10 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-md z-10 flex-shrink-0">
          <div>
            <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight jakarta text-slate-900">Legal Information</h3>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operated by Milztech</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-900 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar flex-shrink-0">
          {[
            { id: 'commercial', label: 'Commercial Disclosure' },
            { id: 'terms', label: 'Terms of Service' },
            { id: 'privacy', label: 'Privacy Policy' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 md:px-8 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                activeTab === tab.id 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-white text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-slate-50/50">
          <div className="max-w-3xl mx-auto space-y-12 pb-10">
            
            {/* Commercial Disclosure (Tokusho-ho) */}
            {activeTab === 'commercial' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900">Commercial Disclosure</h4>
                  <p className="text-xs text-slate-500 font-medium">Based on the Specified Commercial Transactions Act (Japan)</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Distributor / Operator</span>
                      <p className="font-bold text-slate-900">Milztech</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Representative Director</span>
                      <p className="font-bold text-slate-900">[Name]</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Address</span>
                      <p className="font-bold text-slate-900">5-20-10 Sakuragaoka, Setagaya-ku, Tokyo, Japan</p>
                      <p className="text-[10px] text-slate-400 mt-1">Note: Please contact us via email for telephone number requests. We will disclose it without delay upon request.</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Contact Email</span>
                      <p className="font-bold text-slate-900">info@milz.tech</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Payment Methods</span>
                      <p className="font-bold text-slate-900">Credit Card (Stripe)</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Delivery Time</span>
                      <p className="font-bold text-slate-900">Usually within 3 business days</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Price</span>
                      <p className="font-bold text-slate-900">Refer to the pricing plans displayed on the service page.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-lg font-black uppercase tracking-tight text-slate-900">Cancellation & Refund Policy</h5>
                  <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200">
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
              </section>
            )}

            {/* Terms of Service */}
            {activeTab === 'terms' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900">Terms of Service</h4>
                  <p className="text-xs text-slate-500 font-medium">Last Updated: February 2025</p>
                </div>

                <div className="prose prose-slate prose-sm max-w-none font-medium text-slate-600 leading-relaxed">
                  <p>
                    Welcome to StagingPro (operated by Milztech). By accessing or using our website and services, you agree to be bound by these Terms of Service.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">1. Services</h5>
                  <p>
                    StagingPro provides virtual staging and architectural visualization services. We transform user-uploaded images into virtually furnished or renovated visualizations based on selected plans.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">2. User Accounts & Responsibilities</h5>
                  <p>
                    You are responsible for maintaining the confidentiality of your account information. You agree to provide accurate and complete information when using our services. You represent and warrant that you own or have the necessary licenses, rights, and permissions to use and authorize us to use all images and content you upload.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">3. Prohibited Conduct</h5>
                  <p>
                    You agree not to upload any content that is illegal, offensive, defamatory, or infringes on any third party's intellectual property rights. We reserve the right to refuse service or terminate accounts that violate these terms.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">4. Intellectual Property</h5>
                  <p>
                    Upon full payment, you are granted a non-exclusive, worldwide, perpetual license to use the final delivered images for personal or commercial purposes (e.g., real estate listings). Milztech retains the right to use the before-and-after images for our portfolio and marketing purposes unless explicitly agreed otherwise in writing.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">5. Disclaimer of Warranties</h5>
                  <p>
                    Our services are provided "as is." While we strive for high-quality photorealism, we do not guarantee that the results will be indistinguishable from reality or meet specific subjective artistic preferences beyond our standard revision policy.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">6. Limitation of Liability</h5>
                  <p>
                    To the maximum extent permitted by law, Milztech shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the services.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">7. Governing Law</h5>
                  <p>
                    These Terms shall be governed by and construed in accordance with the laws of Japan. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the Tokyo District Court.
                  </p>
                </div>
              </section>
            )}

            {/* Privacy Policy */}
            {activeTab === 'privacy' && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-2">
                  <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900">Privacy Policy</h4>
                  <p className="text-xs text-slate-500 font-medium">Last Updated: February 2025</p>
                </div>

                <div className="prose prose-slate prose-sm max-w-none font-medium text-slate-600 leading-relaxed">
                  <p>
                    Milztech ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use StagingPro.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">1. Information We Collect</h5>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Account Information:</strong> Name, email address, and login credentials.</li>
                    <li><strong>Project Data:</strong> Images, floor plans, and instructions you upload.</li>
                    <li><strong>Payment Information:</strong> We use Stripe for payment processing. We do not store your full credit card details on our servers.</li>
                    <li><strong>Usage Data:</strong> Information about how you access and use our website (e.g., IP address, browser type).</li>
                  </ul>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">2. How We Use Your Information</h5>
                  <p>
                    We use your information to:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Provide, operate, and maintain our services.</li>
                    <li>Process your orders and payments.</li>
                    <li>Communicate with you regarding your projects, updates, and support.</li>
                    <li>Improve our website and services.</li>
                  </ul>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">3. Data Sharing and Disclosure</h5>
                  <p>
                    We do not sell your personal information. We may share your information with:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Service Providers:</strong> Third-party vendors who perform services on our behalf (e.g., payment processing, cloud hosting).</li>
                    <li><strong>Legal Compliance:</strong> If required by law or to protect our rights and safety.</li>
                  </ul>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">4. Data Security</h5>
                  <p>
                    We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">5. Cookies</h5>
                  <p>
                    We use cookies and similar technologies to enhance your experience, analyze usage, and assist with our marketing efforts. You can control cookie preferences through your browser settings.
                  </p>

                  <h5 className="text-slate-900 font-black uppercase tracking-wide text-sm mt-8 mb-2">6. Contact Us</h5>
                  <p>
                    If you have any questions about this Privacy Policy, please contact us at info@milz.tech.
                  </p>
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

