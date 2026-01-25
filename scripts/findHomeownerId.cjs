const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const APP_ID = 'krib-app';
const PROPERTIES_COLLECTION = `artifacts/${APP_ID}/public/data/properties`;

(async () => {
    try {
        console.log('Searching for property...');
        // Search for the property we just created
        // Note: The address in the test was "6534 San Haroldo Way, Buena Park CA"
        // Google Autocomplete might have formatted it slightly differently, e.g. with zip

        // We'll try a broad search or just list all properties if there are few
        const snapshot = await db.collection(PROPERTIES_COLLECTION).get();

        if (snapshot.empty) {
            console.log('No properties found in collection.');
            process.exit(1);
        }

        let found = false;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.address && data.address.includes('6534 San Haroldo')) {
                console.log(`FOUND_UID:${data.homeownerId}`);
                console.log(`Property Address: ${data.address}`);
                found = true;
            }
        });

        if (!found) {
            console.log('Property not found. Listing ALL properties:');
            snapshot.forEach(doc => {
                const d = doc.data();
                console.log(`Address: ${d.address} | Owner: ${d.homeownerId} | ID: ${doc.id}`);
            });
        }
        process.exit(0);
    } catch (error) {
        console.error('Error finding property:', error);
        process.exit(1);
    }
})();
