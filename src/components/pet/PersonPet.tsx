import { StyleSheet, View } from "react-native";
import type { PetLook } from "../../services/social";
import BannerView from "./BannerView";
import PetView from "./PetView";

/** A small, still picture of someone's pet for lists. Shows nothing until they have set one up. */
export function PersonPet({ pet, level, size = 44 }: { pet: PetLook | null | undefined; level: number; size?: number }) {
    if (!pet) return null;
    return <PetView level={level} look={{ hat: pet.hat, glasses: pet.glasses, scarf: pet.scarf }} size={size} animated={false} />;
}

/** Someone's banner as a soft background for a row. Put it first inside a row with `overflow: "hidden"`. */
export function RowBanner({ banner }: { banner: string | null | undefined }) {
    if (!banner || banner === "mist") return null;
    return (
        <View style={s.fill} pointerEvents="none">
            <BannerView id={banner} style={s.fill} />
        </View>
    );
}

const s = StyleSheet.create({
    fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 },
});
