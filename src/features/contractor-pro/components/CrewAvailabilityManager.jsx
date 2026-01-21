// src/features/contractor-pro/components/CrewAvailabilityManager.jsx
// ============================================
// CREW AVAILABILITY MANAGEMENT
// ============================================
// Allows crew members to:
// - Mark themselves sick
// - Block time for appointments
// - Set recurring unavailability
// - Connect Google Calendar

import React, { useState, useMemo } from 'react';
import {
    X, Calendar, Clock, AlertCircle, Plus, Trash2,
    RefreshCw, User, CalendarX, CalendarCheck, ChevronDown,
    Thermometer, Users, Car, Building, Repeat, ExternalLink,
    CheckCircle
} from 'lucide-react';
import {
    AVAILABILITY_BLOCK_TYPES,
    CALENDAR_SYNC_STATUS,
    addAvailabilityBlock,
    removeAvailabilityBlock,
    markSickToday,
    blockPartialDay,
    createRecurringBlock,
    initGoogleCalendarConnect
} from '../lib/calendarIntegrationService';
import toast from 'react-hot-toast';

// ============================================
// BLOCK TYPE OPTIONS
// ============================================

const BLOCK_TYPE_OPTIONS = [
    { id: AVAILABILITY_BLOCK_TYPES.PERSONAL, label: 'Personal', icon: User, color: 'bg-slate-100 text-slate-700' },
    { id: AVAILABILITY_BLOCK_TYPES.DOCTOR, label: 'Medical', icon: Thermometer, color: 'bg-red-100 text-red-700' },
    { id: AVAILABILITY_BLOCK_TYPES.FAMILY, label: 'Family', icon: Users, color: 'bg-blue-100 text-blue-700' },
    { id: AVAILABILITY_BLOCK_TYPES.TRAINING, label: 'Training', icon: Building, color: 'bg-purple-100 text-purple-700' },
    { id: AVAILABILITY_BLOCK_TYPES.SICK, label: 'Sick', icon: Thermometer, color: 'bg-orange-100 text-orange-700' },
    { id: AVAILABILITY_BLOCK_TYPES.RECURRING, label: 'Recurring', icon: Repeat, color: 'bg-indigo-100 text-indigo-700' }
];

// ============================================
// QUICK SICK DAY BUTTON
// ============================================

const QuickSickButton = ({ techId, contractorId, onSuccess }) => {
    const [loading, setLoading] = useState(false);

    const handleSickDay = async () => {
        setLoading(true);
        try {
            const result = await markSickToday(contractorId, techId, 'manual');
            if (result.success) {
                toast.success('Marked as sick for today');
                onSuccess?.();
            } else {
                toast.error(result.error || 'Failed to mark sick');
            }
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSickDay}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50"
        >
            <Thermometer size={16} />
            {loading ? 'Marking...' : 'Call in Sick Today'}
        </button>
    );
};

// ============================================
// ADD BLOCK FORM
// ============================================

