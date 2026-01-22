// src/features/contractor-pro/lib/aiDispatchService.js
// ============================================
// AI DISPATCH ASSISTANT SERVICE
// ============================================
// Priority 2.3: AI-powered schedule proposals using Gemini

import { geminiModel } from '../../../config/firebase';
import { getTeamMembers, findEligibleTechs } from './teamService';
import { getUnscheduledJobs, getJobsByDate, batchAssignJobs, JOB_STATUSES } from './jobService';
import { evaluateConstraints, estimateTravelTime, optimizeTechSchedule } from './schedulingEngine';

// ============================================
// AI DISPATCH PROPOSAL
// ============================================

/**
 * Generate an AI-powered schedule proposal for a given date
 * This is the main "dispatch assistant" function
 */
export const generateScheduleProposal = async (contractorId, date, options = {}) => {
    try {
        const { includeUnscheduled = true, reoptimize = false } = options;

        // Gather all necessary data
        const [team, existingJobs, unscheduledJobs] = await Promise.all([
            getTeamMembers(contractorId, { activeOnly: true }),
            getJobsByDate(contractorId, date, { includeCompleted: false }),
            includeUnscheduled ? getUnscheduledJobs(contractorId) : Promise.resolve([])
        ]);

        // Filter unscheduled jobs that could potentially be done on this date
        const eligibleUnscheduledJobs = unscheduledJobs.filter(job => {
            // Don't schedule past SLA deadline
            if (job.slaDeadline && new Date(job.slaDeadline) < new Date(date)) {
                return false;
            }
            return true;
        });

        // Build context for AI
        const context = buildSchedulingContext(team, existingJobs, eligibleUnscheduledJobs, date);

        // Get AI recommendation
        const aiProposal = await getAIScheduleProposal(context);

        // Validate AI proposal against constraints
        const validatedProposal = await validateProposal(
            contractorId,
            aiProposal,
            team,
            existingJobs,
            eligibleUnscheduledJobs,
            date
        );

        return {
            success: true,
            date,
            proposal: validatedProposal,
            metrics: calculateProposalMetrics(validatedProposal, team),
            aiReasoning: aiProposal.reasoning
        };
    } catch (error) {
        console.error('Error generating schedule proposal:', error);
        throw error;
    }
};

/**
 * Build context object for AI prompt
 */
const buildSchedulingContext = (team, existingJobs, unscheduledJobs, date) => {
    // Prepare tech summaries
    const techSummaries = team.map(tech => ({
        id: tech.id,
        name: tech.name,
        skills: (tech.skills || []).map(s => s.skillId),
        certifications: (tech.certifications || []).map(c => c.certId),
        currentJobCount: existingJobs.filter(j => j.assignedTechId === tech.id).length,
        homeBase: tech.homeBase?.address || 'Unknown',
        maxDriveTime: tech.maxDriveTimeMinutes || 60,
        hourlyRate: tech.hourlyRate || 0,
        stats: {
            rating: tech.stats?.averageRating || 0,
            firstTimeFixRate: tech.stats?.firstTimeFixRate || 0
        }
    }));

    // Prepare existing job summaries
    const existingJobSummaries = existingJobs.map(job => ({
        id: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        address: job.serviceAddress,
        location: job.serviceLocation,
        assignedTechId: job.assignedTechId,
        assignedTechName: job.assignedTechName,
        scheduledStartTime: job.scheduledStartTime,
        scheduledEndTime: job.scheduledEndTime,
        estimatedDuration: job.estimatedDurationMinutes,
        requiredSkills: job.requiredSkills,
        requiredCertifications: job.requiredCertifications,
        priority: job.priority,
        status: job.status
    }));

    // Prepare unscheduled job summaries
    const unscheduledJobSummaries = unscheduledJobs.map(job => ({
        id: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        address: job.serviceAddress,
        location: job.serviceLocation,
        estimatedDuration: job.estimatedDurationMinutes || 60,
        requiredSkills: job.requiredSkills,
        requiredCertifications: job.requiredCertifications,
        priority: job.priority,
        customerTier: job.customerTier,
        slaDeadline: job.slaDeadline
    }));

    return {
        date,
        techs: techSummaries,
        existingJobs: existingJobSummaries,
        unscheduledJobs: unscheduledJobSummaries
    };
};

