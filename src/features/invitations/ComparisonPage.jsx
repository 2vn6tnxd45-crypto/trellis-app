// src/features/invitations/ComparisonPage.jsx
// ============================================
// SEO COMPARISON PAGE
// ============================================
// Targets searches like "Housecall Pro alternative"
// "free contractor software" "Jobber vs" etc.

import React from 'react';
import { 
    CheckCircle, X, ArrowRight, Star,
    DollarSign, Users, Calendar, FileText,
    Receipt, MessageSquare, Camera, Clock,
    Shield, Zap, Heart, TrendingUp
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';

// ============================================
// COMPARISON TABLE
// ============================================
const DetailedComparison = () => {
    const categories = [
        {
            name: 'Pricing',
            features: [
                { name: 'Monthly Cost', krib: 'Free forever', housecall: '$79 - $189/mo', jobber: '$39 - $249/mo' },
                { name: 'Per-User Fees', krib: 'None', housecall: '$40/user', jobber: '$29/user' },
                { name: 'Free Trial', krib: 'N/A (always free)', housecall: '14 days', jobber: '14 days' },
                { name: 'Hidden Fees', krib: 'None', housecall: 'Payment processing', jobber: 'Payment processing' },
            ]
        },
        {
            name: 'Core Features',
            features: [
                { name: 'Quote Builder', krib: true, housecall: true, jobber: true },
                { name: 'Online Scheduling', krib: true, housecall: true, jobber: true },
                { name: 'Invoice Generation', krib: true, housecall: true, jobber: true },
                { name: 'Customer Database', krib: true, housecall: true, jobber: true },
                { name: 'Job Tracking', krib: true, housecall: true, jobber: true },
                { name: 'Mobile App', krib: true, housecall: true, jobber: true },
            ]
        },
        {
            name: 'Team Features',
            features: [
                { name: 'Dispatch Board', krib: true, housecall: true, jobber: true },
                { name: 'Team Calendar', krib: true, housecall: true, jobber: true },
                { name: 'Technician Assignment', krib: true, housecall: true, jobber: true },
                { name: 'Route Optimization', krib: 'Coming soon', housecall: true, jobber: true },
            ]
        },
        {
            name: 'Unique to Krib',
            features: [
                { name: 'Photo Evaluations', krib: true, housecall: false, jobber: false },
                { name: 'Customer Home Records', krib: true, housecall: false, jobber: false },
                { name: 'Automatic Referral Network', krib: true, housecall: false, jobber: false },
                { name: 'Lifetime Customer Connection', krib: true, housecall: false, jobber: false },
            ]
        },
    ];

    const renderValue = (value, isKrib = false) => {
        if (typeof value === 'boolean') {
            return value ? (
                <CheckCircle size={20} className={isKrib ? 'text-emerald-500' : 'text-slate-400'} />
            ) : (
                <X size={20} className="text-slate-300" />
            );
        }
        return <span className={isKrib ? 'font-bold text-emerald-600' : 'text-slate-600'}>{value}</span>;
    };

    return (
        <div className="space-y-8">
            {categories.map((category) => (
                <div key={category.name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800">{category.name}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-3 px-6 text-sm font-medium text-slate-500">Feature</th>
                                    <th className="text-center py-3 px-4 text-sm font-bold text-emerald-600">Krib Pro</th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Housecall Pro</th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Jobber</th>
                                </tr>
                            </thead>
                            <tbody>
                                {category.features.map((feature, idx) => (
                                    <tr key={feature.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="py-3 px-6 text-sm text-slate-700">{feature.name}</td>
                                        <td className="py-3 px-4 text-center">{renderValue(feature.krib, true)}</td>
                                        <td className="py-3 px-4 text-center">{renderValue(feature.housecall)}</td>
                                        <td className="py-3 px-4 text-center">{renderValue(feature.jobber)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// SAVINGS CALCULATOR
// ============================================
const SavingsCalculator = () => {
    const [users, setUsers] = React.useState(1);
    
    const housecallCost = 79 + (users > 1 ? (users - 1) * 40 : 0);
    const jobberCost = 39 + (users > 1 ? (users - 1) * 29 : 0);
    const avgCompetitorCost = Math.round((housecallCost + jobberCost) / 2);
    const yearlySavings = avgCompetitorCost * 12;
    
    return (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-2">Calculate Your Savings</h3>
            <p className="text-emerald-100 mb-6">See how much you'd save by switching to Krib Pro</p>
            
            <div className="bg-white/10 rounded-xl p-6 mb-6">
                <label className="block text-emerald-100 text-sm mb-2">How many users do you need?</label>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={users}
                        onChange={(e) => setUsers(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-2xl font-bold w-12 text-center">{users}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-emerald-200 text-sm">Housecall Pro</p>
                    <p className="text-2xl font-bold">${housecallCost}/mo</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-emerald-200 text-sm">Jobber</p>
                    <p className="text-2xl font-bold">${jobberCost}/mo</p>
                </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center">
                <p className="text-slate-500 text-sm mb-1">Your yearly savings with Krib Pro</p>
                <p className="text-4xl font-extrabold text-emerald-600">${yearlySavings.toLocaleString()}</p>
                <p className="text-slate-400 text-sm mt-1">That's ${avgCompetitorCost}/month back in your pocket</p>
            </div>
        </div>
    );
};

// ============================================
// TESTIMONIAL CARD
// ============================================
const TestimonialCard = ({ quote, author, role, rating = 5 }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex gap-1 mb-4">
            {[...Array(rating)].map((_, i) => (
                <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
            ))}
        </div>
        <p className="text-slate-700 mb-4 italic">"{quote}"</p>
        <div>
            <p className="font-bold text-slate-800">{author}</p>
            <p className="text-sm text-slate-500">{role}</p>
        </div>
    </div>
);

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export const ComparisonPage = () => {
    
    const handleGetStarted = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'dashboard');
        window.location.href = url.toString();
    };
    
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <a href="?pro" className="flex items-center gap-3">
                        <Logo className="h-9 w-9" />
                        <div>
                            <span className="font-bold text-slate-800">krib</span>
                            <span className="ml-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">PRO</span>
                        </div>
                    </a>
                    <button
                        onClick={handleGetStarted}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Get Started Free
                    </button>
                </div>
            </header>
            
            {/* Hero */}
            <section className="bg-white py-16 md:py-24 border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                        The Best Free Alternative to<br />
                        <span className="text-emerald-600">Housecall Pro & Jobber</span>
                    </h1>
                    <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
                        Why pay $100+/month for contractor software? Krib Pro gives you quotes, 
                        scheduling, invoicing, and customer management — completely free.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleGetStarted}
                            className="px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-600/20"
                        >
                            Switch to Krib Pro Free
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </section>
            
            {/* Trust Signals */}
            <section className="bg-emerald-600 py-6">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-white text-center">
                        <div>
                            <p className="text-2xl font-bold">500+</p>
                            <p className="text-emerald-100 text-sm">Contractors</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">$0</p>
                            <p className="text-emerald-100 text-sm">Monthly Fee</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">2 min</p>
                            <p className="text-emerald-100 text-sm">Setup Time</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">4.9★</p>
                            <p className="text-emerald-100 text-sm">User Rating</p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Why Switch */}
            <section className="py-16 md:py-24">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Why contractors are switching to Krib Pro
                        </h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">
                            Same professional features. Zero monthly cost. Plus unique benefits you won't find anywhere else.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                                <DollarSign size={24} />
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg mb-2">Save $1,200+/year</h3>
                            <p className="text-slate-500">
                                Stop paying monthly fees for basic tools. Krib Pro is free forever — 
                                we make money other ways, never by charging you.
                            </p>
                        </div>
                        
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                                <Users size={24} />
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg mb-2">Build Lifetime Relationships</h3>
                            <p className="text-slate-500">
                                Every job you complete becomes part of your customer's home record. 
                                When they need service again, you're already there.
                            </p>
                        </div>
                        
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="bg-purple-100 text-purple-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                                <Zap size={24} />
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg mb-2">Get Started in 2 Minutes</h3>
                            <p className="text-slate-500">
                                No complex setup. No training required. Sign up, create your first quote, 
                                and you're in business.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Detailed Comparison */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Feature-by-feature comparison
                        </h2>
                        <p className="text-slate-500">
                            See exactly what you get with each platform
                        </p>
                    </div>
                    
                    <DetailedComparison />
                </div>
            </section>
            
            {/* Savings Calculator */}
            <section className="py-16 md:py-24">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-4">
                                See how much you'll save
                            </h2>
                            <p className="text-slate-500 mb-6">
                                Most contractors save $500 to $2,000+ per year by switching to Krib Pro. 
                                The bigger your team, the more you save.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-slate-700">
                                    <CheckCircle size={20} className="text-emerald-500" />
                                    No per-user fees
                                </li>
                                <li className="flex items-center gap-3 text-slate-700">
                                    <CheckCircle size={20} className="text-emerald-500" />
                                    No feature tiers or upsells
                                </li>
                                <li className="flex items-center gap-3 text-slate-700">
                                    <CheckCircle size={20} className="text-emerald-500" />
                                    No hidden transaction fees
                                </li>
                            </ul>
                        </div>
                        <SavingsCalculator />
                    </div>
                </div>
            </section>
            
            {/* Testimonials */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            What contractors are saying
                        </h2>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                        <TestimonialCard
                            quote="I was paying $99/month for Housecall Pro. Krib Pro does everything I need for free. Wish I'd found it sooner."
                            author="Mike R."
                            role="HVAC Contractor"
                        />
                        <TestimonialCard
                            quote="The customer connection feature is genius. My repeat business has gone up because customers can find me right from their home records."
                            author="Sarah T."
                            role="Plumbing Company Owner"
                        />
                        <TestimonialCard
                            quote="Setup took 5 minutes. Sent my first professional quote the same day. No learning curve at all."
                            author="James L."
                            role="Electrician"
                        />
                    </div>
                </div>
            </section>
            
            {/* FAQ */}
            <section className="py-16 md:py-24">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Common questions about switching
                        </h2>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-800 mb-2">Can I import my data from Housecall Pro or Jobber?</h3>
                            <p className="text-slate-600">We're building import tools now. In the meantime, most contractors just start fresh — it only takes a few minutes to add your customers as you work with them.</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-800 mb-2">Why is Krib Pro free when others charge $50-200/month?</h3>
                            <p className="text-slate-600">We make money through optional premium features and partnerships — not by charging you monthly fees for basic tools every contractor needs. The core platform will always be free.</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-800 mb-2">Is Krib Pro really as good as the paid options?</h3>
                            <p className="text-slate-600">For most contractors, yes. We have quotes, scheduling, invoicing, customer management, and team dispatch. Some enterprise features are still coming, but for small to mid-size operations, you won't miss anything.</p>
                        </div>
                        
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="font-bold text-slate-800 mb-2">What's the catch?</h3>
                            <p className="text-slate-600">No catch. We want Krib to be on every job you complete. The more contractors using Krib, the more valuable our homeowner network becomes. That's our business model — not monthly fees.</p>
                        </div>
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
                        No credit card required · Setup in 2 minutes · Cancel anytime (but you won't)
                    </p>
                </div>
            </section>
            
            {/* Footer */}
            <footer className="bg-slate-950 text-slate-400 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Logo className="h-8 w-8" />
                            <div>
                                <span className="font-bold text-white">krib</span>
                                <span className="ml-1 text-xs font-bold text-emerald-400">PRO</span>
                            </div>
                        </div>
                        <div className="flex gap-6 text-sm">
                            <a href="?pro" className="hover:text-white transition-colors">Krib Pro Home</a>
                            <a href="/" className="hover:text-white transition-colors">For Homeowners</a>
                            <a href="/privacy_policy.html" className="hover:text-white transition-colors">Privacy</a>
                            <a href="/terms.html" className="hover:text-white transition-colors">Terms</a>
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

export default ComparisonPage;