const AddBlockForm = ({ techId, contractorId, onSuccess, onCancel }) => {
    const [blockType, setBlockType] = useState(AVAILABILITY_BLOCK_TYPES.PERSONAL);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [isAllDay, setIsAllDay] = useState(true);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringDay, setRecurringDay] = useState('monday');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let result;

            if (isRecurring) {
                result = await createRecurringBlock(
                    contractorId,
                    techId,
                    recurringDay,
                    isAllDay ? null : startTime,
                    isAllDay ? null : endTime,
                    title || `Weekly block (${recurringDay})`,
                    'manual'
                );
            } else {
                result = await addAvailabilityBlock(contractorId, {
                    techId,
                    type: blockType,
                    startDate,
                    endDate: endDate || startDate,
                    startTime: isAllDay ? null : startTime,
                    endTime: isAllDay ? null : endTime,
                    title: title || BLOCK_TYPE_OPTIONS.find(o => o.id === blockType)?.label,
                    notes,
                    source: 'manual'
                });
            }

            if (result.success) {
                toast.success('Availability block added');
                onSuccess?.();
            } else {
                toast.error(result.error || 'Failed to add block');
            }
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-800">Add Unavailability</h4>
                <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                </button>
            </div>

            {/* Block Type */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                    {BLOCK_TYPE_OPTIONS.filter(o => o.id !== AVAILABILITY_BLOCK_TYPES.SICK).map(option => {
                        const Icon = option.icon;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                    setBlockType(option.id);
                                    setIsRecurring(option.id === AVAILABILITY_BLOCK_TYPES.RECURRING);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    blockType === option.id
                                        ? option.color + ' ring-2 ring-offset-1 ring-slate-400'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                <Icon size={14} />
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Recurring Day Selection */}
            {isRecurring ? (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Every</label>
                    <select
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="monday">Monday</option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                        <option value="saturday">Saturday</option>
                        <option value="sunday">Sunday</option>
                    </select>
                </div>
            ) : (
                /* Date Selection */
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            placeholder="Same day"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
            )}

            {/* All Day Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">All day</span>
            </label>

            {/* Time Selection (if not all day) */}
            {!isAllDay && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
            )}

            {/* Title & Notes */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Doctor appointment, etc."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                    {loading ? 'Adding...' : 'Add Block'}
                </button>
            </div>
        </form>
    );
};

// ============================================
// BLOCK LIST ITEM
// ============================================

const BlockItem = ({ block, onDelete }) => {
    const [deleting, setDeleting] = useState(false);
    const typeOption = BLOCK_TYPE_OPTIONS.find(o => o.id === block.type) || BLOCK_TYPE_OPTIONS[0];
    const Icon = typeOption.icon;

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await onDelete(block.id);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeOption.color}`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{block.title}</p>
                <p className="text-xs text-slate-500">
                    {block.isRecurring ? (
                        <span className="flex items-center gap-1">
                            <Repeat size={10} />
                            Weekly
                        </span>
                    ) : (
                        <>
                            {formatDate(block.startDate)}
                            {block.endDate !== block.startDate && ` - ${formatDate(block.endDate)}`}
                        </>
                    )}
                    {!block.isAllDay && block.startTime && (
                        <span className="ml-2">
                            {formatTime(block.startTime)} - {formatTime(block.endTime)}
                        </span>
                    )}
                    {block.isAllDay && <span className="ml-2 text-slate-400">(All day)</span>}
                </p>
            </div>
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

// ============================================
// GOOGLE CALENDAR CONNECT SECTION
// ============================================

const GoogleCalendarSection = ({ tech, contractorId, onUpdate }) => {
    const calendarStatus = tech.calendarConfig?.status || CALENDAR_SYNC_STATUS.NOT_CONNECTED;
    const [connecting, setConnecting] = useState(false);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const result = await initGoogleCalendarConnect(contractorId, tech.id);
            if (result.authUrl) {
                window.location.href = result.authUrl;
            } else {
                toast('Google Calendar integration coming soon!', { icon: 'info' });
            }
        } finally {
            setConnecting(false);
        }
    };

    return (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-blue-200">
                    <Calendar className="text-blue-600" size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-slate-800">Google Calendar Sync</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                        {calendarStatus === CALENDAR_SYNC_STATUS.CONNECTED
                            ? 'Connected - Jobs sync automatically'
                            : 'Connect to sync jobs to personal calendar & import busy times'
                        }
                    </p>

                    {calendarStatus === CALENDAR_SYNC_STATUS.CONNECTED ? (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle size={12} />
                                Connected
                            </span>
                            <span className="text-slate-300">|</span>
                            <button className="text-xs text-slate-500 hover:text-red-600">
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50"
                        >
                            <ExternalLink size={14} />
                            {connecting ? 'Connecting...' : 'Connect Google Calendar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CrewAvailabilityManager = ({
    tech,
    contractorId,
    availabilityBlocks = [],
    onClose,
    onUpdate
}) => {
    const [showAddForm, setShowAddForm] = useState(false);

    // Filter blocks for this tech
    const techBlocks = useMemo(() => {
        return availabilityBlocks
            .filter(b => b.techId === tech.id && b.status === 'active')
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }, [availabilityBlocks, tech.id]);

    // Upcoming blocks (next 30 days)
    const upcomingBlocks = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const future = futureDate.toISOString().split('T')[0];

        return techBlocks.filter(b =>
            b.endDate >= today && b.startDate <= future
        );
    }, [techBlocks]);

    // Recurring blocks
    const recurringBlocks = useMemo(() => {
        return techBlocks.filter(b => b.isRecurring);
    }, [techBlocks]);

    const handleDeleteBlock = async (blockId) => {
        const result = await removeAvailabilityBlock(contractorId, blockId);
        if (result.success) {
            toast.success('Block removed');
            onUpdate?.();
        } else {
            toast.error(result.error || 'Failed to remove block');
        }
    };

    const handleSuccess = () => {
        setShowAddForm(false);
        onUpdate?.();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: tech.color || '#64748B' }}
                        >
                            {tech.name?.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">{tech.name}</h2>
                            <p className="text-xs text-slate-500">Manage Availability</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                        <QuickSickButton
                            techId={tech.id}
                            contractorId={contractorId}
                            onSuccess={onUpdate}
                        />
                        {!showAddForm && (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-medium hover:bg-emerald-100"
                            >
                                <Plus size={16} />
                                Block Time
                            </button>
                        )}
                    </div>

                    {/* Add Block Form */}
                    {showAddForm && (
                        <AddBlockForm
                            techId={tech.id}
                            contractorId={contractorId}
                            onSuccess={handleSuccess}
                            onCancel={() => setShowAddForm(false)}
                        />
                    )}

                    {/* Google Calendar */}
                    <GoogleCalendarSection
                        tech={tech}
                        contractorId={contractorId}
                        onUpdate={onUpdate}
                    />

                    {/* Upcoming Blocks */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <CalendarX size={14} />
                            Upcoming Unavailability
                        </h3>
                        {upcomingBlocks.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center bg-slate-50 rounded-lg">
                                No scheduled unavailability
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {upcomingBlocks.map(block => (
                                    <BlockItem
                                        key={block.id}
                                        block={block}
                                        onDelete={handleDeleteBlock}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recurring Blocks */}
                    {recurringBlocks.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Repeat size={14} />
                                Recurring Blocks
                            </h3>
                            <div className="space-y-2">
                                {recurringBlocks.map(block => (
                                    <BlockItem
                                        key={block.id}
                                        block={block}
                                        onDelete={handleDeleteBlock}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Working Hours Summary */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Clock size={14} />
                            Working Hours
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-3">
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                                    const dayName = day.toLowerCase() + (day === 'Sun' || day === 'Sat' ? 'day' : 'day');
                                    const fullDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][i];
                                    const hours = tech.workingHours?.[fullDayName];
                                    const isEnabled = hours?.enabled !== false;

                                    return (
                                        <div
                                            key={day}
                                            className={`py-2 rounded text-xs ${
                                                isEnabled
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-200 text-slate-400'
                                            }`}
                                        >
                                            <div className="font-medium">{day}</div>
                                            {isEnabled && hours?.start && (
                                                <div className="text-[10px] mt-0.5 opacity-75">
                                                    {hours.start.split(':')[0]}-{hours.end?.split(':')[0]}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CrewAvailabilityManager;