/**
 * Get AI schedule proposal from Gemini
 */
const getAIScheduleProposal = async (context) => {
    if (!geminiModel) {
        // Fallback to simple rule-based assignment if Gemini not available
        return generateFallbackProposal(context);
    }

    const prompt = `
You are an expert dispatch assistant for a field service company. Your job is to create an optimal daily schedule.

## Current Context for ${context.date}

### Available Technicians (${context.techs.length})
${JSON.stringify(context.techs, null, 2)}

### Already Scheduled Jobs (${context.existingJobs.length})
${JSON.stringify(context.existingJobs, null, 2)}

### Unscheduled Jobs to Assign (${context.unscheduledJobs.length})
${JSON.stringify(context.unscheduledJobs, null, 2)}

## Your Task
Create an optimal schedule that:
1. Assigns unscheduled jobs to techs who have the required skills and certifications
2. Minimizes total travel time by grouping geographically close jobs
3. Balances workload across techs (aim for similar job counts)
4. Prioritizes high-priority jobs and jobs with approaching SLA deadlines
5. Respects tech capacity (max 8 jobs per day, considering drive time)
6. Accounts for job duration when scheduling time slots

## CRITICAL RULES
- NEVER assign a job to a tech who lacks required skills or certifications
- NEVER double-book a tech (no overlapping time slots)
- Leave 15-minute buffers between jobs for travel
- Start the day no earlier than 08:00 and end by 18:00
- High priority jobs should be scheduled earlier in the day

## Output Format
Return ONLY a valid JSON object with this structure:
{
  "assignments": [
    {
      "jobId": "string",
      "techId": "string",
      "techName": "string",
      "scheduledStartTime": "HH:MM",
      "scheduledEndTime": "HH:MM",
      "reason": "Brief explanation of why this assignment"
    }
  ],
  "reorders": [
    {
      "techId": "string",
      "techName": "string",
      "reorderedJobs": ["jobId1", "jobId2"],
      "reason": "Brief explanation of the reordering"
    }
  ],
  "conflicts": [
    {
      "jobId": "string",
      "issue": "Description of why this job couldn't be scheduled",
      "suggestion": "What could resolve this"
    }
  ],
  "reasoning": "Overall explanation of the scheduling strategy used",
  "metrics": {
    "totalJobsAssigned": 0,
    "estimatedTotalDriveTime": 0,
    "averageUtilization": 0
  }
}

Important: Return ONLY the JSON, no markdown formatting or explanation outside the JSON.
`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();

        let proposal;
        try {
            proposal = JSON.parse(text);
        } catch (parseError) {
            console.error('AI response parse error:', parseError);
            console.log('Raw response:', text);
            return generateFallbackProposal(context);
        }

        return proposal;
    } catch (error) {
        console.error('Gemini API error:', error);
        return generateFallbackProposal(context);
    }
};

/**
 * Fallback rule-based proposal when AI is unavailable
 */
