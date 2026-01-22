// src/features/contractor-pro/components/ScenarioSimulator.jsx
// ============================================
// WHAT-IF SCENARIO SIMULATOR
// ============================================
// Priority 3.1: Simulate schedule changes before committing

import React, { useState, useCallback, useMemo } from 'react';
import {
    FlaskConical, Play, RotateCcw, Check, X, AlertTriangle,
    Clock, Car, User, MapPin, ArrowRight, ChevronDown, ChevronUp,
    Zap, TrendingUp, TrendingDown, Minus, Calendar, Users
} from 'lucide-react';
import { simulateSwap, evaluateConstraints, estimateTravelTime } from '../lib/schedulingEngine';

// ============================================
// IMPACT INDICATOR COMPONENT
// ============================================
const ImpactIndicator = ({ value, label, unit = '', inverse = false }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const isNegative = inverse ? value > 0 : value < 0;
    const isNeutral = value === 0;

    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    const colorClass = isPositive
        ? 'text-green-600 bg-green-50'
        : isNegative
            ? 'text-red-600 bg-red-50'
            : 'text-slate-500 bg-slate-50';

    const formattedValue = value > 0 ? `+${value}` : value.toString();

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}>
            <Icon size={16} />
            <div>
                <p className="text-xs font-medium opacity-75">{label}</p>
                <p className="font-bold">{formattedValue}{unit}</p>
            </div>
        </div>
    );
};

// ============================================
// CONSTRAINT CHECK ROW
// ============================================
const ConstraintCheckRow = ({ constraint, passed }) => {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-600">{constraint}</span>
            {passed ? (
                <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Check size={14} />
                    Pass
                </span>
            ) : (
                <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <X size={14} />
                    Fail
                </span>
            )}
        </div>
    );
};

