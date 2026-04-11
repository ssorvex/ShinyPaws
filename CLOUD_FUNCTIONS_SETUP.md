# Firebase Cloud Functions Setup - Automatic 24-Hour Reminders

This guide explains how to set up automatic appointment reminders using Firebase Cloud Functions.

## What This Does

The Cloud Function automatically:
1. ✅ Runs every hour (no manual action needed)
2. ✅ Checks all appointments in the database
3. ✅ Finds appointments that are exactly 24 hours away
4. ✅ Sends email reminders to customers
5. ✅ Marks reminders as sent (no duplicates)

## Setup Steps

### IMPORTANT: Get SendGrid API Key First

1. Go to https://sendgrid.com
2. Click **Sign Up** (free account)
3. Complete the signup process
4. Go to **Settings → API Keys**
5. Click **Create API Key**
6. Name it: `shiny-paws-reminders`
7. Copy the API key (you'll need it in Step 5)

---

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window to authenticate with your Google account.

### Step 3: Initialize Firebase Project

```bash
cd /path/to/shiny-paws-github
firebase init
```

When prompted:
- Select "Realtime Database" and "Functions"
- Choose your existing Firebase project: `shiny-paws-default`
- Use the provided `firebase.json` and `functions/` directory

### Step 4: Install Dependencies

```bash
cd functions
npm install
cd ..
```

### Step 5: Set SendGrid API Key

```bash
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
```

Replace `YOUR_SENDGRID_API_KEY` with the key you copied from SendGrid.

### Step 6: Deploy Cloud Functions

```bash
firebase deploy --only functions
```

This will deploy the `sendReminders` function to Firebase.

### Step 7: Set Up Cloud Scheduler (Automatic Hourly Execution)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `shiny-paws-default`
3. Go to **Cloud Scheduler**
4. Click **Create Job**
5. Fill in:
   - **Name:** `shiny-paws-reminder-check`
   - **Frequency:** `0 * * * *` (every hour)
   - **Timezone:** `America/Los_Angeles`
   - **Execution timeout:** `540s`
6. Click **Create**
7. Click on the job and click **Edit**
8. Under **Execution settings**, click **Add Execution**
9. Select **HTTP** and enter the Cloud Function URL:
   ```
   https://us-central1-shiny-paws-default.cloudfunctions.net/checkAndSendReminders
   ```
10. Click **Save**

### Step 8: Verify It's Working

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Functions**
4. Click on `checkAndSendReminders`
5. Go to **Logs** tab
6. You should see logs showing the function running every hour

## Alternative: Use the HTTP Endpoint Directly

If you don't want to set up Cloud Scheduler, you can call the function manually:

```bash
curl https://us-central1-shiny-paws-default.cloudfunctions.net/checkAndSendReminders
```

Or add a button in the admin dashboard to trigger it.

## Troubleshooting

### Function not deploying?
- Make sure you have the Firebase CLI installed: `firebase --version`
- Make sure you're logged in: `firebase login`
- Check the error message and run `firebase deploy --only functions` again

### Reminders not sending?
- Check the Cloud Function logs in Firebase Console
- Make sure Formspree form ID is correct: `f/mgopplba`
- Verify customer email addresses are valid

### How to view logs?

```bash
firebase functions:log
```

Or in Firebase Console:
1. Go to **Functions**
2. Click on `checkAndSendReminders`
3. Click **Logs** tab

## Costs

**Everything is COMPLETELY FREE!** 🎉

- **SendGrid:** 100 emails/day free tier (covers your reminders)
- **Firebase Cloud Functions:** 2 million invocations/month free (you use ~730)
- **Cloud Scheduler:** 3 free jobs per month (you use 1)

**Total Cost: $0/month**

## Next Steps

1. Deploy the Cloud Function
2. Set up Cloud Scheduler to run it every hour
3. Test by creating an appointment 24 hours in the future
4. Check the logs to verify the reminder was sent

## Support

If you need help:
1. Check the Cloud Function logs in Firebase Console
2. Verify the Formspree form is working
3. Test the email manually using the admin dashboard "Send Reminders" button

---

**Questions?** The Cloud Function will automatically send reminders 24 hours before every appointment without any manual action needed!
