// src/features/invitations/ContractorLanding.jsx
// ============================================
// KRIB PRO LANDING PAGE
// ============================================
// Sales page for contractors - positions Krib Pro as the
// free alternative to Housecall Pro, Jobber, etc.

import React from 'react';
import { 
    ArrowRight, CheckCircle, X,
    FileText, Calendar, Users, Receipt,
    MessageSquare, ClipboardCheck, Camera, Search,
    DollarSign, Clock, TrendingUp, Shield,
    Sparkles, Star, Zap
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';

// ============================================
// FEATURE CARD
// ============================================
const FeatureCard = ({ icon: Icon, title, description, color = 'emerald' }) => {
    const colors = {
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
        purple: 'bg-purple-100 text-purple-600',
        amber: 'bg-amber-100 text-amber-600',
    };
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-emerald-200 transition-all">
            <div className={`inline-flex p-3 rounded-xl mb-4 ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    );
};

// ============================================
// COMPARISON TABLE
// ============================================
const ComparisonTable = () => {
    const features = [
        { name: 'Monthly Cost', krib: 'Free', housecall: '$79+', jobber: '$39+' },
        { name: 'Quotes & Estimates', krib: true, housecall: true, jobber: true },
        { name: 'Job Scheduling', krib: true, housecall: true, jobber: true },
        { name: 'Invoice Generation', krib: true, housecall: true, jobber: true },
        { name: 'Customer Management', krib: true, housecall: true, jobber: true },
        { name: 'Team Dispatch Board', krib: true, housecall: true, jobber: true },
        { name: 'Photo Evaluations', krib: true, housecall: false, jobber: false },
        { name: 'Customer Home Records', krib: true, housecall: false, jobber: false },
        { name: 'Builds Customer Loyalty', krib: true, housecall: false, jobber: false },
    ];
    
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-4 px-4 font-bold text-slate-800">Feature</th>
                        <th className="text-center py-4 px-4">
                            <div className="inline-flex flex-col items-center">
                                <span className="font-bold text-emerald-600">Krib Pro</span>
                                <span className="text-xs text-emerald-500 font-medium">Free</span>
                            </div>
                        </th>
                        <th className="text-center py-4 px-4">
                            <div className="inline-flex flex-col items-center">
                                <span className="font-medium text-slate-600">Housecall Pro</span>
                                <span className="text-xs text-slate-400">$79/mo</span>
                            </div>
                        </th>
                        <th className="text-center py-4 px-4">
                            <div className="inline-flex flex-col items-center">
                                <span className="font-medium text-slate-600">Jobber</span>
                                <span className="text-xs text-slate-400">$39/mo</span>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {features.map((feature, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="py-3 px-4 text-sm text-slate-700">{feature.name}</td>
                            <td className="py-3 px-4 text-center">
                                {typeof feature.krib === 'boolean' ? (
                                    feature.krib ? (
                                        <CheckCircle size={20} className="inline text-emerald-500" />
                                    ) : (
                                        <X size={20} className="inline text-slate-300" />
                                    )
                                ) : (
                                    <span className="font-bold text-emerald-600">{feature.krib}</span>
                                )}
                            </td>
                            <td className="py-3 px-4 text-center">
                                {typeof feature.housecall === 'boolean' ? (
                                    feature.housecall ? (
                                        <CheckCircle size={20} className="inline text-slate-400" />
                                    ) : (
                                        <X size={20} className="inline text-slate-300" />
                                    )
                                ) : (
                                    <span className="text-slate-600">{feature.housecall}</span>
                                )}
                            </td>
                            <td className="py-3 px-4 text-center">
                                {typeof feature.jobber === 'boolean' ? (
                                    feature.jobber ? (
                                        <CheckCircle size={20} className="inline text-slate-400" />
                                    ) : (
                                        <X size={20} className="inline text-slate-300" />
                                    )
                                ) : (
                                    <span className="text-slate-600">{feature.jobber}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ============================================
// FAQ ITEM
// ============================================
const FAQItem = ({ question, answer }) => (
    <div className="border-b border-slate-200 py-6">
        <h3 className="font-bold text-slate-800 mb-2">{question}</h3>
        <p className="text-slate-600">{answer}</p>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const ContractorLanding = () => {
    
    const handleGetStarted = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'dashboard');
        window.location.href = url.toString();
    };
    
    const handleSignIn = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'dashboard');
        window.location.href = url.toString();
    };
    
    return (
        <div className="contractor-page min-h-screen bg-white">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-9 w-9" />
                        <div>
                            <span className="font-bold text-slate-800">krib</span>
                            <span className="ml-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">PRO</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="/" className="text-sm text-slate-500 hover:text-slate-700 hidden sm:inline">
                            For Homeowners
                        </a>
                        <button
                            onClick={handleSignIn}
                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-emerald-600 transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={handleGetStarted}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            Get Started Free
                        </button>
                    </div>
                </div>
            </header>
            
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 md:py-28">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
                            <Sparkles size={14} />
                            100% Free — No credit card required
                        </div>
                        
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
                            The free alternative to<br />
                            <span className="text-emerald-400">Housecall Pro</span>
                        </h1>
                        
                        <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                            Quotes, scheduling, invoices, and customer management. 
                            Everything you need to run your business — without the $100/month price tag.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleGetStarted}
                                className="px-8 py-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-500/25"
                            >
                                Start Free Today
                                <ArrowRight size={20} />
                            </button>
                            
                                href="?pro=compare"
                                className="px-8 py-4 border border-slate-600 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                Compare to Housecall Pro
                            </a>
                        </div>
                        
                        <p className="mt-6 text-sm text-slate-400">
                            Join 500+ contractors already using Krib Pro
                        </p>
                    </div>
                </div>
            </section>
            
            {/* Social Proof Bar */}
            <section className="bg-slate-50 border-y border-slate-200 py-6">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
                        <div>
                            <p className="text-2xl font-bold text-slate-800">$0/mo</p>
                            <p className="text-sm text-slate-500">Forever free</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">2 min</p>
                            <p className="text-sm text-slate-500">Setup time</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">$1,200+</p>
                            <p className="text-sm text-slate-500">Saved per year</p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Features Grid */}
            <section id="features" className="py-20">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Everything you need. Nothing you don't.
                        </h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">
                            Professional tools built for contractors who want to grow their business without the overhead.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeatureCard
                            icon={FileText}
                            title="Professional Quotes"
                            description="Create and send beautiful quotes in minutes. Track views and get notified when accepted."
                            color="emerald"
                        />
                        <FeatureCard
                            icon={Calendar}
                            title="Smart Scheduling"
                            description="Offer time slots, manage your calendar, and dispatch your team from one place."
                            color="blue"
                        />
                        <FeatureCard
                            icon={Receipt}
                            title="Invoice Generation"
                            description="Convert quotes to invoices instantly. Share via link and track payment status."
                            color="purple"
                        />
                        <FeatureCard
                            icon={Users}
                            title="Customer Management"
                            description="Keep track of every customer, their properties, and complete job history."
                            color="amber"
                        />
                        <FeatureCard
                            icon={Camera}
                            title="Photo Evaluations"
                            description="Request photos before quoting complex jobs. Get the info you need upfront."
                            color="blue"
                        />
                        <FeatureCard
                            icon={MessageSquare}
                            title="Customer Messaging"
                            description="Chat with customers directly. Keep all communication in one place."
                            color="purple"
                        />
                        <FeatureCard
                            icon={Search}
                            title="Find Work"
                            description="Browse service requests from homeowners in your area looking for help."
                            color="amber"
                        />
                        <FeatureCard
                            icon={ClipboardCheck}
                            title="Job Completion"
                            description="Document completed work with photos. Records sync to customer's home profile."
                            color="emerald"
                        />
                    </div>
                </div>
            </section>
            
            {/* Differentiator Section */}
            <section className="bg-emerald-600 text-white py-20">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl font-bold mb-6">
                            The difference: Every job builds your customer network
                        </h2>
                        <p className="text-emerald-100 text-lg mb-8 leading-relaxed">
                            Other tools just help you manage jobs. Krib Pro creates a lasting connection. 
                            Every quote you send, every job you complete — it all becomes part of your 
                            customer's permanent home record. When they need service again, you're already there.
                        </p>
                        <div className="grid md:grid-cols-3 gap-8 mt-12">
                            <div>
                                <div className="text-4xl font-bold mb-2">3x</div>
                                <p className="text-emerald-200">More repeat customers</p>
                            </div>
                            <div>
                                <div className="text-4xl font-bold mb-2">1 tap</div>
                                <p className="text-emerald-200">To contact you again</p>
                            </div>
                            <div>
                                <div className="text-4xl font-bold mb-2">Forever</div>
                                <p className="text-emerald-200">Your info stays with them</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Comparison Section */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            See how we compare
                        </h2>
                        <p className="text-slate-500 mb-4">
                            Same features. Better price. Unique benefits.
                        </p>
                        <a 
                            href="?pro=compare" 
                            className="text-emerald-600 font-medium hover:text-emerald-700 underline"
                        >
                            View full comparison with savings calculator →
                        </a>
                    </div>
                    
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <ComparisonTable />
                    </div>
                </div>
            </section>
            
            {/* FAQ Section */}
            <section className="py-20">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Frequently asked questions
                        </h2>
                    </div>
                    
                    <div>
                        <FAQItem
                            question="Why is Krib Pro free?"
                            answer="We believe every contractor deserves professional tools, regardless of budget. Krib Pro is free because we make money through optional premium features and partnerships with home service providers — never by charging you a monthly fee for the basics."
                        />
                        <FAQItem
                            question="What's the catch?"
                            answer="No catch. The core tools — quotes, scheduling, invoicing, customer management — are free forever. We'll eventually offer premium add-ons for larger teams, but the features you see today will always be free."
                        />
                        <FAQItem
                            question="How is this different from other contractor software?"
                            answer="Most tools focus only on the contractor. Krib Pro connects you to your customers' homes. Every job you complete becomes part of their permanent home record, with your info attached. When they need service again — or when their neighbor asks for a referral — you're already there."
                        />
                        <FAQItem
                            question="Can I switch from Housecall Pro or Jobber?"
                            answer="Yes! You can start using Krib Pro today alongside your existing tools, or switch completely. Your customer data stays yours, and we're adding import tools to make switching even easier."
                        />
                        <FAQItem
                            question="Is my data secure?"
                            answer="Absolutely. We use industry-standard encryption and never sell your data. Your customer relationships are your business — we're just here to help you manage them."
                        />
                    </div>
                </div>
            </section>
            
            {/* Final CTA */}
            <section className="bg-slate-900 text-white py-20">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">
                        Ready to stop paying for contractor software?
                    </h2>
                    <p className="text-slate-400 text-lg mb-8">
                        Join hundreds of contractors who've made the switch. Free forever.
                    </p>
                    <button
                        onClick={handleGetStarted}
                        className="px-10 py-5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-colors text-lg shadow-lg shadow-emerald-500/25"
                    >
                        Get Started Free
                    </button>
                    <p className="mt-6 text-sm text-slate-500">
                        No credit card required · Setup in 2 minutes
                    </p>
                </div>
            </section>
            
            {/* Footer */}
            <footer className="bg-slate-950 text-slate-400 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Logo className="h-8 w-8" variant="white" />
                            <div>
                                <span className="font-bold text-white">krib</span>
                                <span className="ml-1 text-xs font-bold text-emerald-400">PRO</span>
                            </div>
                        </div>
                        <div className="flex gap-6 text-sm">
                            <a href="/" className="hover:text-white transition-colors">For Homeowners</a>
                            <a href="/privacy_policy.html" className="hover:text-white transition-colors">Privacy</a>
                            <a href="/terms.html" className="hover:text-white transition-colors">Terms</a>
                            <a href="mailto:support@mykrib.app" className="hover:text-white transition-colors">Support</a>
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm">
                        <p>© {new Date().getFullYear()} Krib. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ContractorLanding;
