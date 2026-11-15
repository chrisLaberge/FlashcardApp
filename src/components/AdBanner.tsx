import { useEffect, useState } from "react";
import { View } from "react-native";
import { adsModule, bannerUnitId, startAds } from "../services/ads";
import { isPremium } from "../services/premium";

/** One quiet banner at the bottom of a list screen. Never shown while studying, never for people who pay to remove ads. */
export default function AdBanner() {
    const [ready, setReady] = useState(false);
    const ads = adsModule();

    useEffect(() => {
        if (!ads || isPremium()) return;
        let live = true;
        void startAds().then((ok) => live && setReady(ok));
        return () => { live = false; };
    }, [ads]);

    if (!ads || isPremium() || !ready) return null;
    const { BannerAd, BannerAdSize } = ads;
    return (
        <View style={{ alignItems: "center" }}>
            <BannerAd unitId={bannerUnitId(ads)} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
        </View>
    );
}
