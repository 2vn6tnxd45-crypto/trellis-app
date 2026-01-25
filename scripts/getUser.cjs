const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const email = process.argv[2];

if (!email) {
    console.error('Please provide an email address as the first argument.');
    process.exit(1);
}

(async () => {
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(userRecord.uid);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`Error: User ${email} not found.`);
        } else {
            console.error('Error fetching user data:', error);
        }
        process.exit(1);
    }
})();
