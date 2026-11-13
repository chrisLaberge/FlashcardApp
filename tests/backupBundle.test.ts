import { bundleJsonLength, encodeBundleHeader, isBundle, parseBundleHeader } from "../src/models/BackupBundle";

describe("backup bundle header", () => {
    it("round-trips", () => {
        const bytes = encodeBundleHeader({ db: 100, pdfs: [{ id: 3, size: 5000 }] });
        expect(isBundle(bytes)).toBe(true);
        const n = bundleJsonLength(bytes);
        expect(parseBundleHeader(bytes.slice(10, 10 + n))).toEqual({ db: 100, pdfs: [{ id: 3, size: 5000 }] });
    });
    it("does not mistake a plain SQLite file for a bundle", () => {
        expect(isBundle(new TextEncoder().encode("SQLite format 3\0"))).toBe(false);
    });
    it("rejects nonsense", () => {
        expect(parseBundleHeader(new TextEncoder().encode("{\"db\":0,\"pdfs\":[]}"))).toBeNull();
        expect(parseBundleHeader(new TextEncoder().encode("nope"))).toBeNull();
    });
});

import { asRollbackJournal } from "../src/models/BackupBundle";

describe("asRollbackJournal", () => {
    it("turns a WAL-mode header into the normal one without touching the rest", () => {
        const bytes = new Uint8Array(100).fill(7);
        bytes[18] = 2; bytes[19] = 2;
        const fixed = asRollbackJournal(bytes);
        expect([fixed[18], fixed[19], fixed[20], fixed[0]]).toEqual([1, 1, 7, 7]);
        expect(bytes[18]).toBe(2);
    });
    it("leaves a normal file alone", () => {
        const bytes = new Uint8Array(100); bytes[18] = 1; bytes[19] = 1;
        expect(asRollbackJournal(bytes)).toBe(bytes);
    });
});
