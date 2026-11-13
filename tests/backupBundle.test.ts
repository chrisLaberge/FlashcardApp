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