const generateFallbackProposal = (context) => {
    const assignments = [];
    const conflicts = [];
    const techSchedules = {};

    // Initialize tech schedules
    for (const tech of context.techs) {
        techSchedules[tech.id] = {
            tech,
            jobs: context.existingJobs.filter(j => j.assignedTechId === tech.id),
            nextAvailableTime: '08:00'
        };
    }

    // Sort unscheduled jobs by priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sortedJobs = [...context.unscheduledJobs].sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;

        // Then by SLA deadline
        if (a.slaDeadline && b.slaDeadline) {
            return new Date(a.slaDeadline) - new Date(b.slaDeadline);
        }
        return 0;
    });

    // Assign jobs
    for (const job of sortedJobs) {
        let assigned = false;

        // Find eligible techs
        const eligibleTechs = context.techs.filter(tech => {
            // Check skills
            const techSkills = tech.skills || [];
            const hasSkills = (job.requiredSkills || []).every(s => techSkills.includes(s));

            // Check certs
            const techCerts = tech.certifications || [];
            const hasCerts = (job.requiredCertifications || []).every(c => techCerts.includes(c));

            // Check capacity
            const techJobs = techSchedules[tech.id].jobs.length;
            const hasCapacity = techJobs < 6;

            return hasSkills && hasCerts && hasCapacity;
        });

        // Sort by current job count (load balancing)
        eligibleTechs.sort((a, b) =>
            techSchedules[a.id].jobs.length - techSchedules[b.id].jobs.length
        );

        for (const tech of eligibleTechs) {
            const schedule = techSchedules[tech.id];
            const startTime = schedule.nextAvailableTime;
            const duration = job.estimatedDuration || 60;
            const endMinutes = timeToMinutes(startTime) + duration;

            // Check if within working hours
            if (endMinutes <= timeToMinutes('18:00')) {
                assignments.push({
                    jobId: job.id,
                    techId: tech.id,
                    techName: tech.name,
                    scheduledStartTime: startTime,
                    scheduledEndTime: minutesToTime(endMinutes),
                    reason: `Assigned based on skills match and workload balance`
                });

                // Update tech's next available time (add 15 min buffer)
                schedule.nextAvailableTime = minutesToTime(endMinutes + 15);
                schedule.jobs.push(job);
                assigned = true;
                break;
            }
        }

        if (!assigned) {
            conflicts.push({
                jobId: job.id,
                issue: eligibleTechs.length === 0
                    ? 'No technician has the required skills/certifications'
                    : 'All eligible technicians are at capacity',
                suggestion: 'Consider scheduling for another day or adding team capacity'
            });
        }
    }

    return {
        assignments,
        reorders: [],
        conflicts,
        reasoning: 'Used rule-based assignment: priority ordering, skill matching, and load balancing',
        metrics: {
            totalJobsAssigned: assignments.length,
            estimatedTotalDriveTime: 0, // Would need location data to calculate
            averageUtilization: Math.round(
                (context.existingJobs.length + assignments.length) / context.techs.length
            )
        }
    };
};

/**
 * Validate AI proposal against actual constraints
 */
const validateProposal = async (contractorId, proposal, team, existingJobs, unscheduledJobs, date) => {
    const validatedAssignments = [];
    const validationErrors = [];

    for (const assignment of (proposal.assignments || [])) {
        const job = unscheduledJobs.find(j => j.id === assignment.jobId);
        const tech = team.find(t => t.id === assignment.techId);

        if (!job || !tech) {
            validationErrors.push({
                jobId: assignment.jobId,
                error: 'Job or tech not found'
            });
            continue;
        }

        // Run full constraint evaluation
        const evaluation = await evaluateConstraints(
            job,
            tech,
            {
                date,
                startTime: assignment.scheduledStartTime,
                endTime: assignment.scheduledEndTime
            },
            [...existingJobs, ...validatedAssignments.map(a => ({
                ...unscheduledJobs.find(j => j.id === a.jobId),
                assignedTechId: a.techId,
                scheduledDate: date,
                scheduledStartTime: a.scheduledStartTime,
                scheduledEndTime: a.scheduledEndTime
            }))]
        );

        if (evaluation.canSchedule) {
            validatedAssignments.push({
                ...assignment,
                validated: true,
                warnings: evaluation.warnings
            });
        } else {
            validationErrors.push({
                jobId: assignment.jobId,
                error: evaluation.summary,
                violations: evaluation.violations
            });
        }
    }

    return {
        assignments: validatedAssignments,
        reorders: proposal.reorders || [],
        conflicts: [...(proposal.conflicts || []), ...validationErrors.map(e => ({
            jobId: e.jobId,
            issue: e.error,
            suggestion: 'AI assignment was rejected by constraint validation'
        }))],
        reasoning: proposal.reasoning,
        validationSummary: {
            proposed: proposal.assignments?.length || 0,
            validated: validatedAssignments.length,
            rejected: validationErrors.length
        }
    };
};

/**
 * Calculate metrics for the proposal
 */
const calculateProposalMetrics = (proposal, team) => {
    const assignments = proposal.assignments || [];

    // Calculate per-tech metrics
    const techMetrics = {};
    for (const tech of team) {
        const techAssignments = assignments.filter(a => a.techId === tech.id);
        techMetrics[tech.id] = {
            name: tech.name,
            assignedJobs: techAssignments.length,
            totalMinutes: techAssignments.reduce((sum, a) => {
                const start = timeToMinutes(a.scheduledStartTime);
                const end = timeToMinutes(a.scheduledEndTime);
                return sum + (end - start);
            }, 0)
        };
    }

    // Calculate totals
    const totalJobs = assignments.length;
    const totalMinutes = Object.values(techMetrics).reduce((sum, m) => sum + m.totalMinutes, 0);
    const avgUtilization = team.length > 0
        ? Math.round((totalMinutes / (team.length * 480)) * 100) // 480 = 8 hour day
        : 0;

    return {
        totalJobsAssigned: totalJobs,
        totalScheduledMinutes: totalMinutes,
        averageUtilization: avgUtilization,
        techBreakdown: techMetrics,
        conflictCount: (proposal.conflicts || []).length
    };
};

