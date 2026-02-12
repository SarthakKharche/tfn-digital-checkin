/**
 * ============================================
 * Firebase Configuration
 * ============================================
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Enable Firestore Database (Cloud Firestore)
 * 4. Go to Project Settings > General > Your Apps > Add Web App
 * 5. Copy the firebaseConfig object and paste it below
 * 6. Set Firestore rules to allow read/write (for development):
 *
 *    rules_version = '2';
 *    service cloud.firestore {
 *      match /databases/{database}/documents {
 *        match /{document=**} {
 *          allow read, write: if true;
 *        }
 *      }
 *    }
 *
 * FIRESTORE SCHEMA:
 * Collection: "attendees"
 * Document fields:
 *   - name      (string)  : Attendee full name
 *   - prn       (string)  : Unique PRN identifier
 *   - email     (string)  : Email address
 *   - mobile    (string)  : Mobile number
 *   - year      (string)  : Academic year
 *   - qrData    (string)  : QR code data (base64 PNG)
 *   - checkedIn (boolean) : Whether attendee has checked in
 *   - checkInTime (timestamp | null) : When they checked in
 *   - createdAt (timestamp) : Record creation time
 */

// ⚠️ REPLACE the values below with YOUR Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyATq31FA9dthYjLEvko_eGd5gw9M2JrLvA",
  authDomain: "tfn-digital-check-in.firebaseapp.com",
  projectId: "tfn-digital-check-in",
  storageBucket: "tfn-digital-check-in.firebasestorage.app",
  messagingSenderId: "624298899361",
  appId: "1:624298899361:web:418e2bf396613102de3de0",
  measurementId: "G-J90BP0MKDG"
};
// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firestore — use long polling to bypass ad-blocker WebChannel blocks
const db = firebase.firestore(app);
db.settings({
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  merge: true
});

// Collection references
const attendeesRef = db.collection("attendees");
const eventsRef = db.collection("events");

/**
 * Utility: Show a toast notification
 * @param {string} message - Toast message
 * @param {"success"|"error"|"warning"|"info"} type - Toast type
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "fa-check-circle",
    error: "fa-times-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle"
  };

  toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
  container.appendChild(toast);

  // Auto-remove after animation completes
  setTimeout(() => toast.remove(), 3000);
}
