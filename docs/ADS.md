# Ads (not in the first release)

The code is in, but **off**: a build without `EXPO_PUBLIC_ADS=1` shows no ads, so the first Play release matches the
"my app does not contain ads" answer. Note the AdMob library is still *inside* the app once this is merged, so merge it
only after the first release is approved, or declare ads when you submit.

## Try test ads on your phone (safe, no account needed)
1. `eas.json` → profile `preview` → `"env"` add `"EXPO_PUBLIC_ADS": "1"`, or run the build with that variable set.
2. `npx eas-cli build --platform android --profile preview` and install the apk. A banner of Google's test ad shows at the bottom of **My decks** (Library → decks). It is labelled "Test Ad". It never shows while studying.

## Go live (after the app is published)
1. https://admob.google.com → sign in with the Google account for the app → **Apps → Add app** → Android → "Yes, it is on Google Play" → pick StompaCard.
2. Copy the **App ID** (`ca-app-pub-…~…`). Create a **Banner** ad unit and copy its **Ad unit ID** (`ca-app-pub-…/…`).
3. Set for the production build (EAS → project → Environment variables, or `eas.json` env):
   - `EXPO_PUBLIC_ADS=1`
   - `ADMOB_ANDROID_APP_ID=ca-app-pub-…~…`
   - `EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-…/…`
4. AdMob → **Privacy & messaging** → create the European regulations (GDPR) message so the consent form appears in Europe/UK. Without it, ads are not requested there.
5. Play Console: **App content → Ads → Yes**; **Data safety** → add "Device or other IDs" (advertising ID) shared for advertising; update the privacy policy (Google AdMob collects the advertising ID and device data; link: https://policies.google.com/technology/ads).
6. Also link the AdMob app to the Play listing, and add `app-ads.txt` to the developer website if you set one.

## Remove ads for paying people (later)
`src/services/premium.ts` → `isPremium()` is the single switch. Plan: Play Billing (or RevenueCat) purchase → backend saves
`premium: true` on the account → the app reads it, so it follows the person between phones.
