// src/config/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";

const firebaseConfig = {
  apiKey: "AIzaSyCS2JMaEpI_npBXkHjhjOk10ffZVg5ypaI",
  authDomain: "trellis-6cd18.firebaseapp.com",
  projectId: "trellis-6cd18",
  storageBucket: "trellis-6cd18.firebasestorage.app",
  messagingSenderId: "669423260428",
  appId: "1:669423260428:web:64a5452413682c257cef29",
  measurementId: "G-JBP9F27RN1"
};

// Initialize Firebase
let app;
let auth;
let db;
let geminiModel = null;

try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Initialize Vertex AI
    try {
        const vertexAI = getVertexAI(app);
        // Storing this in a variable instead of window.geminiModel
        geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
    } catch (aiError) {
        console.warn("AI Initialization failed (optional feature):", aiError);
    }

} catch (e) {
    console.error("Firebase Init Error:", e);
}

// Export these so other files can use them
export { app, auth, db, geminiModel };
