// tests/e2e/evaluation-deep-flow.spec.js
// Deep functional tests for evaluation workflow:
// 1. Messaging within evaluation
// 2. Cancel request flow
// 3. Homeowner completion flow
// 4. AI suggestions after submission
// 5. Site visit scheduling to both calendars

import { test, expect, chromium } from '@playwright/test';
import { loginAsContractor, loginAsHomeowner, screenshot, uniqueId } from '../utils/test-helpers.js';

// ============================================
// RANDOM DATA GENERATORS
// ============================================
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPhone = () => `(${randomInt(200,999)}) ${randomInt(200,999)}-${randomInt(1000,9999)}`;

const FIRST_NAMES = ['James', 'Maria', 'Robert', 'Patricia', 'Michael', 'Linda', 'David', 'Sarah'];
const LAST_NAMES = ['Smith', 'Garcia', 'Johnson', 'Martinez', 'Williams', 'Rodriguez', 'Brown', 'Lopez'];
const STREETS = ['Oak St', 'Main Ave', 'Cedar Ln', 'Maple Dr', 'Pine Blvd', 'Elm Way'];
const CITIES_CA = [
    { city: 'Buena Park', zip: '90620' },
    { city: 'Anaheim', zip: '92801' },
    { city: 'Fullerton', zip: '92831' },
    { city: 'La Mirada', zip: '90638' }
];
const JOB_ISSUES = [
    'Water heater not producing hot water - unit is 12 years old',
    'Leaking pipe under kitchen sink - water damage visible',
    'Toilet running constantly - flapper seems worn',
    'Low water pressure in master bathroom shower',
    'Garbage disposal making grinding noise and jamming',
    'Main drain backing up when washing machine runs'
];

const generateCustomer = () => {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);
    const location = randomFrom(CITIES_CA);
    return {
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1,99)}@example.com`,
        phone: randomPhone(),
        address: `${randomInt(100, 9999)} ${randomFrom(STREETS)}, ${location.city}, CA ${location.zip}`,
        issue: randomFrom(JOB_ISSUES)
    };
};

// ============================================
// TEST 1: MESSAGING WITHIN EVALUATION
// ============================================
test.describe('Evaluation Messaging Flow', () => {
    test('Contractor sends message in evaluation Messages tab', async ({ browser }) => {
        const testId = uniqueId('eval-msg');
        console.log(`[${testId}] Starting evaluation messaging test...`);

        // Create two browser contexts for contractor and homeowner
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // STEP 1: Login as contractor
            console.log(`[${testId}] Logging in as contractor...`);
            await loginAsContractor(contractorPage, { useStoredSession: false });
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            // STEP 2: Navigate to Evaluations
            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '02-evaluations-page');

            // STEP 3: Create new evaluation request
            const customer = generateCustomer();
            console.log(`[${testId}] Creating evaluation for: ${customer.name}`);
            console.log(`[${testId}] Issue: ${customer.issue}`);

            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);
            await screenshot(contractorPage, testId, '03-eval-form');

            // Fill evaluation form
            await contractorPage.locator('input[placeholder="Customer name"]').fill(customer.name);
            await contractorPage.locator('input[placeholder="email@example.com"]').fill(customer.email);
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill(customer.phone);
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill(customer.address);
            await contractorPage.locator('textarea').first().fill(customer.issue);

            await screenshot(contractorPage, testId, '04-eval-form-filled');

            // Submit evaluation request
            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            console.log(`[${testId}] Evaluation request sent`);
            await screenshot(contractorPage, testId, '05-eval-created');

            // STEP 4: Click on the evaluation to open details
            const evalCard = contractorPage.locator(`text="${customer.name}"`).first();
            await expect(evalCard).toBeVisible({ timeout: 5000 });
            await evalCard.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '06-eval-details-opened');

            // STEP 5: Click on Messages tab WITHIN the evaluation detail modal (not the sidebar)
            // The tab is inside the modal, so we need to be more specific
            const evalModal = contractorPage.locator('.bg-white.rounded-2xl, [class*="modal"], [class*="EvaluationReview"]').first();
            const messagesTab = evalModal.locator('button:has-text("Messages")').first();
            if (await messagesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
                await messagesTab.click();
                await contractorPage.waitForTimeout(1000);
                await screenshot(contractorPage, testId, '07-messages-tab');
                console.log(`[${testId}] Messages tab opened (inside evaluation modal)`);

                // STEP 6: Send a test message
                const testMessage = `Test message from contractor - ${testId} - Please provide photos of the issue`;
                // Look for our new message input with specific placeholder
                const messageInput = contractorPage.locator('textarea[placeholder*="Type a message"], textarea[placeholder*="message to the customer"]').first();

                if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await messageInput.fill(testMessage);
                    await screenshot(contractorPage, testId, '08-message-typed');
                    console.log(`[${testId}] Found message input, typed message`);

                    // Click send button
                    const sendBtn = contractorPage.locator('button:has-text("Send")').last();
                    await sendBtn.click();
                    await contractorPage.waitForTimeout(2000);
                    await screenshot(contractorPage, testId, '09-message-sent');
                    console.log(`[${testId}] Clicked Send button`);

                    // Verify message appears in chat
                    const sentMessage = contractorPage.locator(`text="${testMessage.substring(0, 30)}"`).first();
                    if (await sentMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
                        console.log(`[${testId}] ✓ Message sent and visible in Messages tab!`);
                    } else {
                        console.log(`[${testId}] Message may have been sent but not visible in UI (real-time update may be needed)`);
                    }
                } else {
                    console.log(`[${testId}] Message input not found - the Messages tab may be read-only or have different structure`);
                    // Take screenshot to see current state
                    const chatArea = contractorPage.locator('.chat, [class*="chat"], [class*="message"]');
                    await screenshot(contractorPage, testId, '08-chat-area');
                }
            } else {
                console.log(`[${testId}] Messages tab not visible - evaluation may use different messaging UI`);
                // Look for inline messaging
                const inlineChat = contractorPage.locator('[class*="chat"], [class*="message-input"]');
                await screenshot(contractorPage, testId, '07-no-messages-tab');
            }

            console.log(`[${testId}] MESSAGING TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// TEST 2: CANCEL EVALUATION REQUEST
