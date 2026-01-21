// src/features/tech-mobile/components/DailyHandoffForm.jsx
// ============================================
// DAILY HANDOFF FORM FOR MULTI-DAY JOBS
// ============================================
// Tech fills this out at end of each day to record progress
// and create handoff notes for the next crew/day

import React, { useState } from 'react';
import {
    ClipboardList,
    CheckCircle,
    AlertTriangle,
    Package,
    Clock,
    Camera,
    ChevronDown,
    ChevronUp,
    Plus,
    X,
    Loader2,
    Shield,
    MessageSquare,
    ArrowRight
} from 'lucide-react';
import {
    recordDailyProgress,
    createHandoff,
    DAILY_STATUS,
    HANDOFF_TYPES
} from '../../contractor-pro/lib/multiDayJobService';

// ============================================
// MAIN COMPONENT
// ============================================

export const DailyHandoffForm = ({
    job,
    techId,
    currentSegment,
    onComplete,
    onCancel
}) => {
    const [saving, setSaving] = useState(false);
    const [expandedSection, setExpandedSection] = useState('progress');

    // Form state
    const [hoursWorked, setHoursWorked] = useState(
        Math.round((new Date() - new Date(job.techCheckInTime || Date.now())) / (1000 * 60 * 60) * 10) / 10 || 0
    );
    const [percentComplete, setPercentComplete] = useState(0);
    const [workCompleted, setWorkCompleted] = useState([]);
    const [newWorkItem, setNewWorkItem] = useState('');
    const [workRemaining, setWorkRemaining] = useState([]);
    const [newRemainingItem, setNewRemainingItem] = useState('');
    const [issues, setIssues] = useState([]);
    const [newIssue, setNewIssue] = useState('');
    const [materialsNeeded, setMaterialsNeeded] = useState([]);
    const [newMaterial, setNewMaterial] = useState('');
    const [notes, setNotes] = useState('');
    const [safetyNotes, setSafetyNotes] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');

    // ----------------------------------------
    // Add/Remove list items
    // ----------------------------------------
    const addToList = (list, setList, newItem, setNewItem) => {
        if (newItem.trim()) {
            setList([...list, newItem.trim()]);
            setNewItem('');
        }
    };

    const removeFromList = (list, setList, index) => {
        setList(list.filter((_, i) => i !== index));
    };

    // ----------------------------------------
    // Submit handoff
    // ----------------------------------------
    const handleSubmit = async () => {
        setSaving(true);
        try {
            // Record daily progress
            await recordDailyProgress(job.id, {
                date: currentSegment.date,
                dayNumber: currentSegment.dayNumber,
                crewIds: job.assignedCrewIds || [],
                leadTechId: techId,
                hoursWorked,
                percentComplete: Math.round(percentComplete / job.multiDaySchedule?.totalDays || 1),
                workCompleted,
                issuesEncountered: issues,
                notes,
                status: DAILY_STATUS.COMPLETED
            });

            // Create handoff for next day
            await createHandoff(job.id, {
                type: HANDOFF_TYPES.END_OF_DAY,
                fromCrewIds: job.assignedCrewIds || [],
                fromLeadTech: techId,
                toCrewIds: job.assignedCrewIds || [], // Same crew by default
                toLeadTech: job.assignedTechId,
                date: currentSegment.date,
                dayNumber: currentSegment.dayNumber,
                workCompletedToday: workCompleted,
                workRemainingTomorrow: workRemaining,
                issues,
                materialsNeeded,
                safetyNotes,
                customerNotes
            });

            onComplete?.();
        } catch (error) {
            console.error('Error submitting handoff:', error);
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------
    // Section toggle
    // ----------------------------------------
    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    // ----------------------------------------
    // Render
    // ----------------------------------------
    return (
        <div className="bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">End of Day Handoff</h2>
                        <p className="text-white/80 text-sm">
                            Day {currentSegment?.dayNumber} of {job.multiDaySchedule?.totalDays}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-white/20 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Progress Section */}
                <CollapsibleSection
                    title="Today's Progress"
                    icon={ClipboardList}
                    expanded={expandedSection === 'progress'}
                    onToggle={() => toggleSection('progress')}
                    color="emerald"
                >
                    <div className="space-y-4">
                        {/* Hours Worked */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Hours Worked Today
                            </label>
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <input
                                    type="number"
                                    step="0.5"
                                    value={hoursWorked}
                                    onChange={(e) => setHoursWorked(parseFloat(e.target.value) || 0)}
                                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                                />
                                <span className="text-slate-500">hours</span>
                            </div>
                        </div>

                        {/* Percent Complete */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Overall Job Completion
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={percentComplete}
                                    onChange={(e) => setPercentComplete(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-lg font-bold text-emerald-600 w-12 text-right">
                                    {percentComplete}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all"
                                    style={{ width: `${percentComplete}%` }}
                                />
                            </div>
                        </div>

                        {/* Work Completed */}
                        <ListInput
                            label="Work Completed Today"
                            items={workCompleted}
                            newItem={newWorkItem}
                            setNewItem={setNewWorkItem}
                            onAdd={() => addToList(workCompleted, setWorkCompleted, newWorkItem, setNewWorkItem)}
                            onRemove={(i) => removeFromList(workCompleted, setWorkCompleted, i)}
                            placeholder="e.g., Removed old unit, ran new wiring"
                            icon={CheckCircle}
                            color="emerald"
                        />
                    </div>
                </CollapsibleSection>

                {/* Tomorrow Section */}
                <CollapsibleSection
                    title="For Tomorrow"
                    icon={ArrowRight}
                    expanded={expandedSection === 'tomorrow'}
                    onToggle={() => toggleSection('tomorrow')}
                    color="blue"
                >
                    <div className="space-y-4">
                        {/* Work Remaining */}
                        <ListInput
                            label="Work Remaining"
                            items={workRemaining}
                            newItem={newRemainingItem}
                            setNewItem={setNewRemainingItem}
                            onAdd={() => addToList(workRemaining, setWorkRemaining, newRemainingItem, setNewRemainingItem)}
                            onRemove={(i) => removeFromList(workRemaining, setWorkRemaining, i)}
                            placeholder="e.g., Install condenser, test system"
                            icon={ClipboardList}
                            color="blue"
                        />

                        {/* Materials Needed */}
                        <ListInput
                            label="Materials Needed Tomorrow"
                            items={materialsNeeded}
                            newItem={newMaterial}
                            setNewItem={setNewMaterial}
                            onAdd={() => addToList(materialsNeeded, setMaterialsNeeded, newMaterial, setNewMaterial)}
                            onRemove={(i) => removeFromList(materialsNeeded, setMaterialsNeeded, i)}
                            placeholder="e.g., 20ft copper line set"
                            icon={Package}
                            color="amber"
                        />
                    </div>
                </CollapsibleSection>

                {/* Issues Section */}
                <CollapsibleSection
                    title="Issues & Notes"
                    icon={AlertTriangle}
                    expanded={expandedSection === 'issues'}
                    onToggle={() => toggleSection('issues')}
                    color="orange"
                    badge={issues.length > 0 ? issues.length : null}
                >
                    <div className="space-y-4">
                        {/* Issues Encountered */}
                        <ListInput
                            label="Issues Encountered"
                            items={issues}
                            newItem={newIssue}
                            setNewItem={setNewIssue}
                            onAdd={() => addToList(issues, setIssues, newIssue, setNewIssue)}
                            onRemove={(i) => removeFromList(issues, setIssues, i)}
                            placeholder="e.g., Found additional duct damage"
                            icon={AlertTriangle}
                            color="orange"
                        />

                        {/* Safety Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <Shield size={14} className="text-red-500" />
                                Safety Notes for Tomorrow
                            </label>
                            <textarea
                                value={safetyNotes}
                                onChange={(e) => setSafetyNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                placeholder="Any safety concerns the next crew should know..."
                            />
                        </div>

                        {/* Customer Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                <MessageSquare size={14} className="text-purple-500" />
                                Notes About Customer
                            </label>
                            <textarea
                                value={customerNotes}
                                onChange={(e) => setCustomerNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                placeholder="e.g., Park in driveway, dog in backyard..."
                            />
                        </div>

                        {/* General Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Additional Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                placeholder="Any other information for tomorrow's crew..."
                            />
                        </div>
                    </div>
                </CollapsibleSection>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-4 py-4 bg-slate-50">
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || workCompleted.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Complete Handoff
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// COLLAPSIBLE SECTION
// ============================================

const CollapsibleSection = ({ title, icon: Icon, expanded, onToggle, color, badge, children }) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
            onClick={onToggle}
            className={`w-full flex items-center justify-between px-4 py-3 ${
                expanded ? `bg-${color}-50` : 'bg-white hover:bg-slate-50'
            } transition-colors`}
        >
            <div className="flex items-center gap-2">
                <Icon size={18} className={`text-${color}-600`} />
                <span className="font-medium text-slate-800">{title}</span>
                {badge && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full bg-${color}-100 text-${color}-700`}>
                        {badge}
                    </span>
                )}
            </div>
            {expanded ? (
                <ChevronUp size={18} className="text-slate-400" />
            ) : (
                <ChevronDown size={18} className="text-slate-400" />
            )}
        </button>
        {expanded && (
            <div className="px-4 py-4 border-t border-slate-100">
                {children}
            </div>
        )}
    </div>
);

// ============================================
// LIST INPUT COMPONENT
// ============================================

const ListInput = ({ label, items, newItem, setNewItem, onAdd, onRemove, placeholder, icon: Icon, color }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Icon size={14} className={`text-${color}-500`} />
            {label}
        </label>

        {/* Existing items */}
        {items.length > 0 && (
            <div className="space-y-1 mb-2">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg"
                    >
                        <CheckCircle size={14} className={`text-${color}-500`} />
                        <span className="flex-1 text-sm text-slate-700">{item}</span>
                        <button
                            onClick={() => onRemove(idx)}
                            className="p-1 hover:bg-slate-200 rounded"
                        >
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* Add new item */}
        <div className="flex gap-2">
            <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
                onClick={onAdd}
                disabled={!newItem.trim()}
                className={`px-3 py-2 bg-${color}-100 text-${color}-700 rounded-lg hover:bg-${color}-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <Plus size={18} />
            </button>
        </div>
    </div>
);

export default DailyHandoffForm;
