# Firebase Setup Guide

Detailed step-by-step guide for enabling real-time multi-device sync in ShuttleScore.

## Prerequisites

- A Google account
- Your ShuttleScore app deployed (or running locally)

## Step 1: Create a Firebase project

1. Navigate to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Create a project**
3. Enter a project name (e.g. `shuttlescore-tournament`)
4. Disable Google Analytics (not needed)
5. Click **Create project**

## Step 2: Enable Realtime Database

1. In the left sidebar: **Build → Realtime Database**
2. Click **Create database**
3. Choose your region (pick the one geographically closest to your venue)
4. Select **Start in test mode** → click **Enable**

> Test mode allows open read/write for 30 days. For a production tournament, add security rules after the event.

## Step 3: Set security rules (recommended for tournaments)

In Realtime Database → **Rules** tab, replace with:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

This keeps it open for the duration of your event. After the tournament, change `.write` to `false`.

## Step 4: Register your web app

1. In Project settings (gear icon top-left) → **General** tab
2. Scroll to **Your apps** → click the `</>` (Web) icon
3. App nickname: `ShuttleScore` (any name)
4. Leave "Firebase Hosting" unchecked
5. Click **Register app**
6. Copy the `firebaseConfig` object shown

Example config:
```json
{
  "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXX",
  "authDomain": "shuttlescore-tournament.firebaseapp.com",
  "databaseURL": "https://shuttlescore-tournament-default-rtdb.asia-southeast1.firebasedatabase.app",
  "projectId": "shuttlescore-tournament",
  "storageBucket": "shuttlescore-tournament.appspot.com",
  "messagingSenderId": "123456789012",
  "appId": "1:123456789012:web:abcdef123456"
}
```

## Step 5: Connect in ShuttleScore

1. Open your deployed ShuttleScore app
2. Go to **Setup → Firebase Real-Time Sync**
3. Paste your config JSON into the text area
4. Click **Connect Firebase**
5. You should see the yellow banner turn green: "Firebase connected"

## Step 6: Share with recorders

Send the deployed URL to each court recorder. When they open the app, they will automatically sync to the same Firebase database.

## Data structure in Firebase

ShuttleScore stores data at:
```
tournament/
  courts/
    {courtId}/
      name, format, teamA, teamB,
      games[], currentGame,
      gamesWonA, gamesWonB,
      serving, complete, winner,
      startTime, endTime, status, agentNote
```

## Troubleshooting

**"Connection failed: databaseURL not found"**
Make sure your config includes `"databaseURL"`. Some configs omit it — copy it manually from the Realtime Database page URL.

**Data not syncing between devices**
Check that all devices are on the same network and that the Firebase security rules allow `.read` and `.write`.

**30-day test mode expired**
Go to Realtime Database → Rules → update the rules to allow read/write again.
