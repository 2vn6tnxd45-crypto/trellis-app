// src/lib/recordHelpers.js
// ============================================
// 📋 RECORD HELPER UTILITIES
// ============================================

/**
 * Check if a record with similar item name already exists
 * @param {Array} existingRecords - Array of existing records
 * @param {string} itemName - Name of the item to check
 * @param {number} similarityThreshold - How similar items need to be (0-1)
 * @returns {Object|null} - Matching record or null
 */
export const findDuplicateRecord = (existingRecords, itemName, similarityThreshold = 0.8) => {
    if (!itemName || !existingRecords || existingRecords.length === 0) return null;

    const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedItem = normalize(itemName);

    // Exact match first
    const exactMatch = existingRecords.find(r =>
        normalize(r.item || '') === normalizedItem
    );
    if (exactMatch) return exactMatch;

    // Fuzzy match for similar items
    for (const record of existingRecords) {
        const recordName = normalize(record.item || '');
        if (!recordName) continue;

        // Check if one string contains the other (e.g., "roof" matches "asphalt roof")
        if (recordName.includes(normalizedItem) || normalizedItem.includes(recordName)) {
            return record;
        }

        // Levenshtein distance-based similarity
        const similarity = calculateSimilarity(normalizedItem, recordName);
        if (similarity >= similarityThreshold) {
            return record;
        }
    }

    return null;
};

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} str1
 * @param {string} str2
 * @returns {number} - Similarity score 0-1
 */
const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
};

/**
 * Levenshtein distance algorithm
 */
const levenshteinDistance = (str1, str2) => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
};

/**
 * Merge new record data with existing record
 * @param {Object} existingRecord - The existing record
 * @param {Object} newData - New data from scan
 * @returns {Object} - Merged record
 */
export const mergeRecordData = (existingRecord, newData) => {
    return {
        ...existingRecord,
        // Update fields that are empty or add new info
        brand: newData.brand || existingRecord.brand,
        model: newData.model || existingRecord.model,
        cost: newData.cost || existingRecord.cost,
        dateInstalled: newData.dateInstalled || existingRecord.dateInstalled,
        contractor: newData.contractor || existingRecord.contractor,
        contractorPhone: newData.contractorPhone || existingRecord.contractorPhone,
        contractorEmail: newData.contractorEmail || existingRecord.contractorEmail,
        notes: existingRecord.notes
            ? `${existingRecord.notes}\n\n[Updated ${new Date().toLocaleDateString()}]: ${newData.notes || 'Receipt scanned'}`
            : newData.notes,
        // Merge attachments
        attachments: [
            ...(existingRecord.attachments || []),
            ...(newData.attachments || [])
        ],
    };
};

/**
 * Extract contractor information from invoice/receipt data
 * @param {Object} extractedData - Data extracted from AI
 * @returns {Object|null} - Contractor info or null
 */
export const extractContractorInfo = (extractedData) => {
    const contractor = {
        name: extractedData.contractor || extractedData.vendor || extractedData.company || null,
        phone: extractedData.phone || extractedData.contractorPhone || extractedData.phoneNumber || null,
        email: extractedData.email || extractedData.contractorEmail || null,
        address: extractedData.contractorAddress || extractedData.businessAddress || null,
        website: extractedData.website || null,
    };

    // Only return if we have at least a name
    if (!contractor.name) return null;

    // Clean up phone number
    if (contractor.phone) {
        contractor.phone = contractor.phone.replace(/[^\d+()-]/g, '');
    }

    // Clean up email
    if (contractor.email) {
        contractor.email = contractor.email.toLowerCase().trim();
    }

    return contractor;
};

/**
 * Check if contractor already exists in the list
 * @param {Array} contractors - Existing contractors
 * @param {Object} newContractor - New contractor to check
 * @returns {Object|null} - Existing contractor or null
 */
export const findExistingContractor = (contractors, newContractor) => {
    if (!newContractor || !newContractor.name) return null;

    const normalize = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedName = normalize(newContractor.name);

    return contractors.find(c => {
        const existingName = normalize(c.name || '');
        return existingName === normalizedName ||
               existingName.includes(normalizedName) ||
               normalizedName.includes(existingName);
    });
};

/**
 * Calculate improved health score with proper penalties
 * @param {Array} records - All property records
 * @returns {Object} - Score and breakdown
 */
export const calculateHealthScore = (records) => {
    if (!records || records.length === 0) {
        return {
            score: 0,
            breakdown: {
                coverage: { penalty: 100, needed: 5, message: 'No items tracked' },
                maintenance: { penalty: 0, count: 0, message: 'No maintenance items' },
                upcoming: { penalty: 0, count: 0, message: 'No upcoming tasks' }
            }
        };
    }

    const now = new Date();
    let overdueCount = 0;
    let upcomingCount = 0;

    // Count overdue and upcoming maintenance
    records.forEach(record => {
        if (!record.nextServiceDate) return;

        const nextDate = new Date(record.nextServiceDate);
        const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
            overdueCount++;
        } else if (daysUntil <= 30) {
            upcomingCount++;
        }
    });

    // 1. Coverage Penalty (starts at 100, decreases as you add items)
    let coveragePenalty = 0;
    let coverageMessage = '';
    const TARGET_ITEMS = 10; // Increased from 5 for better accuracy

    if (records.length === 0) {
        coveragePenalty = 100;
        coverageMessage = 'Start adding items to your home';
    } else if (records.length < 3) {
        coveragePenalty = 60;
        coverageMessage = `Only ${records.length} items tracked - add more for accurate scoring`;
    } else if (records.length < 5) {
        coveragePenalty = 40;
        coverageMessage = `Add ${5 - records.length} more items to unlock full features`;
    } else if (records.length < TARGET_ITEMS) {
        coveragePenalty = Math.max(0, (TARGET_ITEMS - records.length) * 3);
        coverageMessage = `Add ${TARGET_ITEMS - records.length} more items for comprehensive coverage`;
    } else {
        coverageMessage = 'Great coverage!';
    }

    // 2. Maintenance Penalty
    const overduePenalty = Math.min(40, overdueCount * 12);
    const maintenanceMessage = overdueCount > 0
        ? `${overdueCount} item${overdueCount !== 1 ? 's' : ''} overdue`
        : 'All maintenance up to date!';

    // 3. Upcoming Tasks Penalty (minor)
    const upcomingPenalty = Math.min(15, upcomingCount * 3);
    const upcomingMessage = upcomingCount > 0
        ? `${upcomingCount} task${upcomingCount !== 1 ? 's' : ''} due soon`
        : 'No upcoming tasks';

    const rawScore = 100 - coveragePenalty - overduePenalty - upcomingPenalty;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return {
        score,
        breakdown: {
            coverage: {
                penalty: coveragePenalty,
                needed: Math.max(0, TARGET_ITEMS - records.length),
                message: coverageMessage
            },
            maintenance: {
                penalty: overduePenalty,
                count: overdueCount,
                message: maintenanceMessage
            },
            upcoming: {
                penalty: upcomingPenalty,
                count: upcomingCount,
                message: upcomingMessage
            }
        }
    };
};
