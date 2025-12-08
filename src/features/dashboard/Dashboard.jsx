// src/features/dashboard/Dashboard.jsx
import React, { useState, useMemo } from 'react';
import { 
    Camera, CheckCircle2, ShoppingCart, AlertCircle, Clock, ChevronRight,
    ChevronDown, ChevronUp, Sparkles, Calendar, DollarSign, Wrench,
    ThermometerSun, Snowflake, Leaf, Sun, Bell, ExternalLink, Package,
    Shield, Link as LinkIcon, PiggyBank, Receipt, Plus, MapPin 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';

// Helper functions
const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    while (next < new Date()) next.setMonth(next.getMonth() + freq.months);
    return next;
};

const getCurrentSeason = () => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
};

const getSeasonIcon = (season) => {
    const icons = { spring: <Leaf className="h-5 w-5 text-green-500" />, summer: <Sun className="h-5 w-5 text-yellow-500" />, fall: <Leaf className="h-5 w-5 text-orange-500" />, winter: <Snowflake className="h-5 w-5 text-blue-500" /> };
    return icons[season] || <Calendar className="h-5 w-5 text-slate-500" />;
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const getCategoryIcon = (category) => {
    const icons = { 'HVAC & Systems': '🌡️', 'Plumbing': '🚰', 'Electrical': '⚡', 'Roof & Exterior': '🏠', 'Appliances': '🔌', 'Paint & Finishes': '🎨', 'Flooring': '🪵', 'Landscaping': '🌳', 'Safety & Security': '🔒', 'Other': '📦' };
    return icons[category] || '📦';
};

const SEASONAL_CHECKLISTS = {
    spring: [
        { id: 'sp1', task: 'Service AC unit before summer', category: 'HVAC', priority: 'high' },
        { id: 'sp2', task: 'Clean gutters and downspouts', category: 'Exterior', priority: 'medium' },
        { id: 'sp3', task: 'Inspect roof for winter damage', category: 'Roof', priority: 'high' },
        { id: 'sp4', task: 'Test sprinkler system', category: 'Landscaping', priority: 'low' },
    ],
    summer: [
        { id: 'su1', task: 'Replace HVAC filters (high usage)', category: 'HVAC', priority: 'high' },
        { id: 'su2', task: 'Check weatherstripping on doors', category: 'Interior', priority: 'medium' },
        { id: 'su3', task: 'Clean dryer vent', category: 'Appliances', priority: 'high' },
    ],
    fall: [
        { id: 'fa1', task: 'Schedule furnace tune-up', category: 'HVAC', priority: 'high' },
        { id: 'fa2', task: 'Clean gutters (falling leaves)', category: 'Exterior', priority: 'high' },
        { id: 'fa3', task: 'Test smoke & CO detectors', category: 'Safety', priority: 'high' },
        { id: 'fa4', task: 'Winterize outdoor faucets', category: 'Plumbing', priority: 'high' },
    ],
    winter: [
        { id: 'wi1', task: 'Check for ice dams on roof', category: 'Roof', priority: 'high' },
        { id: 'wi2', task: 'Replace HVAC filter', category: 'HVAC', priority: 'high' },
        { id: 'wi3', task: 'Check pipe insulation', category: 'Plumbing', priority: 'high' },
    ]
};

// Money Tracker Component
const MoneyTracker = ({ records, onAddExpense }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const spending = useMemo(() => {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        
        const recordsWithCosts = records.filter(r => r.cost && r.cost > 0);
        const thisYearRecords = recordsWithCosts.filter(r => {
            const date = new Date(r.dateInstalled || r.timestamp?.toDate?.() || r.timestamp);
            return date.getFullYear() === thisYear;
        });
        
        const totalThisYear = thisYearRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        const thisMonthRecords = thisYearRecords.filter(r => {
            const date = new Date(r.dateInstalled || r.timestamp?.toDate?.() || r.timestamp);
            return date.getMonth() === thisMonth;
        });
        const totalThisMonth = thisMonthRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        const byCategory = thisYearRecords.reduce((acc
