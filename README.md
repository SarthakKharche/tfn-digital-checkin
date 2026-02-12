# TFN Digital Check-In System

A web-based Digital Event Check-In System powered by Firebase Firestore and QR codes.

---

## Features

- **CSV Upload** — Upload Google Forms CSV exports to register attendees
- **QR Code Generation** — Automatic unique QR code per attendee (encodes PRN)
- **Camera QR Scanner** — Scan attendee QR codes to check them in instantly
- **Duplicate Prevention** — Blocks duplicate check-ins with a warning
- **Manual Lookup** — Search by PRN if QR scanning isn't available
- **Real-time Dashboard** — Live stats, search, filter, and CSV export
- **Responsive Design** — Works on desktop, tablet, and mobile

---

## Tech Stack

| Component       | Technology                     |
|-----------------|--------------------------------|
| Frontend        | HTML, CSS, JavaScript (Vanilla)|
| Database        | Firebase Cloud Firestore       |
| CSV Parsing     | PapaParse 5.4                  |
| QR Generation   | QRCode.js                      |
| QR Scanning     | Html5-QRCode 2.3               |
| Icons           | Font Awesome 6.5               |
| Fonts           | Google Fonts (Inter)           |

---

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** and follow the wizard
3. Once created, go to **Build > Firestore Database**
4. Click **Create database** → Start in **test mode** (for development)
5. Choose a region close to your users

### 2. Register a Web App

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** → click the **Web** icon (`</>`)
3. Register your app (name it anything, e.g., "TFN Check-In")
4. Copy the `firebaseConfig` object shown

### 3. Configure the Project

Open `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Set Firestore Security Rules (Development)

In Firebase Console → Firestore → **Rules**, set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> **Warning:** These rules allow open access. For production, add proper authentication and role-based rules.

### 5. Run the Project

This is a static web app — no build step needed. You just need a local web server:

**Option A — VS Code Live Server:**
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Right-click `index.html` → **Open with Live Server**

**Option B — Python:**
```bash
cd "TFN Digital Check-In"
python -m http.server 8000
# Open http://localhost:8000
```

**Option C — Node.js:**
```bash
npx serve .
```

> **Note:** The QR camera scanner requires HTTPS or `localhost` to access the camera.

---

## Firestore Schema

**Collection:** `attendees`

| Field         | Type      | Description                            |
|---------------|-----------|----------------------------------------|
| `name`        | string    | Attendee name                          |
| `prn`         | string    | Unique PRN identifier                  |
| `email`       | string    | Email address                          |
| `mobile`      | string    | Mobile number                          |
| `year`        | string    | Academic year (FE, SE, TE, BE)         |
| `qrData`      | string    | Base64 data URL of the QR code PNG     |
| `checkedIn`   | boolean   | `true` if attendee has checked in      |
| `checkInTime` | timestamp | When the check-in occurred (or `null`) |
| `createdAt`   | timestamp | When the record was created            |

---

## CSV Format

The uploaded CSV must have these columns (case-insensitive):

```
name,prn,email,mobile,year
```

A sample file is included: `sample-data.csv`

---

## Project Structure

```
TFN Digital Check-In/
├── index.html            # Main SPA page (all 3 views)
├── css/
│   └── style.css         # Complete stylesheet
├── js/
│   ├── firebase-config.js  # Firebase init + config
│   ├── upload.js           # CSV parsing, QR generation, Firestore upload
│   ├── checkin.js          # QR scanner + check-in logic
│   ├── dashboard.js        # Stats, table, search, filter, export
│   └── app.js              # Navigation + module initialization
├── sample-data.csv       # Sample CSV for testing
└── README.md             # This file
```

---

## How to Use

### Upload CSV
1. Navigate to the **Upload CSV** tab
2. Drag & drop or browse for your CSV file
3. Preview the parsed data in the table
4. Click **Process & Upload to Firebase**
5. Each record gets a unique QR code stored in Firestore

### Check-In Attendees
1. Navigate to the **Check-In** tab
2. Click **Start Scanner** to activate the camera
3. Point the camera at an attendee's QR code
4. The system fetches their details and marks them as checked in
5. If already checked in, a warning is shown with the original timestamp
6. Alternatively, use the manual PRN input for lookup

### Dashboard
1. Navigate to the **Dashboard** tab
2. View real-time stats (total, checked-in, pending, rate)
3. Search attendees by name, PRN, or email
4. Filter by status (All / Checked In / Pending)
5. Click any QR thumbnail to view it full-size
6. Export the full list as a CSV report

---

## Production Considerations

- **Authentication:** Add Firebase Auth to restrict admin access
- **Firestore Rules:** Lock down to authenticated users only
- **Indexes:** Create a composite index on `prn` for faster queries
- **QR Storage:** For large events, store QR images in Firebase Storage instead of base64 in Firestore
- **Offline Support:** Enable Firestore offline persistence for unreliable connectivity
- **HTTPS:** Deploy behind HTTPS (required for camera access) — Firebase Hosting is a great option

---

## License

MIT — free for personal and commercial use.
