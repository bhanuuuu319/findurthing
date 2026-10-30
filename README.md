# Campus Lost & Found AI

A responsive, dark blue campus lost-and-found web app built with HTML, CSS, Bootstrap 5, JavaScript modules, and Firebase.

## Features
- Responsive layout for phones, tablets, laptops, and desktops
- Student registration/login using Firebase Authentication
- Administrator view (must be explicitly authorized)
- Lost/found reports, optional photo uploads, search and category filters
- Smart matching score based on text similarity, category, location, and date
- Claim requests and return-status tracking
- Local demo mode for trying the interface without Firebase

## 1. Run locally
Because `app.js` uses JavaScript modules, do not open `index.html` directly as a `file://` URL.
- In VS Code install/use the **Live Server** extension and click **Go Live**, or
- Run `python -m http.server 5500` in this folder and open `http://localhost:5500`.

Demo mode works if `firebase-config.js` still has empty config values. Demo data is stored only in that browser's local storage and is not shared with other users.

## 2. Connect Firebase
1. Open Firebase Console and create/select a project.
2. Add a Web App in Project settings and copy its configuration into `firebase-config.js`.
3. In Authentication > Sign-in method, enable **Email/Password**.
4. Create a Firestore database.
5. (Optional, for image upload) Enable Firebase Storage.
6. In `firestore.rules`, replace `REPLACE_WITH_ADMIN_EMAIL` with your designated admin email, then publish the rules.
7. In `storage.rules`, publish the Storage rules.
8. To set the administrator role, register that email through Firebase Authentication, then use a trusted administrative setup (Firebase Console / Admin SDK) to set `users/{uid}` to `{ role: "admin", name: "Administrator" }`. Never allow the browser to set its own role to admin.
9. Update `adminEmail` in `firebase-config.js` to the same admin email.
10. Add `localhost` and your Hosting domain under Authentication > Settings > Authorized domains.

**Important:** For production use, tighten Firestore rules and validate claim/report transitions with Cloud Functions or another trusted server. Client-side role checks improve the UI but are not a security boundary by themselves.

## 3. Deploy to Firebase Hosting
Install Node.js and Firebase CLI, then in this project folder run:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
# Select your Firebase project. Or replace YOUR_FIREBASE_PROJECT_ID in .firebaserc.
firebase deploy
```

When `firebase use --add` is used, select the correct project; it updates `.firebaserc`. If you already have a Firebase project alias set, just run `firebase deploy`.

## AI matching note
The starter includes a transparent heuristic matching engine, not a third-party generative AI model. It ranks lost/found pairs using word overlap, category, location similarity, and date proximity. Treat results as suggestions only and verify ownership before handing over an item. For advanced semantic/image matching, connect a trusted backend or AI service; do not put private API keys in browser JavaScript.

## Troubleshooting
- **Firebase config error:** check every value in `firebase-config.js`, including `projectId`, `authDomain`, and `appId`.
- **Permission denied:** publish Firestore/Storage rules and verify the signed-in user's profile and role.
- **Photo upload unavailable:** enable Firebase Storage; reports still work without a photo.
- **Page looks unchanged after deploy:** verify the terminal is in this folder and run `firebase deploy --only hosting`, then hard-refresh the site.


## Forgot password
On the sign-in screen, enter the account email and select **Forgot password?**. Firebase Authentication sends a password-reset email. In Firebase Console, enable the Email/Password provider under Authentication → Sign-in method, and configure the email template / authorized domain if needed. The feature is available in Firebase mode; local demo accounts do not support email password resets.
