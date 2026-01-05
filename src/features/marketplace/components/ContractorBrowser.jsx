// src/features/marketplace/components/ContractorBrowser.jsx
// ============================================
// CONTRACTOR BROWSER (MARKETPLACE)
// ============================================
// Allows homeowners to browse, search, and filter
// public contractor profiles. Free to use, ad-supported.

import React, { useState, useEffect } from 'react';
import { 
    Search, MapPin, Star, Filter, ChevronDown, Shield, Award,
    Clock, DollarSign, Phone, Mail, ExternalLink, X, Loader2,
    ThumbsUp, Calendar, CheckCircle, AlertCircle, Briefcase
} from 'lucide-react';
import { 
    SERVICE_CATEGORIES 
} from '../lib/serviceRequestService';
import {
    searchContractors,
    getPublicProfile,
    getContractorReviews,
    getFeaturedContractors
} from '../lib/contractorMarketplaceService';

const ContractorBrowser = ({ 
    userZipCode,
    onSelectContractor,
    onRequestQuote 
}) => {
    // Search/Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [zipCode, setZipCode] = useState(userZipCode || '');
    const [showFilters, setShowFilters] = useState(false);
    
    // Filter options
    const [mustBeInsured, setMustBeInsured] = useState(false);
    const [mustBeLicensed, setMustBeLicensed] = useState(false);
    const [minRating, setMinRating] = useState(0);
    const [emergencyOnly, setEmergencyOnly] = useState(false);
    const [sortBy, setSortBy] = useState('rating');
    
    // Results
    const [contractors, setContractors] = useState([]);
    const [featuredContractors, setFeaturedContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    
    // Selected contractor for detail view
    const [selectedContractor, setSelectedContractor] = useState(null);
    
    // ============================================
    // LOAD CONTRACTORS
    // ============================================
    
    useEffect(() => {
        loadContractors();
        loadFeatured();
    }, [selectedTrade, mustBeInsured, mustBeLicensed, minRating, emergencyOnly, sortBy, zipCode]);
    
    const loadContractors = async () => {
        setLoading(true);
        const result = await searchContractors({
            trade: selectedTrade,
            zipCode,
            mustBeInsured,
            mustBeLicensed,
            minRating: minRating > 0 ? minRating : null,
            emergencyOnly,
            sortBy
        });
        
        if (result.success) {
            setContractors(result.contractors);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        }
        setLoading(false);
    };
    
    const loadMore = async () => {
        if (!hasMore || loadingMore) return;
        
        setLoadingMore(true);
        const result = await searchContractors({
            trade: selectedTrade,
            zipCode,
            mustBeInsured,
            mustBeLicensed,
            minRating: minRating > 0 ? minRating : null,
            emergencyOnly,
            sortBy,
            lastDoc
        });
        
        if (result.success) {
            setContractors(prev => [...prev, ...result.contractors]);
            setLastDoc(result.lastDoc);
            setHasMore(result.hasMore);
        }
        setLoadingMore(false);
    };
    
    const loadFeatured = async () => {
        const result = await getFeaturedContractors(selectedTrade, zipCode, 3);
        if (result.success) {
            setFeaturedContractors(result.contractors);
        }
    };
    
    // Filter contractors by search query (client-side)
    const filteredContractors = searchQuery
        ? contractors.filter(c => 
            c.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.tagline?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : contractors;
    
    // ============================================
    // RENDER
    // ============================================
    
    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Find a Contractor</h1>
                <p className="text-slate-500">Browse verified professionals in your area</p>
            </div>
            
            {/* Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or keyword..."
                        className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                
                <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="ZIP Code"
                        maxLength={5}
                        className="w-full md:w-32 pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`
                        flex items-center px-4 py-3 border rounded-xl transition
                        ${showFilters ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}
                    `}
                >
                    <Filter size={20} className="mr-2" />
                    Filters
                    {(mustBeInsured || mustBeLicensed || minRating > 0 || emergencyOnly) && (
                        <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full" />
                    )}
                </button>
            </div>
            
            {/* Category Pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setSelectedTrade(null)}
                    className={`
                        px-4 py-2 rounded-full font-medium whitespace-nowrap transition
                        ${!selectedTrade 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    All Trades
                </button>
                {SERVICE_CATEGORIES.slice(0, 10).map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedTrade(cat.id)}
                        className={`
                            px-4 py-2 rounded-full font-medium whitespace-nowrap transition
                            ${selectedTrade === cat.id 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }
                        `}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Requirements */}
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={mustBeInsured}
                                onChange={(e) => setMustBeInsured(e.target.checked)}
                                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <Shield size={18} className="ml-2 text-slate-400" />
                            <span className="ml-2 text-slate-700">Insured</span>
                        </label>
                        
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={mustBeLicensed}
                                onChange={(e) => setMustBeLicensed(e.target.checked)}
                                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <Award size={18} className="ml-2 text-slate-400" />
                            <span className="ml-2 text-slate-700">Licensed</span>
                        </label>
                        
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={emergencyOnly}
                                onChange={(e) => setEmergencyOnly(e.target.checked)}
                                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <Clock size={18} className="ml-2 text-slate-400" />
                            <span className="ml-2 text-slate-700">Emergency Available</span>
                        </label>
                        
                        {/* Min Rating */}
                        <div>
                            <label className="text-sm text-slate-500 block mb-1">Min Rating</label>
                            <select
                                value={minRating}
                                onChange={(e) => setMinRating(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                            >
                                <option value={0}>Any</option>
                                <option value={3}>3+ Stars</option>
                                <option value={4}>4+ Stars</option>
                                <option value={4.5}>4.5+ Stars</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Sort */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500">Sort by:</span>
                            {['rating', 'reviews', 'newest'].map(option => (
                                <button
                                    key={option}
                                    onClick={() => setSortBy(option)}
                                    className={`
                                        px-3 py-1 rounded-full text-sm font-medium transition
                                        ${sortBy === option 
                                            ? 'bg-emerald-100 text-emerald-700' 
                                            : 'text-slate-600 hover:bg-slate-100'
                                        }
                                    `}
                                >
                                    {option === 'rating' && 'Top Rated'}
                                    {option === 'reviews' && 'Most Reviews'}
                                    {option === 'newest' && 'Newest'}
                                </button>
                            ))}
                        </div>
                        
                        <button
                            onClick={() => {
                                setMustBeInsured(false);
                                setMustBeLicensed(false);
                                setMinRating(0);
                                setEmergencyOnly(false);
                                setSortBy('rating');
                            }}
                            className="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            )}
            
            {/* Featured (Ad-supported) */}
            {featuredContractors.length > 0 && !searchQuery && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Featured Contractors</h2>
                        <span className="text-xs text-slate-400 uppercase">Sponsored</span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {featuredContractors.map(contractor => (
                            <ContractorCard
                                key={contractor.id}
                                contractor={contractor}
                                featured
                                onClick={() => setSelectedContractor(contractor)}
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {/* Results */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800">
                        {selectedTrade 
                            ? SERVICE_CATEGORIES.find(c => c.id === selectedTrade)?.label 
                            : 'All Contractors'
                        }
                    </h2>
                    <span className="text-slate-500">{filteredContractors.length} found</span>
                </div>
                
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-emerald-600" size={32} />
                    </div>
                ) : filteredContractors.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                        <Search className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Contractors Found</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Try adjusting your filters or search in a different area.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredContractors.map(contractor => (
                                <ContractorCard
                                    key={contractor.id}
                                    contractor={contractor}
                                    onClick={() => setSelectedContractor(contractor)}
                                />
                            ))}
                        </div>
                        
                        {/* Load More */}
                        {hasMore && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                                >
                                    {loadingMore ? (
                                        <>
                                            <Loader2 className="inline animate-spin mr-2" size={18} />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More'
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* Contractor Detail Modal */}
            {selectedContractor && (
                <ContractorDetailModal
                    contractor={selectedContractor}
                    onClose={() => setSelectedContractor(null)}
                    onRequestQuote={() => {
                        onRequestQuote?.(selectedContractor);
                        setSelectedContractor(null);
                    }}
                    onContact={() => {
                        onSelectContractor?.(selectedContractor);
                        setSelectedContractor(null);
                    }}
                />
            )}
        </div>
    );
};

// ============================================
// CONTRACTOR CARD
// ============================================

const ContractorCard = ({ contractor, featured, onClick }) => {
    const primaryTrade = SERVICE_CATEGORIES.find(c => c.id === contractor.primaryTrade);
    
    return (
        <div 
            className={`
                bg-white border rounded-2xl p-5 cursor-pointer transition hover:shadow-md
                ${featured ? 'border-amber-200 ring-2 ring-amber-100' : 'border-slate-200'}
            `}
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start gap-4">
                {contractor.logoUrl ? (
                    <img 
                        src={contractor.logoUrl}
                        alt={contractor.businessName}
                        className="w-14 h-14 rounded-xl object-cover"
                    />
                ) : (
                    <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-emerald-600">
                            {(contractor.businessName || 'C')[0]}
                        </span>
                    </div>
                )}
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 truncate">
                                {contractor.businessName}
                            </h3>
                            {contractor.tagline && (
                                <p className="text-sm text-slate-500 truncate">{contractor.tagline}</p>
                            )}
                        </div>
                        {featured && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                Featured
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Rating */}
            <div className="flex items-center gap-4 mt-4">
                {contractor.averageRating ? (
                    <div className="flex items-center">
                        <Star size={16} className="text-amber-400 mr-1" fill="currentColor" />
                        <span className="font-bold text-slate-800">{contractor.averageRating}</span>
                        <span className="text-slate-400 text-sm ml-1">
                            ({contractor.reviewCount} {contractor.reviewCount === 1 ? 'review' : 'reviews'})
                        </span>
                    </div>
                ) : (
                    <span className="text-slate-400 text-sm">No reviews yet</span>
                )}
            </div>
            
            {/* Trade & Location */}
            <div className="flex flex-wrap gap-2 mt-3">
                {primaryTrade && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        {primaryTrade.label}
                    </span>
                )}
                {contractor.city && (
                    <span className="flex items-center text-xs text-slate-500">
                        <MapPin size={12} className="mr-1" />
                        {contractor.city}
                    </span>
                )}
            </div>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3">
                {contractor.insured && (
                    <span className="flex items-center px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                        <Shield size={12} className="mr-1" /> Insured
                    </span>
                )}
                {contractor.licensed && (
                    <span className="flex items-center px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-full">
                        <Award size={12} className="mr-1" /> Licensed
                    </span>
                )}
                {contractor.emergencyAvailable && (
                    <span className="flex items-center px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full">
                        <Clock size={12} className="mr-1" /> Emergency
                    </span>
                )}
                {contractor.yearsInBusiness && (
                    <span className="flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                        <Briefcase size={12} className="mr-1" /> {contractor.yearsInBusiness} yrs
                    </span>
                )}
            </div>
        </div>
    );
};

// ============================================
// CONTRACTOR DETAIL MODAL
// ============================================

const ContractorDetailModal = ({ contractor, onClose, onRequestQuote, onContact }) => {
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [activeTab, setActiveTab] = useState('about');
    
    const primaryTrade = SERVICE_CATEGORIES.find(c => c.id === contractor.primaryTrade);
    
    useEffect(() => {
        loadReviews();
    }, [contractor.id]);
    
    const loadReviews = async () => {
        setLoadingReviews(true);
        const result = await getContractorReviews(contractor.id, { limitCount: 5 });
        if (result.success) {
            setReviews(result.reviews);
        }
        setLoadingReviews(false);
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="relative">
                    {/* Cover Photo */}
                    {contractor.coverPhotoUrl ? (
                        <div className="h-32 bg-gradient-to-r from-emerald-600 to-emerald-700">
                            <img 
                                src={contractor.coverPhotoUrl}
                                alt=""
                                className="w-full h-full object-cover opacity-50"
                            />
                        </div>
                    ) : (
                        <div className="h-32 bg-gradient-to-r from-emerald-600 to-emerald-700" />
                    )}
                    
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30"
                    >
                        <X size={20} />
                    </button>
                    
                    {/* Profile Info */}
                    <div className="px-6 pb-4 -mt-10">
                        <div className="flex items-end gap-4">
                            {contractor.logoUrl ? (
                                <img 
                                    src={contractor.logoUrl}
                                    alt={contractor.businessName}
                                    className="w-20 h-20 rounded-2xl border-4 border-white object-cover shadow-lg"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl border-4 border-white bg-emerald-100 flex items-center justify-center shadow-lg">
                                    <span className="text-3xl font-bold text-emerald-600">
                                        {(contractor.businessName || 'C')[0]}
                                    </span>
                                </div>
                            )}
                            
                            <div className="flex-1 pb-1">
                                <h2 className="text-xl font-bold text-slate-800">{contractor.businessName}</h2>
                                {contractor.tagline && (
                                    <p className="text-slate-500">{contractor.tagline}</p>
                                )}
                            </div>
                            
                            {/* Rating */}
                            {contractor.averageRating && (
                                <div className="flex items-center bg-amber-50 px-3 py-2 rounded-xl">
                                    <Star size={20} className="text-amber-400 mr-1" fill="currentColor" />
                                    <span className="font-bold text-slate-800">{contractor.averageRating}</span>
                                    <span className="text-slate-500 text-sm ml-1">
                                        ({contractor.reviewCount})
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="border-b border-slate-200 px-6">
                    <div className="flex gap-6">
                        {['about', 'reviews', 'portfolio'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    py-3 font-medium border-b-2 transition capitalize
                                    ${activeTab === tab 
                                        ? 'border-emerald-600 text-emerald-600' 
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'about' && (
                        <div className="space-y-6">
                            {/* About */}
                            {contractor.about && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">About</h3>
                                    <p className="text-slate-700 whitespace-pre-wrap">{contractor.about}</p>
                                </div>
                            )}
                            
                            {/* Services */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Services</h3>
                                <div className="flex flex-wrap gap-2">
                                    {primaryTrade && (
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                            {primaryTrade.label}
                                        </span>
                                    )}
                                    {contractor.additionalTrades?.map(trade => {
                                        const t = SERVICE_CATEGORIES.find(c => c.id === trade);
                                        return t ? (
                                            <span key={trade} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                                                {t.label}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                            
                            {/* Credentials */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Credentials</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {contractor.yearsInBusiness && (
                                        <div className="flex items-center bg-slate-50 p-3 rounded-xl">
                                            <Briefcase size={20} className="text-slate-400 mr-3" />
                                            <div>
                                                <p className="font-bold text-slate-800">{contractor.yearsInBusiness} Years</p>
                                                <p className="text-xs text-slate-500">In Business</p>
                                            </div>
                                        </div>
                                    )}
                                    {contractor.insured && (
                                        <div className="flex items-center bg-blue-50 p-3 rounded-xl">
                                            <Shield size={20} className="text-blue-500 mr-3" />
                                            <div>
                                                <p className="font-bold text-blue-700">Insured</p>
                                                <p className="text-xs text-blue-500">Liability Coverage</p>
                                            </div>
                                        </div>
                                    )}
                                    {contractor.licensed && (
                                        <div className="flex items-center bg-purple-50 p-3 rounded-xl">
                                            <Award size={20} className="text-purple-500 mr-3" />
                                            <div>
                                                <p className="font-bold text-purple-700">Licensed</p>
                                                {contractor.licenseNumber && (
                                                    <p className="text-xs text-purple-500">#{contractor.licenseNumber}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {contractor.bonded && (
                                        <div className="flex items-center bg-emerald-50 p-3 rounded-xl">
                                            <CheckCircle size={20} className="text-emerald-500 mr-3" />
                                            <div>
                                                <p className="font-bold text-emerald-700">Bonded</p>
                                                <p className="text-xs text-emerald-500">Financial Protection</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {contractor.certifications?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {contractor.certifications.map((cert, i) => (
                                            <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-full">
                                                {cert}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Service Area */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Service Area</h3>
                                <div className="flex items-center text-slate-700">
                                    <MapPin size={18} className="mr-2 text-slate-400" />
                                    {contractor.city}, {contractor.state}
                                    {contractor.maxTravelMiles && (
                                        <span className="ml-2 text-slate-500">
                                            (within {contractor.maxTravelMiles} miles)
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Business Info */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Business Info</h3>
                                <div className="space-y-2">
                                    {contractor.freeEstimates && (
                                        <div className="flex items-center text-emerald-600">
                                            <CheckCircle size={16} className="mr-2" />
                                            Free Estimates
                                        </div>
                                    )}
                                    {contractor.emergencyAvailable && (
                                        <div className="flex items-center text-red-600">
                                            <Clock size={16} className="mr-2" />
                                            Emergency Service Available
                                        </div>
                                    )}
                                    {contractor.paymentMethods?.length > 0 && (
                                        <div className="flex items-center text-slate-600">
                                            <DollarSign size={16} className="mr-2 text-slate-400" />
                                            Accepts: {contractor.paymentMethods.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'reviews' && (
                        <div>
                            {loadingReviews ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-emerald-600" size={24} />
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="text-center py-12">
                                    <Star className="mx-auto text-slate-300 mb-4" size={40} />
                                    <p className="text-slate-500">No reviews yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map(review => (
                                        <div key={review.id} className="bg-slate-50 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star 
                                                            key={i}
                                                            size={16}
                                                            className={i < review.rating ? 'text-amber-400' : 'text-slate-200'}
                                                            fill={i < review.rating ? 'currentColor' : 'none'}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-xs text-slate-400">
                                                    {review.createdAt?.toDate?.()?.toLocaleDateString()}
                                                </span>
                                            </div>
                                            {review.title && (
                                                <p className="font-bold text-slate-800 mb-1">{review.title}</p>
                                            )}
                                            {review.comment && (
                                                <p className="text-slate-600 text-sm">{review.comment}</p>
                                            )}
                                            <p className="text-xs text-slate-400 mt-2">
                                                — {review.homeownerName}
                                                {review.verified && (
                                                    <span className="ml-2 text-emerald-600">✓ Verified</span>
                                                )}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'portfolio' && (
                        <div>
                            {contractor.portfolioItems?.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {contractor.portfolioItems.map((item, i) => (
                                        <div key={i} className="relative group">
                                            <img 
                                                src={item.imageUrl}
                                                alt={item.caption || 'Portfolio item'}
                                                className="w-full h-40 object-cover rounded-xl"
                                            />
                                            {item.caption && (
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-end p-3 rounded-xl">
                                                    <p className="text-white text-sm">{item.caption}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Camera className="mx-auto text-slate-300 mb-4" size={40} />
                                    <p className="text-slate-500">No portfolio items yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Actions */}
                <div className="border-t border-slate-200 p-6 flex gap-4">
                    {contractor.showPhone && contractor.phone && (
                        <a
                            href={`tel:${contractor.phone}`}
                            className="flex items-center px-4 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition"
                        >
                            <Phone size={18} className="mr-2" />
                            Call
                        </a>
                    )}
                    
                    <button
                        onClick={onContact}
                        className="flex-1 flex items-center justify-center px-6 py-3 border border-emerald-600 text-emerald-600 font-medium rounded-xl hover:bg-emerald-50 transition"
                    >
                        <Mail size={18} className="mr-2" />
                        Message
                    </button>
                    
                    <button
                        onClick={onRequestQuote}
                        className="flex-1 flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                    >
                        Request Quote
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContractorBrowser;
