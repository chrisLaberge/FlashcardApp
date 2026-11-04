# Publishing checklist (status as of 2026-11-03)

## Done
- Rename to StompaCard, package `com.chrislaberge.stompacard`.
- Sign-in (Google + email), backend token checks, rate limits, size limits.
- In-app account deletion (Account tab) and online-data deletion (Friends), matching the backend `DELETE /social/me`.
- Pixabay credit line shown above image search results.
- Privacy policy draft: `hosting/public/privacy/index.html`, published with Firebase Hosting (see below).

## You need to do
1. Fill `[YOUR CONTACT EMAIL]` (twice) in `hosting/public/privacy/index.html`, then publish it (Cloud Shell, from the repo folder):
   ```
   cd hosting
   npx firebase-tools login --no-localhost
   npx firebase-tools deploy --only hosting --project stompacard-7a65b
   ```
   The policy is then at `https://stompacard-7a65b.web.app/privacy`. Play Console asks for that URL, and for the data-safety form use the list of what is collected in the policy. Re-run the deploy after any edit.
2. Set `AUTH_MODE=enforce` on the Cloud Run service once every phone is on a build that signs in.
3. Add the Play App Signing SHA-1 to the Firebase Android app once the app is on Play (Google sign-in will otherwise fail for Play installs).

## Pixabay (read from their license page and API documentation)
- Images can be used for free, commercially, without attribution. Modified or adapted use is allowed. Selling or distributing images **standalone** (no creative effort applied) is not.
- The API requires: cache results for 24 h (done in `/images/search`), no permanent hotlinking (we download, resize and store a copy: matches their guidance), and **show where results come from with a link to Pixabay** (added in this change).
- Default API limit is 100 requests per minute per key, shared by all users. Our per-user limit (30/min) does not protect that shared budget once there are many users. Ask Pixabay for a higher limit before launch, or add a global limiter.
- Images showing recognisable people or brands must not be used in immoral, illegal, misleading or (for brands) commercial ways. Safe search is on. Consider a "report this picture" option.
- The stored copies in the Cloud Storage bucket are publicly readable. They are used inside flashcards (creative effort), but anyone with a URL could fetch the raw files. Low risk; mention if you want it tightened.
- Source: pixabay.com/en/service/license (summary; "only the full Content License is legally binding") and an archived copy of the API docs. Read the full terms at pixabay.com/service/terms once before launch.

## Still open
- Western Armenian server voice: the MMS model is non-commercial (CC-BY-NC). Not usable in a commercial/published app without another licence or voice.
- `/tts` endpoint is documented in `backend-tts-endpoint.md` but not built or deployed.
- Not legal advice: have the policy checked if you can.
