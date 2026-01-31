// tests/fixtures/test-users.js
// ============================================
// TEST USER ACCOUNTS
// ============================================
// VERIFIED WORKING CREDENTIALS (2026-01-27)

export const TEST_USERS = {
  // Primary Homeowner Test Account
  // Note: This account is in onboarding state (needs property setup)
  homeowner: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234',
    name: 'Test Homeowner'
  },

  // Primary Contractor Test Account
  // Note: This account is "John's Plumbing" with existing jobs, quotes, customers
  contractor: {
    email: 'danvdova@gmail.com',
    password: 'Test1234',
    companyName: "John's Plumbing",
    hasCustomers: true,
    hasQuotes: true,
    hasJobs: true,
    hasTeam: false
  },

  // Aliases for backward compatibility
  homeownerFull: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234',
    name: 'Test Homeowner'
  },
  contractorFull: {
    email: 'danvdova@gmail.com',
    password: 'Test1234',
    companyName: "John's Plumbing",
    hasCustomers: true,
    hasQuotes: true,
    hasJobs: true,
    hasTeam: false
  }
};

export default TEST_USERS;
