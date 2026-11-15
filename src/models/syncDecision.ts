/** What to do when the phone and the account's saved copy meet. Pure, so it can be tested without a phone. */
export type SyncDecision = "nothing" | "upload" | "download" | "ask";

export type SyncFacts = {
    /** The version of the saved copy this phone last matched (0 = never). */
    base: number;
    /** Something changed on this phone since then. */
    dirty: boolean;
    /** The phone holds decks, cards or books. */
    hasData: boolean;
    /** The version saved in the account right now (0 = nothing saved). */
    remote: number;
};

export function decideSync({ base, dirty, hasData, remote }: SyncFacts): SyncDecision {
    if (remote === 0) return hasData ? "upload" : "nothing";
    if (base === 0) return hasData ? "ask" : "download"; // first meeting of this phone and a saved copy
    if (remote === base) return dirty ? "upload" : "nothing";
    if (remote > base) return dirty ? "ask" : "download";
    return hasData ? "upload" : "nothing"; // the saved copy was removed; save this phone's again
}