// ============================================
// SCHEDULE PREVIEW CARD
// ============================================
const SchedulePreviewCard = ({ tech, jobs, isModified = false }) => {
    const [expanded, setExpanded] = useState(false);

    // Calculate total travel and work time
    const totalWorkMinutes = jobs.reduce((sum, j) => sum + (j.estimatedDurationMinutes || 60), 0);
    const totalTravelMinutes = jobs.reduce((sum, j) => sum + (j.travelMinutes || 0), 0);

    return (
        <div className={`border rounded-lg overflow-hidden ${isModified ? 'border-purple-300 bg-purple-50/30' : 'border-slate-200 bg-white'}`}>
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isModified ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                        <User size={18} />
                    </div>
                    <div>
                        <p className="font-medium text-slate-800">{tech.name}</p>
                        <p className="text-xs text-slate-500">{jobs.length} jobs · {totalWorkMinutes} min work · {totalTravelMinutes} min travel</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isModified && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            Modified
                        </span>
                    )}
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 p-3 space-y-2">
                    {jobs.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No jobs scheduled</p>
                    ) : (
                        jobs.map((job, index) => (
                            <div key={job.id} className="flex items-center gap-2 text-sm">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                                    {index + 1}
                                </span>
                                <span className="font-medium text-slate-700 flex-1 truncate">
                                    {job.title || job.jobNumber}
                                </span>
                                <span className="text-slate-500">
                                    {job.scheduledStartTime}
                                </span>
                                {job.travelMinutes > 0 && (
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Car size={10} />
                                        {job.travelMinutes}m
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// SCENARIO ACTION SELECTOR
// ============================================
const ScenarioActionSelector = ({ jobs, team, onSelectAction }) => {
    const [actionType, setActionType] = useState('swap');
    const [sourceJob, setSourceJob] = useState('');
    const [targetTech, setTargetTech] = useState('');
    const [targetJob, setTargetJob] = useState('');

    const handleApply = () => {
        if (actionType === 'swap' && sourceJob && targetJob) {
            onSelectAction({
                type: 'swap',
                sourceJobId: sourceJob,
                targetJobId: targetJob
            });
        } else if (actionType === 'reassign' && sourceJob && targetTech) {
            onSelectAction({
                type: 'reassign',
                jobId: sourceJob,
                newTechId: targetTech
            });
        }
    };

    const canApply = actionType === 'swap'
        ? sourceJob && targetJob && sourceJob !== targetJob
        : sourceJob && targetTech;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-purple-600" />
                <h3 className="font-bold text-slate-800">Create Scenario</h3>
            </div>

            {/* Action Type */}
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Action Type</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActionType('swap')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            actionType === 'swap'
                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        Swap Jobs
                    </button>
                    <button
                        onClick={() => setActionType('reassign')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            actionType === 'reassign'
                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        Reassign Job
                    </button>
                </div>
            </div>

            {/* Source Job */}
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                    {actionType === 'swap' ? 'First Job' : 'Job to Reassign'}
                </label>
                <select
                    value={sourceJob}
                    onChange={(e) => setSourceJob(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="">Select a job...</option>
                    {jobs.map(job => (
                        <option key={job.id} value={job.id}>
                            {job.title || job.jobNumber} - {job.assignedTechName || 'Unassigned'}
                        </option>
                    ))}
                </select>
            </div>

            {/* Target (Job or Tech) */}
            {actionType === 'swap' ? (
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Second Job</label>
                    <select
                        value={targetJob}
                        onChange={(e) => setTargetJob(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Select a job...</option>
                        {jobs.filter(j => j.id !== sourceJob).map(job => (
                            <option key={job.id} value={job.id}>
                                {job.title || job.jobNumber} - {job.assignedTechName || 'Unassigned'}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Assign To</label>
                    <select
                        value={targetTech}
                        onChange={(e) => setTargetTech(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="">Select a technician...</option>
                        {team.map(tech => (
                            <option key={tech.id} value={tech.id}>
                                {tech.name} ({tech.role})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <button
                onClick={handleApply}
                disabled={!canApply}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Play size={16} />
                Simulate Scenario
            </button>
        </div>
    );
};

// ============================================
// MAIN SCENARIO SIMULATOR COMPONENT
// ============================================
export const ScenarioSimulator = ({
    jobs = [],
    team = [],
    onApplyScenario,
    onClose
}) => {
    const [scenario, setScenario] = useState(null);
    const [simulating, setSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState(null);

    // Group jobs by tech
    const jobsByTech = useMemo(() => {
        const grouped = {};
        team.forEach(tech => {
            grouped[tech.id] = {
                tech,
                jobs: jobs.filter(j => j.assignedTechId === tech.id)
                    .sort((a, b) => (a.scheduledStartTime || '').localeCompare(b.scheduledStartTime || ''))
            };
        });
        // Add unassigned
        grouped['unassigned'] = {
            tech: { id: 'unassigned', name: 'Unassigned' },
            jobs: jobs.filter(j => !j.assignedTechId)
        };
        return grouped;
    }, [jobs, team]);

    // Run simulation
    const runSimulation = useCallback(async (action) => {
        setSimulating(true);
        setScenario(action);

        try {
            let result;

            if (action.type === 'swap') {
                const job1 = jobs.find(j => j.id === action.sourceJobId);
                const job2 = jobs.find(j => j.id === action.targetJobId);

                if (!job1 || !job2) {
                    throw new Error('Jobs not found');
                }

                result = await simulateSwap(job1, job2, jobs);
            } else if (action.type === 'reassign') {
                const job = jobs.find(j => j.id === action.jobId);
                const tech = team.find(t => t.id === action.newTechId);

                if (!job || !tech) {
                    throw new Error('Job or tech not found');
                }

                // Evaluate constraints for the new assignment
                const constraints = await evaluateConstraints(
                    job,
                    tech,
                    job.scheduledDate,
                    job.scheduledStartTime,
                    jobs.filter(j => j.assignedTechId === tech.id)
                );

                // Calculate travel time impact
                const techJobs = jobs.filter(j => j.assignedTechId === tech.id);
                let newTravelTime = 0;
                if (techJobs.length > 0 && job.serviceLocation) {
                    const lastJob = techJobs[techJobs.length - 1];
                    if (lastJob.serviceLocation) {
                        const travel = await estimateTravelTime(lastJob.serviceLocation, job.serviceLocation);
                        newTravelTime = travel.durationMinutes;
                    }
                }

                result = {
                    feasible: constraints.every(c => c.passed),
                    constraints,
                    impacts: {
                        travelTimeDelta: newTravelTime,
                        balanceDelta: 1, // Adding one job to this tech
                        utilizationDelta: (job.estimatedDurationMinutes || 60) / 480 * 100
                    },
                    changes: [{
                        jobId: job.id,
                        jobTitle: job.title || job.jobNumber,
                        fromTech: job.assignedTechName || 'Unassigned',
                        toTech: tech.name
                    }]
                };
            }

            setSimulationResult(result);
        } catch (err) {
            console.error('Simulation error:', err);
            setSimulationResult({
                feasible: false,
                error: err.message,
                constraints: [],
                impacts: {}
            });
        } finally {
            setSimulating(false);
        }
    }, [jobs, team]);

    // Reset simulation
    const resetSimulation = () => {
        setScenario(null);
        setSimulationResult(null);
    };

    // Apply the scenario
    const handleApply = async () => {
        if (!simulationResult?.feasible || !scenario) return;

        try {
            await onApplyScenario?.(scenario);
            resetSimulation();
        } catch (err) {
            console.error('Apply error:', err);
        }
    };

    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FlaskConical size={20} className="text-purple-600" />
                    <h2 className="font-bold text-slate-800">What-If Scenario Simulator</h2>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Action Selector */}
                <div className="lg:col-span-1">
                    <ScenarioActionSelector
                        jobs={jobs}
                        team={team}
                        onSelectAction={runSimulation}
                    />
                </div>

                {/* Right: Results */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Loading State */}
                    {simulating && (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4" />
                            <p className="text-slate-600">Running simulation...</p>
                        </div>
                    )}

                    {/* Results */}
                    {!simulating && simulationResult && (
                        <>
                            {/* Feasibility Banner */}
                            <div className={`rounded-xl p-4 flex items-center gap-3 ${
                                simulationResult.feasible
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-red-50 border border-red-200'
                            }`}>
                                {simulationResult.feasible ? (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <Check size={20} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-800">Scenario is Feasible</p>
                                            <p className="text-sm text-green-600">All constraints pass. You can apply this change.</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                            <AlertTriangle size={20} className="text-red-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-red-800">Scenario Has Issues</p>
                                            <p className="text-sm text-red-600">
                                                {simulationResult.error || 'One or more constraints failed.'}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Impact Metrics */}
                            {simulationResult.impacts && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                    <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                                        <Zap size={16} className="text-amber-500" />
                                        Impact Analysis
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {simulationResult.impacts.travelTimeDelta !== undefined && (
                                            <ImpactIndicator
                                                value={Math.round(simulationResult.impacts.travelTimeDelta)}
                                                label="Travel Time"
                                                unit=" min"
                                                inverse
                                            />
                                        )}
                                        {simulationResult.impacts.utilizationDelta !== undefined && (
                                            <ImpactIndicator
                                                value={Math.round(simulationResult.impacts.utilizationDelta)}
                                                label="Utilization"
                                                unit="%"
                                            />
                                        )}
                                        {simulationResult.impacts.balanceDelta !== undefined && (
                                            <ImpactIndicator
                                                value={simulationResult.impacts.balanceDelta}
                                                label="Workload Balance"
                                                unit=" jobs"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Constraint Checks */}
                            {simulationResult.constraints?.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                    <h4 className="font-medium text-slate-700 mb-3">Constraint Checks</h4>
                                    <div>
                                        {simulationResult.constraints.map((c, i) => (
                                            <ConstraintCheckRow
                                                key={i}
                                                constraint={c.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                passed={c.passed}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Changes Preview */}
                            {simulationResult.changes?.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                    <h4 className="font-medium text-slate-700 mb-3">Proposed Changes</h4>
                                    <div className="space-y-2">
                                        {simulationResult.changes.map((change, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded-lg">
                                                <span className="font-medium text-slate-700">{change.jobTitle}</span>
                                                <span className="text-slate-400">:</span>
                                                <span className="text-slate-500">{change.fromTech}</span>
                                                <ArrowRight size={14} className="text-purple-500" />
                                                <span className="text-purple-600 font-medium">{change.toTech}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={resetSimulation}
                                    className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                                >
                                    <RotateCcw size={16} />
                                    Reset
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={!simulationResult.feasible}
                                    className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Check size={16} />
                                    Apply Changes
                                </button>
                            </div>
                        </>
                    )}

                    {/* Empty State */}
                    {!simulating && !simulationResult && (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                                <FlaskConical size={28} className="text-purple-400" />
                            </div>
                            <h3 className="font-medium text-slate-700 mb-1">No Scenario Running</h3>
                            <p className="text-sm text-slate-500 max-w-sm">
                                Select jobs or technicians and simulate a change to see the impact before applying it.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Schedule Preview (collapsed by default) */}
            {team.length > 0 && (
                <div className="border-t border-slate-200 p-4">
                    <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800">
                            <Users size={16} />
                            View Current Schedule by Technician
                            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Object.values(jobsByTech).map(({ tech, jobs: techJobs }) => (
                                <SchedulePreviewCard
                                    key={tech.id}
                                    tech={tech}
                                    jobs={techJobs}
                                    isModified={simulationResult?.changes?.some(c =>
                                        c.fromTech === tech.name || c.toTech === tech.name
                                    )}
                                />
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};

export default ScenarioSimulator;
