# Firestore Composite Indexes

This document lists the required composite indexes for the Krib marketplace feature.

## Quick Setup

The fastest way to create indexes is to run the marketplace queries in development and click the auto-generated links in the browser console error messages. Firebase provides a direct link to create each missing index.

Alternatively, deploy all indexes at once:
```bash
firebase deploy --only firestore:indexes
```

---

## Required Indexes

### Collection: `artifacts/krib-app/public/data/contractorProfiles`

| Index | Fields | Purpose |
|-------|--------|---------|
| 1 | `isPublic` (ASC), `acceptingNewClients` (ASC), `averageRating` (DESC) | Browse contractors sorted by rating |
| 2 | `isPublic` (ASC), `primaryTrade` (ASC), `averageRating` (DESC) | Filter by trade, sorted by rating |
| 3 | `isPublic` (ASC), `acceptingNewClients` (ASC), `publishedAt` (DESC) | Browse newest contractors |

### Collection: `artifacts/krib-app/public/data/serviceRequests`

| Index | Fields | Purpose |
|-------|--------|---------|
| 4 | `status` (ASC), `visibility` (ASC), `createdAt` (DESC) | Contractor lead browse |
| 5 | `homeownerId` (ASC), `createdAt` (DESC) | Homeowner request history |

---

## Manual Creation (Firebase Console)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Firestore Database → Indexes → Composite
3. Click "Add index"
4. Enter the collection group name (e.g., `contractorProfiles`)
5. Add each field with its sort order
6. Click "Create index"

> **Note**: Indexes can take a few minutes to build.

---

## Troubleshooting

**"Missing or insufficient permissions" or empty results?**
- Check if the query requires an index
- Look for a console error with a clickable link to create the index
- Verify Security Rules allow the query

**Index build taking too long?**
- Large collections can take up to an hour
- Check progress in Firebase Console → Indexes tab