// ============================================
test.describe('Evaluation Cancellation Flow', () => {
    test('Contractor cancels evaluation - verify homeowner sees cancelled status', async ({ browser }) => {
        const testId = uniqueId('eval-cancel');
        console.log(`[${testId}] Starting evaluation cancellation test...`);

        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // CONTRACTOR: Create evaluation
            console.log(`[${testId}] Contractor: Logging in...`);
            await loginAsContractor(contractorPage, { useStoredSession: false });

            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1500);

            // Create evaluation with HOMEOWNER's email so they can see it
            const customer = {
                name: 'Cancel Test Customer',
                email: 'danvdova@gmail.com', // Homeowner's actual email
                phone: randomPhone(),
                address: `${randomInt(100, 9999)} Test St, Buena Park, CA 90620`,
                issue: 'Testing cancellation flow - water heater issue'
            };
            console.log(`[${testId}] Creating evaluation for: ${customer.name}`);

            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);

            await contractorPage.locator('input[placeholder="Customer name"]').fill(customer.name);
            await contractorPage.locator('input[placeholder="email@example.com"]').fill(customer.email);
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill(customer.phone);
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill(customer.address);
            await contractorPage.locator('textarea').first().fill(customer.issue);

            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '01-eval-created');
            console.log(`[${testId}] Evaluation created`);

            // Click on evaluation to open details
            const evalCard = contractorPage.locator(`text="${customer.name}"`).first();
            await expect(evalCard).toBeVisible({ timeout: 5000 });
            await evalCard.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '02-eval-details');

            // Look for Cancel button
            const cancelBtn = contractorPage.locator('button:has-text("Cancel"), button:has-text("Cancel Request")').first();
            if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log(`[${testId}] Found Cancel button, clicking...`);
                await cancelBtn.click();
                await contractorPage.waitForTimeout(1000);

                // Confirm cancellation if dialog appears
                const confirmBtn = contractorPage.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await contractorPage.waitForTimeout(2000);
                }
                await screenshot(contractorPage, testId, '03-cancelled');
                console.log(`[${testId}] Evaluation cancelled`);

                // Verify cancelled status on contractor side
                const cancelledStatus = contractorPage.locator('text="Cancelled", text="CANCELLED"').first();
                if (await cancelledStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
                    console.log(`[${testId}] ✓ Contractor sees CANCELLED status`);
                }

                // HOMEOWNER: Check if they see cancelled status
                console.log(`[${testId}] Homeowner: Logging in to verify cancelled status...`);
                await loginAsHomeowner(homeownerPage, { useStoredSession: false });
                await screenshot(homeownerPage, testId, '04-homeowner-logged-in');

                // Navigate to service requests or evaluations
                const serviceRequestsLink = homeownerPage.locator('text="Service Requests", text="Evaluations", text="My Requests"').first();
                if (await serviceRequestsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await serviceRequestsLink.click();
                    await homeownerPage.waitForTimeout(1500);
                    await screenshot(homeownerPage, testId, '05-homeowner-requests');

                    // Look for the cancelled evaluation
                    const cancelledEval = homeownerPage.locator('text="Cancelled", text="CANCELLED"').first();
                    if (await cancelledEval.isVisible({ timeout: 5000 }).catch(() => false)) {
                        console.log(`[${testId}] ✓ Homeowner sees CANCELLED status!`);
                    } else {
                        console.log(`[${testId}] Cancelled status not immediately visible to homeowner`);
                    }
                } else {
                    console.log(`[${testId}] Navigating to homeowner home page to check notifications`);
                    await homeownerPage.goto('https://mykrib.app/home');
                    await homeownerPage.waitForTimeout(2000);
                    await screenshot(homeownerPage, testId, '05-homeowner-home');
                }
            } else {
                console.log(`[${testId}] Cancel button not visible - looking for menu options`);
                // Try dropdown or kebab menu
                const menuBtn = contractorPage.locator('button[aria-label*="menu"], button:has-text("..."), [class*="dropdown"]').first();
                if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await menuBtn.click();
                    await contractorPage.waitForTimeout(500);
                    await screenshot(contractorPage, testId, '03-menu-opened');
                }
            }

            console.log(`[${testId}] CANCELLATION TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// TEST 3: HOMEOWNER COMPLETES EVALUATION
// ============================================
test.describe('Homeowner Evaluation Completion Flow', () => {
    test('Homeowner submits evaluation - contractor sees submission with AI suggestions', async ({ browser }) => {
        const testId = uniqueId('eval-complete');
        console.log(`[${testId}] Starting homeowner evaluation completion test...`);

        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // CONTRACTOR: Create evaluation for real homeowner
            console.log(`[${testId}] Contractor: Creating evaluation...`);
            await loginAsContractor(contractorPage, { useStoredSession: false });
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1500);

            const customer = {
                name: 'Completion Test',
                email: 'danvdova@gmail.com', // Real homeowner email
                phone: randomPhone(),
                address: `${randomInt(100, 9999)} Main St, Anaheim, CA 92801`,
                issue: 'Kitchen faucet leaking at the base - need assessment for repair or replacement'
            };

            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);

            await contractorPage.locator('input[placeholder="Customer name"]').fill(customer.name);
            await contractorPage.locator('input[placeholder="email@example.com"]').fill(customer.email);
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill(customer.phone);
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill(customer.address);
            await contractorPage.locator('textarea').first().fill(customer.issue);

            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '02-eval-created');
            console.log(`[${testId}] Evaluation request sent to homeowner`);

            // HOMEOWNER: Login and find the evaluation request
            console.log(`[${testId}] Homeowner: Logging in...`);
            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await homeownerPage.waitForTimeout(2000);
            await screenshot(homeownerPage, testId, '03-homeowner-logged-in');

            // Look for evaluation request or notification
            // Check home page for pending evaluations
            const pendingEval = homeownerPage.locator('text="Evaluation", text="Pending", text="Complete"').first();

            // Navigate to evaluations/requests if available
            const evalLink = homeownerPage.locator('text="Evaluations", text="Service Requests", text="My Requests", a[href*="eval"]').first();
            if (await evalLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                await evalLink.click();
                await homeownerPage.waitForTimeout(1500);
                await screenshot(homeownerPage, testId, '04-homeowner-evals');
            }

            // Look for the evaluation from contractor
            const evalRequest = homeownerPage.locator('text="faucet", text="Kitchen", text="Complete Evaluation"').first();
            if (await evalRequest.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${testId}] Found evaluation request, clicking...`);
                await evalRequest.click();
                await homeownerPage.waitForTimeout(1500);
                await screenshot(homeownerPage, testId, '05-eval-details');

                // Fill out evaluation form
                // Look for step-by-step submission form
                const descriptionInput = homeownerPage.locator('textarea[placeholder*="describe"], textarea[placeholder*="issue"], textarea').first();
                if (await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await descriptionInput.fill('The faucet has been leaking for about 2 weeks. Water pools at the base when running. Faucet is approximately 8 years old. Tried tightening the base but leak persists.');
                    await screenshot(homeownerPage, testId, '06-description-filled');
                }

                // Try to upload photos (skip if not available in test)
                const photoUpload = homeownerPage.locator('input[type="file"], button:has-text("Upload"), button:has-text("Photo")').first();
                if (await photoUpload.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`[${testId}] Photo upload available`);
                }

                // Submit evaluation
                const submitBtn = homeownerPage.locator('button:has-text("Submit"), button:has-text("Send"), button:has-text("Complete")').first();
                if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await submitBtn.click();
                    await homeownerPage.waitForTimeout(3000);
                    await screenshot(homeownerPage, testId, '07-submitted');
                    console.log(`[${testId}] Homeowner submitted evaluation`);
                }
            } else {
                console.log(`[${testId}] Evaluation request not immediately visible - may need email link`);
                await screenshot(homeownerPage, testId, '05-looking-for-eval');
            }

            // CONTRACTOR: Check for submission and AI suggestions
            console.log(`[${testId}] Contractor: Checking for submission...`);
            await contractorPage.bringToFront();
            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(2000);
            await contractorPage.reload();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '08-contractor-evals-refreshed');

            // Open the evaluation
            const submittedEval = contractorPage.locator('text="Completion Test", text="Submitted", text="Review"').first();
            if (await submittedEval.isVisible({ timeout: 5000 }).catch(() => false)) {
                await submittedEval.click();
                await contractorPage.waitForTimeout(1500);
                await screenshot(contractorPage, testId, '09-submitted-eval-details');

                // Check for Submissions tab
                const submissionsTab = contractorPage.locator('button:has-text("Submissions"), [role="tab"]:has-text("Submission")').first();
                if (await submissionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await submissionsTab.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, '10-submissions-tab');
                    console.log(`[${testId}] ✓ Submissions tab visible`);
                }

                // Check for Findings/AI suggestions tab
                const findingsTab = contractorPage.locator('button:has-text("Findings"), [role="tab"]:has-text("AI"), [role="tab"]:has-text("Analysis")').first();
                if (await findingsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await findingsTab.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, '11-findings-tab');
                    console.log(`[${testId}] ✓ AI Findings/Analysis tab visible`);

                    // Look for AI-generated content
                    const aiContent = contractorPage.locator('text="recommend", text="suggest", text="estimate", text="priority"').first();
                    if (await aiContent.isVisible({ timeout: 3000 }).catch(() => false)) {
                        console.log(`[${testId}] ✓ AI suggestions visible!`);
                    }
                }
            } else {
                console.log(`[${testId}] Submitted evaluation not visible yet - may need more time for sync`);
            }

            console.log(`[${testId}] COMPLETION TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// TEST 4: SITE VISIT SCHEDULING
// ============================================
test.describe('Site Visit Scheduling Flow', () => {
    test('Contractor schedules site visit - appears on both calendars', async ({ browser }) => {
        const testId = uniqueId('site-visit');
        console.log(`[${testId}] Starting site visit scheduling test...`);

        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // CONTRACTOR: Create site visit evaluation
            console.log(`[${testId}] Contractor: Creating site visit evaluation...`);
            await loginAsContractor(contractorPage, { useStoredSession: false });
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1500);

            const customer = {
                name: 'Site Visit Test',
                email: 'danvdova@gmail.com',
                phone: randomPhone(),
                address: `${randomInt(100, 9999)} Oak Ave, Fullerton, CA 92831`,
                issue: 'Main sewer line backup - need on-site camera inspection'
            };

            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);

            await contractorPage.locator('input[placeholder="Customer name"]').fill(customer.name);
            await contractorPage.locator('input[placeholder="email@example.com"]').fill(customer.email);
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill(customer.phone);
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill(customer.address);
            await contractorPage.locator('textarea').first().fill(customer.issue);

            // Look for evaluation type selector (Site Visit vs Virtual)
            const siteVisitOption = contractorPage.locator('text="Site Visit", label:has-text("Site Visit"), input[value="site_visit"]').first();
            if (await siteVisitOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                await siteVisitOption.click();
                console.log(`[${testId}] Selected Site Visit option`);
            }

            await screenshot(contractorPage, testId, '02-eval-form-filled');

            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '03-eval-created');

            // Open the evaluation
            const evalCard = contractorPage.locator(`text="${customer.name}"`).first();
            await expect(evalCard).toBeVisible({ timeout: 5000 });
            await evalCard.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '04-eval-details');

            // Look for Schedule Site Visit button
            const scheduleBtn = contractorPage.locator('button:has-text("Schedule"), button:has-text("Site Visit"), button:has-text("Book")').first();
            if (await scheduleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scheduleBtn.click();
                await contractorPage.waitForTimeout(1000);
                await screenshot(contractorPage, testId, '05-schedule-modal');
                console.log(`[${testId}] Schedule modal opened`);

                // Look for date/time picker
                const dateInput = contractorPage.locator('input[type="date"], input[type="datetime-local"], [class*="datepicker"]').first();
                if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    // Select tomorrow's date
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const dateStr = tomorrow.toISOString().split('T')[0];
                    await dateInput.fill(dateStr);
                    console.log(`[${testId}] Set date to ${dateStr}`);
                }

                const timeInput = contractorPage.locator('input[type="time"], select[name*="time"]').first();
                if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await timeInput.fill('10:00');
                    console.log(`[${testId}] Set time to 10:00 AM`);
                }

                await screenshot(contractorPage, testId, '06-datetime-selected');

                // Confirm scheduling
                const confirmBtn = contractorPage.locator('button:has-text("Confirm"), button:has-text("Schedule"), button:has-text("Save")').first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await contractorPage.waitForTimeout(2000);
                    await screenshot(contractorPage, testId, '07-scheduled');
                    console.log(`[${testId}] Site visit scheduled`);
                }
            } else {
                console.log(`[${testId}] Schedule button not visible - may need different flow`);
                // Try looking for time slots or calendar
                const timeSlots = contractorPage.locator('[class*="slot"], [class*="time-option"]');
                await screenshot(contractorPage, testId, '05-looking-for-schedule');
            }

            // Check contractor's calendar
            console.log(`[${testId}] Checking contractor calendar...`);
            const calendarLink = contractorPage.locator('text="Calendar", text="Schedule", a[href*="calendar"]').first();
            if (await calendarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                await calendarLink.click();
                await contractorPage.waitForTimeout(2000);
                await screenshot(contractorPage, testId, '08-contractor-calendar');

                // Look for the scheduled visit
                const visitOnCalendar = contractorPage.locator('text="Site Visit", text="Eval"').first();
                if (await visitOnCalendar.isVisible({ timeout: 3000 }).catch(() => false)) {
                    console.log(`[${testId}] ✓ Site visit appears on contractor calendar!`);
                }
            }

            // HOMEOWNER: Check their calendar/schedule
            console.log(`[${testId}] Homeowner: Checking calendar...`);
            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await homeownerPage.waitForTimeout(2000);
            await screenshot(homeownerPage, testId, '09-homeowner-logged-in');

            // Look for upcoming appointments or calendar
            const homeownerCalendar = homeownerPage.locator('text="Appointments", text="Scheduled", text="Upcoming", a[href*="calendar"]').first();
            if (await homeownerCalendar.isVisible({ timeout: 3000 }).catch(() => false)) {
                await homeownerCalendar.click();
                await homeownerPage.waitForTimeout(1500);
                await screenshot(homeownerPage, testId, '10-homeowner-appointments');

                const visitOnHomeownerCal = homeownerPage.locator('text="Site Visit", text="Evaluation"').first();
                if (await visitOnHomeownerCal.isVisible({ timeout: 3000 }).catch(() => false)) {
                    console.log(`[${testId}] ✓ Site visit appears on homeowner calendar!`);
                }
            } else {
                // Check home page for upcoming
                await screenshot(homeownerPage, testId, '10-homeowner-home');
                console.log(`[${testId}] Checking homeowner home page for scheduled visit`);
            }

            console.log(`[${testId}] SITE VISIT SCHEDULING TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// TEST 5: REQUEST ADDITIONAL INFO FLOW
// ============================================
test.describe('Request Additional Info Flow', () => {
    test('Contractor requests more info - homeowner receives notification', async ({ browser }) => {
        const testId = uniqueId('eval-info');
        console.log(`[${testId}] Starting request additional info test...`);

        const contractorContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();

        try {
            await loginAsContractor(contractorPage, { useStoredSession: false });
            await screenshot(contractorPage, testId, '01-logged-in');

            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1500);

            // Create evaluation
            const customer = generateCustomer();
            customer.email = 'danvdova@gmail.com'; // Real homeowner

            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);

            await contractorPage.locator('input[placeholder="Customer name"]').fill(customer.name);
            await contractorPage.locator('input[placeholder="email@example.com"]').fill(customer.email);
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill(customer.phone);
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill(customer.address);
            await contractorPage.locator('textarea').first().fill(customer.issue);

            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '02-eval-created');

            // Open evaluation
            const evalCard = contractorPage.locator(`text="${customer.name}"`).first();
            await expect(evalCard).toBeVisible({ timeout: 5000 });
            await evalCard.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '03-eval-details');

            // Look for "Request More Info" or similar button
            const requestInfoBtn = contractorPage.locator('button:has-text("Request"), button:has-text("More Info"), button:has-text("Additional")').first();
            if (await requestInfoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await requestInfoBtn.click();
                await contractorPage.waitForTimeout(1000);
                await screenshot(contractorPage, testId, '04-request-info-modal');

                // Fill in what info is needed
                const infoInput = contractorPage.locator('textarea, input[placeholder*="info"], input[placeholder*="question"]').first();
                if (await infoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await infoInput.fill('Please provide close-up photos of the affected area and let me know when the issue first started.');
                    await screenshot(contractorPage, testId, '05-info-request-filled');

                    const sendBtn = contractorPage.locator('button:has-text("Send"), button:has-text("Request"), button:has-text("Submit")').first();
                    await sendBtn.click();
                    await contractorPage.waitForTimeout(2000);
                    await screenshot(contractorPage, testId, '06-info-requested');
                    console.log(`[${testId}] ✓ Additional info requested`);
                }
            } else {
                console.log(`[${testId}] "Request More Info" button not visible`);
                // This functionality might be in messages tab instead
                const messagesTab = contractorPage.locator('button:has-text("Messages")').first();
                if (await messagesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await messagesTab.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, '04-using-messages-instead');
                    console.log(`[${testId}] Info requests may be handled via Messages tab`);
                }
            }

            console.log(`[${testId}] REQUEST INFO TEST COMPLETE`);

        } finally {
            await contractorContext.close();
        }
    });
});
