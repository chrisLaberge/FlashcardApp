# Release to Google Play

Everything I could do in code is done. The steps below need your accounts. Do them in this order.

## 1. Backend (flashcardbackend, PR #16)
1. Merge PR #16, then redeploy Cloud Run (`gcloud builds submit` / your usual trigger).
2. Set these on the Cloud Run service:
   - `ANTHROPIC_API_KEY` (already set if explanations work).
   - `AI_DAILY_BUDGET`: most new AI answers per day across everyone (default 3000). Set it to what you are willing to pay for. Repeated questions are served from a saved copy and do not count.
   - Optional `EXPLAIN_MODEL` (default `claude-haiku-5-5`, the cheapest).
   - Minimum instances: 1 if you want the daily limits and the saved AI answers to survive between requests. They live in memory, so they reset when an instance restarts.
3. **Do not** set `AUTH_MODE=enforce` yet. Old builds on phones do not sign in. Set it after step 4 is on every phone, otherwise those phones break.

## 2. Firebase
1. Add the SHA-1 and SHA-256 of the **Play App Signing key** (Play Console > Setup > App signing) and of your EAS upload key (`eas credentials`) to the Firebase Android app. Without this Google sign-in fails for Play installs.
2. Restrict the Firebase web API key (Google Cloud Console > APIs & Services > Credentials): application restriction Android apps, package `com.chrislaberge.stompacard` plus the SHA-1s above; API restriction to Identity Toolkit and Token Service.
3. Deploy the privacy policy and the delete-account page:
   ```
   cd hosting
   npx firebase-tools deploy --only hosting --project stompacard-7a65b
   ```
   - Privacy policy: `https://stompacard-7a65b.web.app/privacy`
   - Account deletion page: `https://stompacard-7a65b.web.app/delete-account`

## 3. Build
```
eas build --platform android --profile production
```
This makes an `.aab` (the file Play needs). The version code goes up by itself. Test builds (`preview`, `development`) are arm64-only and much faster; production keeps every architecture.

Before uploading, install a `preview` build and check: sign-in screen on first launch, the tutorial, make a deck and a card, study, open a PDF, restore a backup.

## 4. Play Console
1. Create the app (name StompaCard, default language, App, Free).
2. Upload the `.aab` to **Internal testing** first. Add yourself as a tester and install from Play.
3. Store listing, copy this as a start:
   - Short description (80): *Learn words with flashcards, read your own PDFs, and grow a pet.*
   - Full description: spaced-repetition flashcards for any language; add words by typing or tapping them in a book; read PDFs with unknown words highlighted and a reading percentage; AI word explanations; streaks, achievements, a pet with accessories; friends and a leaderboard; backup and restore.
   - Needed images: 512x512 icon, 1024x500 feature graphic, at least 2 phone screenshots.
4. App content:
   - Privacy policy URL: above.
   - Data safety (matches the policy): collected = email address, user IDs (username), app activity (daily study totals for the leaderboard), and text you send for translation or explanation. All encrypted in transit. Users can request deletion (give the delete-account URL above). Not sold, no ads, no analytics. Update this form when you add ads.
   - Ads: No (change when you add ads).
   - Content rating questionnaire: educational, no user-generated public content except usernames. Target audience 13+ (the policy says not for under 13).
   - Account deletion: both the in-app path (Account > Delete account) and the web page.
5. Production needs a closed test first if your Play developer account is a personal account created after November 2023 (12 testers for 14 days). Organization accounts skip this.

## 5. After it is live
Once the new build is on phones, set `AUTH_MODE=enforce` on Cloud Run.

## Later: ads and a paid no-ads tier
Sign-in is now required, so every user has an ID to attach a "premium" flag to. When you build it: Play Billing (a subscription or one-time purchase), a server-side flag you check, Google AdMob for ads, then update the policy, the data-safety form and the ads declaration.
