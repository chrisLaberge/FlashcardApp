import { useEffect, useState } from "react";
import type { Look } from "../components/pet/PetView";
import { loadShop } from "../services/shop";

export type PetShot = { level: number; look: Look };

/** The pet as it looks right now (level and what it wears), loaded when `active` turns true. Null until then. */
export function usePetLook(active: boolean): PetShot | null {
    const [pet, setPet] = useState<PetShot | null>(null);
    useEffect(() => {
        if (!active) return undefined;
        let live = true;
        loadShop()
            .then((state) => { if (live) setPet({ level: state.petLevel, look: state.equipped }); })
            .catch(() => undefined);
        return () => { live = false; };
    }, [active]);
    return pet;
}
