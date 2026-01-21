# Krib Platform Recommendations
## Comprehensive Analysis from Dispatcher Simulation Exercise

**Date**: January 2026
**Scenario**: Small HVAC business (3-person shop) processing a multi-day AC replacement job
**Methodology**: End-to-end simulation from lead capture through payment collection

---

## Executive Summary

The Krib platform has strong foundational architecture for the evaluation → quote → job → completion pipeline. The home record integration is a genuine differentiator. However, critical gaps in field operations, payment collection, and technician experience create friction that would drive small business owners to competitors like Jobber or Housecall Pro.

**Verdict**: Platform is 70% there. The 30% gap is concentrated in field operations and payment automation—both high-impact, high-visibility pain points.

---

## Table of Contents

1. [Critical Priority (P0) - Business Blockers](#p0-critical---business-blockers)
2. [High Priority (P1) - Competitive Parity](#p1-high---competitive-parity)
3. [Medium Priority (P2) - Experience Improvements](#p2-medium---experience-improvements)
4. [Lower Priority (P3) - Nice to Have](#p3-lower---nice-to-have)
5. [Strategic Differentiators](#strategic-differentiators)
6. [Technical Debt & Architecture](#technical-debt--architecture)
7. [Implementation Roadmap](#implementation-roadmap)

---

## P0: Critical - Business Blockers

These gaps would cause a contractor to abandon the platform within 30 days.

### 1. Tech Mobile Experience (PWA/App)

**Current State**: Technicians have no mobile-optimized way to view their schedule, job details, or interact with jobs in the field.

**Impact**:
- Contractors must manually text/call techs with job details daily
- Techs can't mark arrival, progress, or completion
- No navigation integration
- Completely breaks field workflow

**Recommendation**:
```
Create a Tech Mobile PWA with:

CORE FEATURES:
├── Today's Schedule
│   ├── List of assigned jobs with times
│   ├── Pull-to-refresh
│   └── Tomorrow preview
│
├── Job Details View
│   ├── Customer name, phone (tap to call)
│   ├── Address (tap for navigation)
│   ├── Job description & notes
│   ├── Photos from evaluation
│   ├── Equipment/materials list
│   └── Crew members assigned
│
├── Status Actions
│   ├── "On My Way" → notifies customer + office
│   ├── "Arrived" → starts job timer
│   ├── "Completed" → triggers completion flow
│   └── "Issue/Delay" → alerts dispatcher
│
├── Photo Capture
│   ├── Before/during/after categories
│   ├── Timestamped, GPS-tagged
│   └── Auto-sync to job record
│
└── Expense Capture
    ├── Snap receipt photo
    ├── OCR auto-fills amount/vendor
    └── Auto-links to current job
```

**Technical Approach**:
- Progressive Web App (installable, works offline)
- Service worker for background sync
- Push notifications via Firebase Cloud Messaging
- Separate auth flow for tech users (simplified)

**Effort Estimate**: 3-4 weeks
**Business Impact**: Critical for adoption

---

### 2. Digital Signature Capture

**Current State**: No way to capture customer signature at job completion.

**Impact**:
- Liability risk - customer can dispute work was done
- No proof of acceptance
- Can't verify customer saw final invoice amount
- Insurance/legal exposure

**Recommendation**:
```
Add Signature Capture Component:

CAPTURE FLOW:
1. At job completion (Step 5: Review)
2. Show summary: work completed, items installed, balance due
3. Customer signs on device (finger/stylus)
4. Capture: signature image + timestamp + GPS + device ID
5. Store in job record, attach to invoice PDF

SIGNATURE DATA:
{
  signatureImage: "base64 or URL",
  signedAt: "2026-01-21T17:30:00Z",
  signedBy: "Mrs. Johnson",
  signerRelationship: "homeowner", // or "tenant", "property manager"
  deviceInfo: "iPhone 14, Safari",
  gpsLocation: { lat: 33.123, lng: -117.456 },
  ipAddress: "redacted",
  documentsSigned: ["completion_summary", "invoice_5432"]
}

LEGAL TEXT:
"By signing below, I acknowledge that the work described above
has been completed to my satisfaction and I agree to the charges shown."
```

**Technical Approach**:
- Use `signature_pad` library or similar
- Canvas-based capture
- Export as PNG, store in Cloud Storage
- Embed in PDF invoice

**Effort Estimate**: 1 week
**Business Impact**: Critical for liability protection

---

### 3. Field Payment Collection

**Current State**: Payment can only be collected via email link after the fact. No option to collect payment while tech is on-site.

**Impact**:
- Delays cash flow by days/weeks
- Customer friction (another email to deal with)
- Missed opportunity when customer is ready to pay
- Tech can't close the loop

**Recommendation**:
```
THREE PAYMENT OPTIONS AT COMPLETION:

OPTION A: QR Code Payment
├── Generate dynamic QR code with Stripe Payment Link
├── Customer scans with phone camera
├── Opens Stripe Checkout on their device
├── Payment completes → job auto-updates
└── Works: customer has phone, prefers own device

OPTION B: Card Reader (Stripe Terminal)
├── Tech has Stripe Terminal device (Chipper, WisePOS)
├── Tap/insert/swipe card
├── Receipt via email or SMS
└── Works: customer prefers card, no phone

OPTION C: Card on File (Auto-Charge)
├── Card saved at quote acceptance (Setup Intent)
├── Customer pre-authorizes completion charge
├── At completion: auto-charge balance
├── Send receipt, job marked paid
└── Works: repeat customers, pre-authorized

FALLBACK: Email Invoice
├── Traditional: send payment link via email
├── With auto-reminders (3, 7, 14 days)
└── Works: customer not present, B2B
```

**Technical Approach**:
- QR: Stripe Payment Links API (already have Stripe)
- Terminal: Stripe Terminal SDK (hardware required)
- Card on File: Stripe Setup Intents + Payment Intents
- Webhooks to auto-update job payment status

**Effort Estimate**: 2-3 weeks
**Business Impact**: Critical for cash flow

---

### 4. Tech Assignment Notifications

**Current State**: When dispatcher assigns a tech to a job, the tech receives no notification. Relies on manual communication.

**Impact**:
- Dispatcher must call/text every assignment
- Techs miss updates if dispatcher forgets
- No audit trail of notification
- Breaks async workflow

**Recommendation**:
```
NOTIFICATION TRIGGERS:

ON ASSIGNMENT:
├── SMS: "New job assigned: AC Repair at 123 Main St, Wed 9am.
│         Open app for details: [link]"
├── Push: Same message, tappable to open job
└── In-app: Badge on schedule, job highlighted as "new"

ON SCHEDULE CHANGE:
├── SMS: "Schedule update: Your 2pm job moved to 3pm"
├── Push: Tappable to see changes
└── In-app: Visual diff of what changed

ON UNASSIGNMENT:
├── SMS: "Job removed: AC Repair at 123 Main St is no longer assigned to you"
└── In-app: Job removed from schedule

CUSTOMER NOTIFICATIONS (parallel):
├── "Your technician Jake is on the way"
├── "Jake has arrived"
├── "Work completed - please review"
```

**Technical Approach**:
- Twilio SMS (already integrated)
- Firebase Cloud Messaging for push
- Trigger from `assignCrewToJob()` and `updateJobSchedule()`
- Notification preferences per tech (SMS, push, both, none)

**Effort Estimate**: 1-2 weeks
**Business Impact**: Critical for operational efficiency

---

## P1: High - Competitive Parity

These are features competitors have that users expect.

### 5. Automated Payment Reminders

**Current State**: Payment reminder cron job exists but unclear if configured/working. No contractor-visible settings.

**Recommendation**:
```
PAYMENT REMINDER SETTINGS (per contractor):

Settings UI:
├── Enable automatic reminders: [toggle]
├── Reminder schedule:
│   ├── First reminder: [3] days after invoice
│   ├── Second reminder: [7] days after invoice
│   └── Final reminder: [14] days after invoice
├── Reminder channel: [Email] [SMS] [Both]
├── Include late fee warning after: [30] days
└── Auto-apply late fee of: [$0] or [5%]

REMINDER EMAIL TEMPLATE:
Subject: "Reminder: Invoice #1234 - $3,247.50 due"
Body:
- Original invoice date
- Amount due
- Days overdue
- Pay now button (Stripe link)
- Contact info for questions

ESCALATION:
- Day 30+: "Final Notice" language
- Day 45+: Option to pause future work for customer
- Day 60+: Collections workflow (external integration?)
```

**Effort Estimate**: 1 week
**Business Impact**: High - reduces manual chase, improves cash flow

---

### 6. Time Slot Offering After Quote Acceptance

**Current State**: When customer accepts quote, job is created in "Pending Schedule" status. Contractor must manually schedule.

**Recommendation**:
```
AUTOMATIC SCHEDULING FLOW:

OPTION A: Contractor Offers Slots (Default)
1. Quote accepted
2. System prompts contractor: "Offer time slots to customer?"
3. Contractor selects 3-5 available slots
4. Customer receives email: "Pick a time for your service"
5. Customer selects → job auto-scheduled
6. Both parties notified

OPTION B: Customer Requests Times
1. Quote accepted
2. Customer sees: "Request preferred times"
3. Customer enters 2-3 preferences
4. Contractor confirms one → job scheduled

OPTION C: Direct Schedule (Urgent)
1. Quote accepted
2. Contractor schedules immediately
3. Customer notified of scheduled time
4. Customer can request change if needed

SMART DEFAULTS:
- For evaluations marked "urgent" → prompt immediate scheduling
- For large jobs (>$2000) → offer slots within 1 week
- For small jobs (<$500) → can direct schedule
```

**Effort Estimate**: 1-2 weeks
**Business Impact**: High - reduces scheduling friction, improves customer experience

---

### 7. Price Book Integration in Quote Builder

**Current State**: Contractor manually types every line item. No saved items, no search.

**Recommendation**:
```
PRICE BOOK SYSTEM:

STRUCTURE:
├── Categories (HVAC, Plumbing, Electrical, etc.)
│   ├── Items
│   │   ├── Name: "Trane XR14 3-Ton AC Unit"
│   │   ├── SKU: "TRANE-XR14-3T"
│   │   ├── Default Price: $3,200
│   │   ├── Cost: $2,100 (for margin calc)
│   │   ├── Unit: "each"
│   │   ├── Tax Category: "equipment"
│   │   ├── Add to Home Record: true
│   │   └── Maintenance Schedule: "annual AC tune-up"
│   │
│   └── Labor Templates
│       ├── Name: "AC Installation - Standard"
│       ├── Hours: 16
│       ├── Crew Size: 2
│       ├── Rate: $75/hr
│       └── Total: $1,200

QUOTE BUILDER INTEGRATION:
1. Type in line item field → autocomplete from price book
2. Select item → auto-fills price, cost, tax category
3. "Browse Price Book" button → modal with search/filter
4. Drag items from price book → quote
5. Can still add custom items not in price book

IMPORT/EXPORT:
- Import from CSV (migration from other systems)
- Export for backup
- Sync with supplier catalogs (future)
```

**Effort Estimate**: 2-3 weeks
**Business Impact**: High - speeds up quoting, ensures consistency

---

### 8. Customer Communication Preferences

**Current State**: Communications go via email only. No SMS option for evaluations, quotes, reminders.

**Recommendation**:
```
COMMUNICATION PREFERENCES:

PER CUSTOMER:
├── Preferred channel: [Email] [SMS] [Both]
├── Email: customer@email.com
├── Phone: (555) 123-4567
└── Do not contact: [toggle]

PER MESSAGE TYPE:
├── Evaluations: [Email + SMS]
├── Quotes: [Email only]
├── Scheduling: [SMS + Email]
├── Day-of updates: [SMS only]
├── Invoices: [Email only]
└── Payment reminders: [Email + SMS]

SMS TEMPLATES:
- Evaluation: "Hi {name}, {contractor} sent you a request.
              View and respond: {link}"
- Quote: "Your quote for {job} is ready: {link}"
- Reminder: "{contractor}: Your appt is tomorrow at {time}.
            Reply CONFIRM or call {phone} to reschedule."
- On the way: "{tech} is on the way. ETA: {time}"
```

**Effort Estimate**: 2 weeks
**Business Impact**: High - meets customers where they are

---

### 9. Multi-Day Job Automation

**Current State**: Multi-day jobs are tracked but require manual management each day. No auto-continuation, no daily summaries.

**Recommendation**:
```
MULTI-DAY JOB FEATURES:

AUTO-SCHEDULING:
├── Job spans Mon-Wed
├── Automatically appears on dispatch board each day
├── Same crew auto-assigned (unless manually changed)
└── Shows "Day 2 of 3" badge

DAILY HANDOFF:
├── End of Day 1: Prompt to log progress notes
├── "What was completed today?"
├── "What's planned for tomorrow?"
├── Optional: Send customer daily summary

CREW CONTINUITY:
├── Prefer same crew all days (configurable)
├── If crew member unavailable Day 2:
│   ├── Alert dispatcher
│   ├── Suggest replacements
│   └── Notify customer of crew change

COMPLETION:
├── Only allow "Complete Job" on final day
├── Aggregate all daily photos
├── Show total hours worked across days
└── Invoice reflects full job scope
```

**Effort Estimate**: 2 weeks
**Business Impact**: High - critical for larger jobs

---

### 10. Expense-to-Job Intelligence

**Current State**: Expenses can be linked to jobs but it's manual. No comparison to estimates, no profit tracking during job.

**Recommendation**:
```
EXPENSE TRACKING IMPROVEMENTS:

AUTO-LINKING:
├── If tech on active job + adds expense → auto-suggest link
├── GPS proximity to job site → confirm link
└── Receipt date matches job date → likely this job

BUDGET VS ACTUAL:
├── Quote materials: $450 estimated
├── Actual expenses: $340 materials + $45 supplies
├── Variance: -$65 (under budget)
└── Show on job card: "Expenses: $385 / $450 budget"

PROFIT MARGIN (Real-time):
├── Revenue: $6,495
├── Labor Cost: $1,200 (estimated from hours × rates)
├── Material Cost: $385 (actual expenses)
├── Gross Profit: $4,910
├── Margin: 75.6%
└── Compare to: Category average (68%), This customer average (72%)

ALERTS:
├── "Expenses exceeding estimate by 20%" → notify dispatcher
├── "No expenses logged for 2-day job" → remind tech
└── "Margin below 50%" → flag for review
```

**Effort Estimate**: 2 weeks
**Business Impact**: High - critical for profitability management

---

## P2: Medium - Experience Improvements

These improve the experience but aren't blocking adoption.

### 11. AI Evaluation Analysis Display

**Current State**: AI analyzes evaluation submissions but findings aren't prominently displayed to contractor.

**Recommendation**:
```
AI ANALYSIS CARD (in EvaluationReview):

┌─────────────────────────────────────────────────────┐
│ 🤖 AI Analysis                                      │
├─────────────────────────────────────────────────────┤
│ EQUIPMENT DETECTED:                                 │
│ • Carrier 24ACC636 (2006) - 18 years old           │
│ • R-22 refrigerant system (discontinued)           │
│                                                     │
│ OBSERVED ISSUES:                                    │
│ • Compressor appears seized (based on photo 3)     │
│ • Visible refrigerant leak at service valve        │
│ • Condenser coils heavily soiled                   │
│                                                     │
│ RECOMMENDATION:                                     │
│ Full system replacement recommended due to:        │
│ 1. Age exceeds typical lifespan (15 years)         │
│ 2. R-22 refrigerant no longer available            │
│ 3. Compressor failure is not economical to repair  │
│                                                     │
│ SUGGESTED QUOTE ITEMS:                              │
│ • 3-ton AC unit (based on home sq ft)             │
│ • New refrigerant lines                            │
│ • Thermostat upgrade (current model discontinued)  │
│                                                     │
│ [Add Suggestions to Quote]                         │
└─────────────────────────────────────────────────────┘
```

**Effort Estimate**: 1-2 weeks
**Business Impact**: Medium - speeds up diagnosis, adds value

---

### 12. Inventory Intent Clarity

**Current State**: "Add to Home Record" functionality exists but is confusing in the quote builder UI.

**Recommendation**:
```
CLEARER UI IN QUOTE BUILDER:

For each line item:
┌──────────────────────────────────────────────────────────┐
│ Trane XR14 3-Ton AC Unit                      $3,200.00 │
│ ─────────────────────────────────────────────────────── │
│ ☑️ Track in customer's home record                      │
│    └── Sets up: Annual maintenance reminder             │
│                 Warranty tracking (10 years)            │
│                 Service history                         │
│                                                         │
│ 📋 Maintenance schedule: [Annual AC Tune-up ▼]         │
└──────────────────────────────────────────────────────────┘

AT JOB COMPLETION:
"These items will be added to the customer's home record
 when they approve the completed work:"

 ✓ Trane XR14 AC Unit
   • Warranty: 10 years parts, 1 year labor
   • First maintenance due: January 2027
   • Serial #: [________________]  ← tech enters

 ✓ Honeywell T6 Thermostat
   • Model: TH6210U2001
   • Battery replacement: Annual
```

**Effort Estimate**: 1 week
**Business Impact**: Medium - enables maintenance plan sales

---

### 13. Customer Job Visibility

**Current State**: After quote accepted, customer has limited visibility into job progress until completion.

**Recommendation**:
```
CUSTOMER JOB TRACKING PAGE:

STATUS TIMELINE:
○ Quote Accepted ─── ✓ Jan 20
○ Job Scheduled ──── ✓ Jan 21 (Wed-Thu, 8am-5pm)
○ Technician Assigned ─ ✓ Jake (Lead), Carlos
● Work In Progress ─── Day 1 of 2 complete
○ Work Completed
○ Your Review
○ Payment

LIVE UPDATES:
• "Jake is on the way" (with ETA)
• "Jake has arrived"
• "Day 1 complete - work continues tomorrow"
• Photo updates (if contractor enables)

ACTIONS AVAILABLE:
• Message contractor
• Request schedule change
• View invoice/payments
• Download documents
```

**Effort Estimate**: 2 weeks
**Business Impact**: Medium - improves customer experience, reduces calls

---

### 14. Recurring Job Templates

**Current State**: Recurring services exist but setup is manual and disconnected from completed jobs.

**Recommendation**:
```
POST-COMPLETION UPSELL:

After AC install completion:
┌──────────────────────────────────────────────────────────┐
│ 🔄 Set Up Maintenance Plan?                             │
│                                                          │
│ The Trane XR14 you installed benefits from annual       │
│ maintenance to maintain warranty and efficiency.        │
│                                                          │
│ ☐ Annual AC Tune-Up                                     │
│   • Next service: January 2027                          │
│   • Price: $149/visit                                   │
│   • Auto-schedule 30 days before due date               │
│                                                          │
│ ☐ HVAC Maintenance Membership ($299/year)               │
│   • Includes: 2 tune-ups (AC + Heating)                 │
│   • 15% discount on repairs                             │
│   • Priority scheduling                                  │
│                                                          │
│ [Skip for Now]  [Send Offer to Customer]                │
└──────────────────────────────────────────────────────────┘
```

**Effort Estimate**: 2 weeks
**Business Impact**: Medium - drives recurring revenue

---

### 15. Batch Operations

**Current State**: Many operations are one-at-a-time (assigning, invoicing, etc.).

**Recommendation**:
```
BATCH CAPABILITIES:

DISPATCH BOARD:
• Select multiple unassigned jobs → "Assign all to Jake"
• Select multiple jobs → "Move to Thursday"
• Select jobs → "Send schedule to customer" (batch email)

INVOICING:
• View all "Completed, Unpaid" jobs
• Select multiple → "Send payment reminders"
• Select multiple → "Generate invoice batch PDF"

CUSTOMERS:
• Select multiple customers → "Send marketing email"
• Select customers with unpaid balance → "Batch reminder"
```

**Effort Estimate**: 2 weeks
**Business Impact**: Medium - efficiency at scale

---

## P3: Lower - Nice to Have

### 16. Route Optimization Visual Map

**Current State**: Route optimization calculates optimal order but no map visualization.

**Recommendation**:
```
Add visual map showing:
• Tech's route for the day
• Stop numbers on pins
• Estimated drive times between stops
• Alternative routes if traffic
• "Open in Google Maps" for navigation
```

**Effort Estimate**: 2 weeks

---

### 17. Inventory/Parts Management

**Current State**: No truck inventory or parts tracking.

**Recommendation**:
```
Track what's on each truck:
• Parts inventory per vehicle
• Auto-deduct when used on job
• Low stock alerts
• Reorder suggestions
```

**Effort Estimate**: 4+ weeks

---

### 18. Time Clock Integration

**Current State**: Timesheets exist but separate from job tracking.

**Recommendation**:
```
• Auto clock-in when tech marks "Arrived"
• Auto clock-out when job completed
• Break tracking
• Overtime alerts
• Payroll export
```

**Effort Estimate**: 2-3 weeks

---

### 19. Customer Portal

**Current State**: Customers interact via email links. No persistent portal.

**Recommendation**:
```
Customer login area:
• View all past jobs and invoices
• Upcoming scheduled services
• Home record / equipment list
• Request new service
• Pay outstanding invoices
• Message contractor
```

**Effort Estimate**: 4+ weeks

---

### 20. Reporting Dashboard

**Current State**: Limited reporting capabilities.

**Recommendation**:
```
Reports needed:
• Revenue by period (day/week/month/year)
• Revenue by category (HVAC, Plumbing, etc.)
• Revenue by tech
• Close rate (quotes → jobs)
• Average job value
• Customer acquisition cost
• Payment aging (AR report)
• Tech utilization rate
```

**Effort Estimate**: 3-4 weeks

---

## Strategic Differentiators

These are features that would set Krib apart from competitors.

### D1. Home Record Integration (EXISTING - LEVERAGE)

**Current Strength**: Equipment installed flows to homeowner's home record with maintenance schedules.

**Enhancement**:
```
MAINTENANCE REVENUE ENGINE:

1. Every installed item creates maintenance schedule
2. 30 days before due → auto-notify homeowner
3. Homeowner can: Accept, Snooze, Decline
4. If Accept → job auto-created, contractor notified
5. Contractor sends quote or confirms standard price
6. Frictionless recurring revenue

VALUE PROP TO CONTRACTOR:
"Every AC install becomes 20 years of annual tune-ups"
"Your home records become your sales pipeline"
```

---

### D2. Homeowner-Contractor Relationship

**Opportunity**: Unlike competitors, Krib has BOTH sides of the marketplace.

**Enhancement**:
```
TRUSTED CONTRACTOR STATUS:

For homeowners:
• "My Pros" list - saved contractors
• See contractor's work history on MY home
• Quick re-hire for new issues
• Shared home record (contractor sees what's installed)

For contractors:
• "My Customers" with full history
• See all equipment you've installed
• Proactive outreach: "Your water heater is 12 years old"
• Cross-sell: HVAC customer → offer plumbing partner
```

---

### D3. AI-Powered Operations

**Opportunity**: Use AI throughout the workflow.

**Enhancements**:
```
AI APPLICATIONS:

1. Evaluation Analysis (exists, enhance)
   • Identify equipment from photos
   • Suggest likely issues
   • Recommend repair vs replace

2. Quote Optimization
   • Suggest line items based on evaluation
   • Price recommendations based on market
   • Margin optimization suggestions

3. Scheduling Intelligence
   • Predict job duration more accurately
   • Account for traffic patterns
   • Suggest optimal tech based on skills + location

4. Payment Prediction
   • Flag customers likely to pay late
   • Suggest payment terms adjustments
   • Auto-escalate collection for at-risk invoices

5. Demand Forecasting
   • "HVAC demand up 40% - heat wave coming"
   • Suggest staffing adjustments
   • Pre-schedule maintenance during slow periods
```

---

## Technical Debt & Architecture

### T1. Message Duplication

**Issue**: Messages stored in both evaluation document AND chat channel.

**Fix**: Consolidate to chat channel only. Evaluation stores `chatChannelId` reference.

---

### T2. Dynamic Imports

**Issue**: Build warnings about dynamic vs static imports of Firestore, constants.

**Fix**: Standardize import pattern across codebase.

---

### T3. Component Size

**Issue**: Several components over 1000 lines (CreateJobModal: 1453, JobCompletionForm: 1789).

**Fix**: Break into smaller sub-components for maintainability.

---

### T4. Error Handling Consistency

**Issue**: Inconsistent error handling and user feedback patterns.

**Fix**: Standardize error boundaries, toast patterns, retry logic.

---

## Implementation Roadmap

### Phase 1: Critical Path (Weeks 1-4)
**Goal**: Remove adoption blockers

| Week | Deliverable | Impact |
|------|-------------|--------|
| 1 | Digital Signature Capture | Liability protection |
| 1-2 | Tech Assignment SMS Notifications | Operational efficiency |
| 2-3 | Field Payment (QR Code) | Cash flow |
| 3-4 | Tech Mobile PWA (v1: View Schedule) | Field operations |

### Phase 2: Competitive Parity (Weeks 5-8)
**Goal**: Match competitor feature set

| Week | Deliverable | Impact |
|------|-------------|--------|
| 5 | Automated Payment Reminders | Collections |
| 5-6 | Time Slot Offering Flow | Scheduling UX |
| 6-7 | Price Book System | Quoting efficiency |
| 7-8 | Customer SMS Options | Communication |

### Phase 3: Experience Polish (Weeks 9-12)
**Goal**: Delight users

| Week | Deliverable | Impact |
|------|-------------|--------|
| 9 | Multi-Day Job Automation | Large job support |
| 9-10 | Expense Intelligence | Profitability |
| 10-11 | AI Analysis Display | Diagnosis speed |
| 11-12 | Tech Mobile PWA (v2: Full Features) | Field completion |

### Phase 4: Differentiation (Weeks 13-16)
**Goal**: Create competitive moat

| Week | Deliverable | Impact |
|------|-------------|--------|
| 13-14 | Maintenance Upsell Flow | Recurring revenue |
| 14-15 | Customer Job Tracking Portal | Customer experience |
| 15-16 | Reporting Dashboard | Business intelligence |

---

## Success Metrics

### Adoption Metrics
- Contractor 30-day retention rate (target: >80%)
- Jobs completed per contractor per month (target: >20)
- Tech mobile app daily active users (target: >60% of techs)

### Operational Metrics
- Time from quote acceptance to scheduled (target: <24 hours)
- Payment collection within 7 days (target: >70%)
- Customer signature capture rate (target: >90%)

### Revenue Metrics
- Average job value (track trend)
- Recurring revenue from maintenance (target: 20% of total)
- Payment processing volume (Stripe GMV)

### Satisfaction Metrics
- Contractor NPS (target: >50)
- Homeowner NPS (target: >60)
- Support ticket volume (target: decreasing)

---

## Conclusion

Krib has a solid foundation with unique advantages (home record integration, both-sided marketplace). The critical gaps are concentrated in field operations—exactly where contractors spend most of their day.

Prioritizing:
1. **Digital signatures** (1 week, liability protection)
2. **Tech notifications** (1-2 weeks, operational sanity)
3. **Field payments** (2-3 weeks, cash flow)
4. **Tech mobile PWA** (3-4 weeks, complete field solution)

...would transform Krib from "office dispatch tool" to "complete field service platform" and dramatically improve contractor retention.

The home record → maintenance plan → recurring revenue loop is the strategic differentiator. Once field operations are solid, doubling down on this loop creates a moat competitors can't easily replicate.
