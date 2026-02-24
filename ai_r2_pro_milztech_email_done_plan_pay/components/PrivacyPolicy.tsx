import React from 'react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500 font-medium">Last Updated: February 2025</p>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm">
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
