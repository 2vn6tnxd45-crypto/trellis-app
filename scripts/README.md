# Service Account Key

This folder contains the Firebase test account setup script.

## Setup Instructions

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate new private key**
5. Save the downloaded file as `serviceAccountKey.json` in this folder

## Run the Script

```bash
npm install firebase-admin  # if not already installed
node scripts/createTestAccounts.js
```

## Test Accounts Created

| Email | Password | Role | Data |
|-------|----------|------|------|
| test.homeowner.new@gmail.com | TestPass123! | Homeowner | None |
| test.homeowner.full@gmail.com | TestPass123! | Homeowner | 10 records, 2 quotes, 1 job |
| test.contractor.new@gmail.com | TestPass123! | Contractor | None |
| test.contractor.full@gmail.com | TestPass123! | Contractor | 5 customers, 3 jobs, 8 price items |

## Security

**NEVER commit serviceAccountKey.json to version control!**

Add to .gitignore:
```
scripts/serviceAccountKey.json
```
