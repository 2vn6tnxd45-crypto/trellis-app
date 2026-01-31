// tests/fixtures/selectors.js
// ============================================
// COMMON SELECTORS REFERENCE
// ============================================

export const SELECTORS = {
  // Auth
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
  googleAuthButton: '[data-testid="google-auth"]',
  signInButton: 'text=/sign in|log in/i',
  signUpButton: 'text=/sign up|create account|register/i',
  forgotPasswordLink: 'text=/forgot|reset/i',

  // Navigation - Homeowner
  navHome: '[data-testid="nav-home"], nav a:has-text("Home")',
  navRecords: '[data-testid="nav-records"], nav a:has-text("Records"), text=Inventory',
  navScan: '[data-testid="nav-scan"], nav a:has-text("Scan"), text=Add',
  navQuotes: '[data-testid="nav-quotes"], nav a:has-text("Quotes"), text=Projects',
  navPros: '[data-testid="nav-pros"], nav a:has-text("Pros"), text=Contractors',
  navMore: '[data-testid="nav-more"], text=More',
  navSettings: '[data-testid="nav-settings"], nav a:has-text("Settings")',

  // Navigation - Contractor
  navDashboard: 'nav a:has-text("Dashboard")',
  navJobs: 'nav a:has-text("Jobs")',
  navContractorQuotes: 'nav a:has-text("Quotes")',
  navCustomers: 'nav a:has-text("Customers")',
  navCalendar: 'nav a:has-text("Calendar"), nav a:has-text("Schedule")',
  navTeam: 'nav a:has-text("Team")',
  navMessages: 'nav a:has-text("Messages"), text=Chat, text=Inbox',

  // Common UI
  loadingSpinner: '[data-testid="loading"], .animate-spin',
  errorMessage: '[data-testid="error"], [role="alert"]',
  successToast: '.toast-success, [data-testid="toast-success"]',
  errorToast: '.toast-error, [data-testid="toast-error"]',
  modal: '[role="dialog"], [data-testid="modal"]',
  modalClose: '[data-testid="modal-close"], button:has-text("Close"), button:has-text("×")',

  // Forms
  saveButton: 'button:has-text("Save")',
  cancelButton: 'button:has-text("Cancel")',
  deleteButton: 'button:has-text("Delete")',
  confirmButton: 'button:has-text("Confirm")',
  addButton: 'button:has-text("Add"), button:has-text("+")',

  // Scanner
  fileInput: 'input[type="file"]',
  uploadButton: 'text=Upload, text=Choose File, text=Browse',
  cameraButton: 'text=Camera, text=Take Photo',

  // Calendar
  calendarGrid: '[data-testid="calendar-grid"], .calendar-grid',
  calendarEvent: '[data-testid="calendar-event"], .calendar-event',
  unscheduledPanel: '[data-testid="unscheduled-jobs"], .unscheduled-panel',
  todayButton: 'button:has-text("Today")',
  prevWeekButton: '[data-testid="prev-week"], button:has-text("Previous")',
  nextWeekButton: '[data-testid="next-week"], button:has-text("Next")',
};

export default SELECTORS;