// ============================================
// APPLY PROPOSAL
// ============================================

/**
 * Apply an approved schedule proposal
 */
export const applyScheduleProposal = async (contractorId, date, proposal) => {
    try {
        const assignments = (proposal.assignments || []).map(a => ({
            jobId: a.jobId,
            techId: a.techId,
            techName: a.techName,
            scheduledDate: date,
            scheduledStartTime: a.scheduledStartTime,
            scheduledEndTime: a.scheduledEndTime
        }));

        if (assignments.length === 0) {
            return { success: true, message: 'No assignments to apply' };
        }

        const result = await batchAssignJobs(contractorId, assignments);

        return {
            success: true,
            appliedCount: result.assignedCount,
            message: `Successfully scheduled ${result.assignedCount} jobs`
        };
    } catch (error) {
        console.error('Error applying proposal:', error);
        throw error;
    }
};

// ============================================
// DISRUPTION HANDLING
// ============================================

/**
 * Handle a disruption (tech called out, job running late, etc.)
 * Generates a re-scheduling proposal
 */
export const handleDisruption = async (contractorId, disruption) => {
    try {
        const { type, date, affectedTechId, affectedJobId, reason } = disruption;

        // Get current schedule
        const [team, jobs] = await Promise.all([
            getTeamMembers(contractorId, { activeOnly: true }),
            getJobsByDate(contractorId, date, { includeCompleted: false })
        ]);

        let affectedJobs = [];

        switch (type) {
            case 'tech_unavailable':
                // Find all jobs assigned to this tech
                affectedJobs = jobs.filter(j =>
                    j.assignedTechId === affectedTechId &&
                    j.status !== JOB_STATUSES.COMPLETED
                );
                break;

            case 'job_running_late':
                // Find all subsequent jobs for this tech
                const lateJob = jobs.find(j => j.id === affectedJobId);
                if (lateJob) {
                    affectedJobs = jobs.filter(j =>
                        j.assignedTechId === lateJob.assignedTechId &&
                        j.scheduledStartTime > lateJob.scheduledEndTime &&
                        j.status !== JOB_STATUSES.COMPLETED
                    );
                }
                break;

            case 'customer_cancelled':
                // The cancelled job creates a gap - could fill with other jobs
                const cancelledJob = jobs.find(j => j.id === affectedJobId);
                // No affected jobs, but could optimize
                break;
        }

        if (affectedJobs.length === 0) {
            return {
                success: true,
                message: 'No jobs need rescheduling',
                proposal: null
            };
        }

        // Remove the affected tech from available pool if they're unavailable
        const availableTechs = type === 'tech_unavailable'
            ? team.filter(t => t.id !== affectedTechId)
            : team;

        // Treat affected jobs as "unscheduled" for reassignment
        const context = buildSchedulingContext(
            availableTechs,
            jobs.filter(j => !affectedJobs.find(aj => aj.id === j.id)),
            affectedJobs,
            date
        );

        // Get AI proposal for reassignment
        const aiProposal = await getAIScheduleProposal(context);
        const validatedProposal = await validateProposal(
            contractorId,
            aiProposal,
            availableTechs,
            jobs.filter(j => !affectedJobs.find(aj => aj.id === j.id)),
            affectedJobs,
            date
        );

        return {
            success: true,
            disruption: {
                type,
                reason,
                affectedJobCount: affectedJobs.length
            },
            proposal: validatedProposal,
            metrics: calculateProposalMetrics(validatedProposal, availableTechs),
            aiReasoning: aiProposal.reasoning
        };
    } catch (error) {
        console.error('Error handling disruption:', error);
        throw error;
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const timeToMinutes = (time) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export default {
    generateScheduleProposal,
    applyScheduleProposal,
    handleDisruption
};
