import { decideSync } from "../src/models/syncDecision";
import { crc32, crcHex } from "../src/models/crc32";

const f = (o: Partial<Parameters<typeof decideSync>[0]>) => decideSync({ base: 0, dirty: false, hasData: false, remote: 0, ...o });

describe("decideSync", () => {
    it("saves a phone's data when nothing is saved yet", () => expect(f({ hasData: true })).toBe("upload"));
    it("does nothing for an empty phone and empty account", () => expect(f({})).toBe("nothing"));
    it("loads the saved copy on a fresh phone", () => expect(f({ remote: 3 })).toBe("download"));
    it("asks when a phone with data meets a saved copy for the first time", () => expect(f({ remote: 3, hasData: true })).toBe("ask"));
    it("uploads local changes when nobody else saved", () => expect(f({ base: 2, remote: 2, dirty: true, hasData: true })).toBe("upload"));
    it("does nothing when nothing changed", () => expect(f({ base: 2, remote: 2, hasData: true })).toBe("nothing"));
    it("downloads when another phone saved and this one is clean", () => expect(f({ base: 2, remote: 4, hasData: true })).toBe("download"));
    it("asks when both changed", () => expect(f({ base: 2, remote: 4, dirty: true, hasData: true })).toBe("ask"));
    it("re-saves when the account's copy was removed", () => expect(f({ base: 5, remote: 0, hasData: true })).toBe("upload"));
});

describe("crc32", () => {
    it("matches the standard check value", () => expect(crcHex(crc32(0, new TextEncoder().encode("123456789")))).toBe("cbf43926"));
    it("is the same in pieces", () => {
        const a = new TextEncoder().encode("12345"), b = new TextEncoder().encode("6789");
        expect(crcHex(crc32(crc32(0, a), b))).toBe("cbf43926");
    });
});
