import type * as AdsModule from "react-native-google-mobile-ads";

/**
 * Ads are off unless the build says otherwise (EXPO_PUBLIC_ADS=1), so a build made without it contains no ads
 * and matches the "no ads" answer in Play Console. Real ad unit ids go in EXPO_PUBLIC_ADMOB_BANNER_ID;
 * until then Google's test ads are used, which are safe to tap.
 */
export const ADS_ON = process.env.EXPO_PUBLIC_ADS === "1";

/** The ads library is native code: it is missing in Expo Go, so it is loaded only when needed and never allowed to crash the app. */
export function adsModule(): typeof AdsModule | null {
    if (!ADS_ON) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("react-native-google-mobile-ads") as typeof AdsModule;
    } catch {
        return null;
    }
}

export function bannerUnitId(ads: typeof AdsModule): string {
    const real = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
    return !__DEV__ && real ? real : ads.TestIds.ADAPTIVE_BANNER;
}

let starting: Promise<boolean> | null = null;

/** Asks for consent where the law requires it (Europe, UK), then starts the ads. Resolves to whether ads may be requested. Runs once. */
export function startAds(): Promise<boolean> {
    starting ??= (async () => {
        const ads = adsModule();
        if (!ads) return false;
        try {
            await ads.AdsConsent.gatherConsent();
            const info = await ads.AdsConsent.getConsentInfo();
            if (!info.canRequestAds) return false;
            await ads.default().initialize();
            return true;
        } catch {
            return false;
        }
    })();
    return starting;
}
