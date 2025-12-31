// scripts/migrateWarranties.js
// ============================================
// WARRANTY MIGRATION SCRIPT
// ============================================
// Converts legacy string warranties to structured format
// Run with: node scripts/migrateWarranties.js
// 
// DRY RUN by default - set DRY_RUN=false to apply changes
// ============================================

const admin = require('firebase-admin');

// Initialize Firebase Admin
// Option 1: Using service account (recommended for local dev)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// Option 2: Using default credentials (for Firebase environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  APP_ID: 'mykrib',  // Your app ID
  DRY_RUN: process.env.DRY_RUN !== 'false', // Default to dry run
  VERBOSE: process.env.VERBOSE === 'true',
};

// ============================================
// WARRANTY PARSING LOGIC
// (Mirrors the parseWarrantyString from useGemini.js)
// ============================================

/**
 * Parse a warranty string into structured format
 * @param {string} str - The warranty string (e.g., "10 year parts, 1 year labor")
 * @param {string} installDate - The install date for calculating start date
 * @returns {object|null} Structured warranty details or null if unparseable
 */
function parseWarrantyString(str, installDate) {
  if (!str || typeof str !== 'string' || str.trim() === '') {
    return null;
  }
  
  const lower = str.toLowerCase().trim();
  
  // Skip obviously non-warranty strings
  const skipPatterns = [
    /^n\/?a$/i,
    /^none$/i,
    /^no warranty$/i,
    /^unknown$/i,
    /^-$/,
    /^\.$/,
  ];
  
  if (skipPatterns.some(pattern => pattern.test(lower))) {
    return null;
  }
  
  const result = {
    hasCoverage: true,
    type: 'parts_only',
    partsMonths: 0,
    laborMonths: 0,
    provider: 'manufacturer',
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    registrationNumber: null,
    transferable: false,
    requiresService: false,
    startDate: installDate || new Date().toISOString().split('T')[0],
    notes: str, // Keep original text for reference
  };
  
  // ============================================
  // PARSE PARTS WARRANTY
  // ============================================
  
  // "10 year parts" or "10-year parts" or "10yr parts"
  const partsYearMatch = lower.match(/(\d+)[\s-]?(?:year|yr)s?\s*(?:parts?|equipment|unit|compressor)/);
  if (partsYearMatch) {
    result.partsMonths = parseInt(partsYearMatch[1]) * 12;
  }
  
  // "12 month parts"
  const partsMonthMatch = lower.match(/(\d+)\s*months?\s*(?:parts?|equipment|unit)/);
  if (partsMonthMatch) {
    result.partsMonths = parseInt(partsMonthMatch[1]);
  }
  
  // ============================================
  // PARSE LABOR WARRANTY
  // ============================================
  
  // "1 year labor" or "2-year labor"
  const laborYearMatch = lower.match(/(\d+)[\s-]?(?:year|yr)s?\s*labor/);
  if (laborYearMatch) {
    result.laborMonths = parseInt(laborYearMatch[1]) * 12;
  }
  
  // "90 day labor" or "6 month labor"
  const laborMonthMatch = lower.match(/(\d+)\s*months?\s*labor/);
  if (laborMonthMatch) {
    result.laborMonths = parseInt(laborMonthMatch[1]);
  }
  
  const laborDayMatch = lower.match(/(\d+)\s*days?\s*labor/);
  if (laborDayMatch) {
    result.laborMonths = Math.ceil(parseInt(laborDayMatch[1]) / 30);
  }
  
  // ============================================
  // GENERIC WARRANTY PATTERNS
  // ============================================
  
  // If no specific parts/labor found, try generic patterns
  if (result.partsMonths === 0 && result.laborMonths === 0) {
    // "10 year warranty" or "10-year limited warranty"
    const genericYearMatch = lower.match(/(\d+)[\s-]?(?:year|yr)s?(?:\s+(?:limited|full|manufacturer['']?s?))?\s*warranty/);
    if (genericYearMatch) {
      result.partsMonths = parseInt(genericYearMatch[1]) * 12;
    }
    
    // "Lifetime warranty" or "Limited lifetime"
    if (/lifetime/i.test(lower)) {
      result.partsMonths = 600; // 50 years
      result.notes = str + ' (interpreted as 50 years)';
    }
    
    // Just "X year" without warranty word
    if (result.partsMonths === 0) {
      const simpleYearMatch = lower.match(/^(\d+)\s*(?:year|yr)s?$/);
      if (simpleYearMatch) {
        result.partsMonths = parseInt(simpleYearMatch[1]) * 12;
      }
    }
    
    // "X year X year" pattern (e.g., "10 year 1 year" meaning parts/labor)
    const dualYearMatch = lower.match(/(\d+)\s*(?:year|yr)s?\s+(\d+)\s*(?:year|yr)s?/);
    if (dualYearMatch) {
      result.partsMonths = parseInt(dualYearMatch[1]) * 12;
      result.laborMonths = parseInt(dualYearMatch[2]) * 12;
    }
  }
  
  // ============================================
  // DETECT WARRANTY TYPE
  // ============================================
  
  if (result.partsMonths > 0 && result.laborMonths > 0) {
    result.type = 'parts_and_labor';
  } else if (result.laborMonths > 0 && result.partsMonths === 0) {
    result.type = 'labor_only';
  } else if (result.partsMonths > 0) {
    result.type = 'parts_only';
  }
  
  // Check for "full warranty" which implies parts AND labor
  if (/full\s*warranty/i.test(lower) && result.laborMonths === 0) {
    result.laborMonths = result.partsMonths;
    result.type = 'parts_and_labor';
  }
  
  // ============================================
  // ADDITIONAL FLAGS
  // ============================================
  
  // Transferable warranty
  if (/transferr?able|can\s*be\s*transferred/i.test(lower)) {
    result.transferable = true;
  }
  
  // Service requirements
  if (/annual\s*service|service\s*required|maintain|registration\s*required/i.test(lower)) {
    result.requiresService = true;
  }
  
  // Extended warranty
  if (/extended/i.test(lower)) {
    result.type = 'extended';
  }
  
  // ============================================
  // EXTRACT CONTACT INFO
  // ============================================
  
  // Phone numbers (1-800 patterns)
  const phoneMatch = str.match(/1[-.\s]?8[0-9]{2}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
  if (phoneMatch) {
    result.contactPhone = phoneMatch[0].replace(/[-.\s]/g, '-');
  }
  
  // Also try standard phone patterns
  if (!result.contactPhone) {
    const stdPhoneMatch = str.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (stdPhoneMatch) {
      result.contactPhone = stdPhoneMatch[0];
    }
  }
  
  // Registration numbers
  const regPatterns = [
    /reg(?:istration)?[#:\s]+([A-Z0-9-]+)/i,
    /warranty\s*#[:\s]*([A-Z0-9-]+)/i,
    /serial[:\s]*([A-Z0-9-]+)/i,
  ];
  
  for (const pattern of regPatterns) {
    const match = str.match(pattern);
    if (match) {
      result.registrationNumber = match[1];
      break;
    }
  }
  
  // ============================================
  // VALIDATE RESULT
  // ============================================
  
  // If we couldn't extract any meaningful duration, return null
  if (result.partsMonths === 0 && result.laborMonths === 0) {
    return null;
  }
  
  return result;
}

/**
 * Format months into human-readable string
 */
function formatDuration(months) {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    if (remaining > 0) {
      return `${years}y ${remaining}mo`;
    }
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
  return `${months} month${months !== 1 ? 's' : ''}`;
}

// ============================================
// MIGRATION LOGIC
// ============================================

async function migrateWarranties() {
  const isDryRun = CONFIG.DRY_RUN;
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           WARRANTY MIGRATION SCRIPT                         ║');
  console.log(`║           Mode: ${isDryRun ? 'DRY RUN (no changes)' : '🔴 LIVE (will update DB)'}              ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const stats = {
    totalRecords: 0,
    withWarrantyString: 0,
    alreadyMigrated: 0,
    successfullyParsed: 0,
    failedToParse: 0,
    updated: 0,
    errors: 0,
  };
  
  const failedItems = [];
  const successItems = [];
  
  try {
    // Get all users
    const usersSnap = await db.collection(`artifacts/${CONFIG.APP_ID}/users`).get();
    console.log(`📁 Found ${usersSnap.size} users to process\n`);
    
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      
      // Get all house records for this user
      const recordsSnap = await db
        .collection(`artifacts/${CONFIG.APP_ID}/users/${userId}/house_records`)
        .get();
      
      if (recordsSnap.empty) continue;
      
      console.log(`\n👤 User: ${userId.substring(0, 8)}... (${recordsSnap.size} records)`);
      console.log('─'.repeat(50));
      
      for (const recordDoc of recordsSnap.docs) {
        stats.totalRecords++;
        const record = recordDoc.data();
        const recordId = recordDoc.id;
        
        // Check current state
        const hasWarrantyString = record.warranty && typeof record.warranty === 'string' && record.warranty.trim() !== '';
        const hasWarrantyDetails = record.warrantyDetails && typeof record.warrantyDetails === 'object' && record.warrantyDetails.hasCoverage;
        
        if (!hasWarrantyString) {
          // No warranty string to migrate
          continue;
        }
        
        stats.withWarrantyString++;
        
        if (hasWarrantyDetails) {
          // Already has structured warranty
          stats.alreadyMigrated++;
          if (CONFIG.VERBOSE) {
            console.log(`  ⏭️  ${record.item}: Already migrated`);
          }
          continue;
        }
        
        // Try to parse the warranty string
        const parsed = parseWarrantyString(record.warranty, record.dateInstalled);
        
        if (!parsed) {
          stats.failedToParse++;
          failedItems.push({
            userId: userId.substring(0, 8),
            item: record.item,
            warranty: record.warranty,
          });
          console.log(`  ❌ ${record.item}`);
          console.log(`     Could not parse: "${record.warranty}"`);
          continue;
        }
        
        stats.successfullyParsed++;
        successItems.push({
          item: record.item,
          original: record.warranty,
          partsMonths: parsed.partsMonths,
          laborMonths: parsed.laborMonths,
          type: parsed.type,
        });
        
        console.log(`  ✅ ${record.item}`);
        console.log(`     Original: "${record.warranty}"`);
        console.log(`     Parsed:   ${formatDuration(parsed.partsMonths)} parts, ${formatDuration(parsed.laborMonths)} labor (${parsed.type})`);
        if (parsed.transferable) console.log(`     Flags:    Transferable`);
        if (parsed.requiresService) console.log(`     Flags:    Requires annual service`);
        if (parsed.contactPhone) console.log(`     Contact:  ${parsed.contactPhone}`);
        
        // Update the record (if not dry run)
        if (!isDryRun) {
          try {
            await recordDoc.ref.update({
              warrantyDetails: parsed,
            });
            stats.updated++;
            console.log(`     → ✓ Updated in Firestore`);
          } catch (err) {
            stats.errors++;
            console.log(`     → ❌ Error: ${err.message}`);
          }
        }
      }
    }
    
    // ============================================
    // PRINT SUMMARY
    // ============================================
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    MIGRATION SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    console.log('📊 STATISTICS:');
    console.log('─'.repeat(40));
    console.log(`   Total records scanned:     ${stats.totalRecords}`);
    console.log(`   With warranty string:      ${stats.withWarrantyString}`);
    console.log(`   Already migrated:          ${stats.alreadyMigrated}`);
    console.log(`   Successfully parsed:       ${stats.successfullyParsed}`);
    console.log(`   Failed to parse:           ${stats.failedToParse}`);
    if (!isDryRun) {
      console.log(`   Updated in Firestore:      ${stats.updated}`);
      console.log(`   Errors during update:      ${stats.errors}`);
    }
    
    // Success rate
    const parseableTotal = stats.withWarrantyString - stats.alreadyMigrated;
    const successRate = parseableTotal > 0 
      ? Math.round((stats.successfullyParsed / parseableTotal) * 100) 
      : 100;
    console.log(`\n   Parse success rate:        ${successRate}%`);
    
    // List failures for manual review
    if (failedItems.length > 0) {
      console.log('\n');
      console.log('⚠️  ITEMS REQUIRING MANUAL REVIEW:');
      console.log('─'.repeat(40));
      failedItems.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.item}`);
        console.log(`      Warranty: "${item.warranty}"`);
      });
      console.log('\n   These warranties could not be parsed automatically.');
      console.log('   Consider updating them manually or improving the parser.');
    }
    
    // Dry run notice
    if (isDryRun) {
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  ℹ️  This was a DRY RUN - no changes were made to Firestore ║');
      console.log('║                                                             ║');
      console.log('║  To apply changes, run with:                                ║');
      console.log('║  DRY_RUN=false node scripts/migrateWarranties.js            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
    } else {
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ Migration complete! Changes have been saved.            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    throw error;
  }
}

// ============================================
// RUN
// ============================================
migrateWarranties()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
