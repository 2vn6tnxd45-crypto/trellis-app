// src/features/invitations/ContractorLanding.jsx
// ============================================
// CONTRACTOR PORTAL LANDING PAGE
// ============================================
// A clean entry point for contractors to access all features:
// 1. Create customer invitations (onboard new customers)
// 2. Submit work details (for existing customer requests)

import React from 'react';
import { 
    Gift, FileText, ArrowRight, Sparkles, 
    Users, CheckCircle, Clock, Shield,
    Smartphone, Mail, QrCode
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';

// ============================================
// FEATURE CARD COMPONENT
// ============================================
const FeatureCard = ({ 
    icon: Icon, 
    title, 
    description, 
    benefits, 
    buttonText, 
    onClick,
    highlighted = false 
}) => (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg ${
        highlighted 
            ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white' 
            : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
        <div className="p-6">
            <div className={`inline-flex p-3 rounded-xl mb-4 ${
                highlighted ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
                <Icon size={24} className={highlighted ? 'text-emerald-600' : 'text-slate-600'} />
            </div>
            
            {highlighted && (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <Sparkles size={12} className="mr-1" />
                    Recommended
                </span>
            )}
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-500 mb-4">{description}</p>
            
            <ul className="space-y-2 mb-6">
                {benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle size={16} className={`shrink-0 mt-0.5 ${
                            highlighted ? 'text-emerald-500' : 'text-slate-400'
                        }`} />
                        {benefit}
                    </li>
                ))}
            </ul>
            
            <button
                onClick={onClick}
                className={`w-full py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                    highlighted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
                {buttonText}
                <ArrowRight size={18} />
            </button>
        </div>
    </div>
);

// ============================================
// HOW IT WORKS STEP
// ============================================
const Step = ({ number, title, description }) => (
    <div className="flex gap-4">
        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-sm">
            {number}
        </div>
        <div>
            <h4 className="font-bold text-slate-800">{title}</h4>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const ContractorLanding = () => {
    
    const handleCreateInvitation = () => {
        // Navigate to invitation creator
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'invite');
        window.location.href = url.toString();
    };
    
    const handleHaveRequestLink = () => {
        // Show prompt for request ID
        const requestId = prompt('Enter the Request ID from your customer\'s link:');
        if (requestId && requestId.trim()) {
            const url = new URL(window.location.href);
            url.searchParams.delete('pro');
            url.searchParams.set('requestId', requestId.trim());
            window.location.href = url.toString();
        }
    };
    
    // DARK MODE FIX: Added 'contractor-page' class to force light mode
    return (
        <div className="contractor-page min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-100">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Logo className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="font-bold text-emerald-950">krib</h1>
                            <p className="text-xs text-slate-500">For Professionals</p>
                        </div>
                    </div>
                    <a 
                        href="/"
                        className="text-sm text-slate-500 hover:text-slate-700"
                    >
                        Homeowner? Sign in →
                    </a>
                </div>
            </header>
            
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">
                        Krib for Contractors
                    </h1>
                    <p className="text-emerald-100 text-lg max-w-2xl mx-auto">
                        Help your customers track their home maintenance. 
                        Create a permanent record of your work that builds trust and drives referrals.
                    </p>
                </div>
            </section>
            
            {/* Main Options */}
            <section className="max-w-4xl mx-auto px-4 -mt-8">
                <div className="grid md:grid-cols-2 gap-6">
                    <FeatureCard
                        icon={Gift}
                        title="Create Customer Invitation"
                        description="Finished a job? Create a link with all the work details and send it to your customer."
                        benefits={[
                            "Customer gets instant home records",
                            "Your contact info saved for future work",
                            "Warranty and maintenance reminders set up",
                            "No account needed for you"
                        ]}
                        buttonText="Create Invitation"
                        onClick={handleCreateInvitation}
                        highlighted={true}
                    />
                    
                    <FeatureCard
                        icon={FileText}
                        title="Submit Work Details"
                        description="Did a customer send you a request link? Use it to submit your work details."
                        benefits={[
                            "Customer requested specific info",
                            "Fill in details about work performed",
                            "Attach photos and invoices",
                            "Details go directly to their account"
                        ]}
                        buttonText="I Have a Request Link"
                        onClick={handleHaveRequestLink}
                    />
                </div>
            </section>
            
            {/* How It Works */}
            <section className="max-w-4xl mx-auto px-4 py-16">
                <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">
                    How Customer Invitations Work
                </h2>
                
                <div className="bg-white rounded-2xl border border-slate-200 p-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <Step
                            number="1"
                            title="Enter Work Details"
                            description="Fill in what you installed or repaired—brand, model, cost, warranty info."
                        />
                        <Step
                            number="2"
                            title="Send the Link"
                            description="Share via text, email, or print a QR code on your invoice."
                        />
                        <Step
                            number="3"
                            title="Customer Signs Up"
                            description="They create a free account and your work is automatically saved."
                        />
                    </div>
                    
                    {/* Sharing Methods */}
                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-500 text-center mb-4">
                            Ways to share with customers
                        </p>
                        <div className="flex justify-center gap-6">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Smartphone size={18} className="text-slate-400" />
                                <span className="text-sm">Text Message</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                                <Mail size={18} className="text-slate-400" />
                                <span className="text-sm">Email</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                                <QrCode size={18} className="text-slate-400" />
                                <span className="text-sm">QR Code</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Benefits Section */}
            <section className="bg-white border-y border-slate-100 py-16">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">
                        Why Contractors Love Krib
                    </h2>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="inline-flex p-4 rounded-2xl bg-blue-50 mb-4">
                                <Users size={28} className="text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">Build Relationships</h3>
                            <p className="text-sm text-slate-500">
                                Your contact info stays with the customer forever. 
                                When they need service again, you're one tap away.
                            </p>
                        </div>
                        
                        <div className="text-center">
                            <div className="inline-flex p-4 rounded-2xl bg-purple-50 mb-4">
                                <Shield size={28} className="text-purple-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">Document Your Work</h3>
                            <p className="text-sm text-slate-500">
                                Create a permanent record with photos, warranties, 
                                and details. Protects both you and the customer.
                            </p>
                        </div>
                        
                        <div className="text-center">
                            <div className="inline-flex p-4 rounded-2xl bg-amber-50 mb-4">
                                <Clock size={28} className="text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">Save Time</h3>
                            <p className="text-sm text-slate-500">
                                No more phone calls asking "what did you install?" 
                                Customers have all the details at their fingertips.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* CTA Section */}
            <section className="max-w-4xl mx-auto px-4 py-16 text-center">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">
                    Ready to get started?
                </h2>
                <p className="text-slate-500 mb-8">
                    It's free and takes less than 2 minutes.
                </p>
                <button
                    onClick={handleCreateInvitation}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                    <Gift size={20} />
                    Create Your First Invitation
                </button>
            </section>
            
            {/* Footer */}
            <footer className="bg-slate-100 border-t border-slate-200 py-8">
                <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
                    <p>
                        <strong className="text-slate-700">Krib</strong> helps homeowners 
                        keep track of everything in their home.
                    </p>
                    <p className="mt-2">
                        <a href="/" className="text-emerald-600 hover:underline">Learn more</a>
                        {' · '}
                        <a href="/privacy_policy.html" className="text-emerald-600 hover:underline">Privacy</a>
                        {' · '}
                        <a href="/terms.html" className="text-emerald-600 hover:underline">Terms</a>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ContractorLanding;
