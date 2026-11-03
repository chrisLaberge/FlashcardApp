import { getRemoteVoice, getTTSLanguageCode } from "@/constants/languages";
import { normalizeSpeechText, ttsCacheName } from "@/utils/ttsCache";

describe("ttsCacheName", () => {
    test("the same voice and text always give the same name", () => {
        expect(ttsCacheName("hyw", "Բարեւ")).toBe(ttsCacheName("hyw", "Բարեւ"));
    });

    test("spaces around the text and Unicode form do not matter", () => {
        expect(ttsCacheName("hyw", "  Բարեւ  ")).toBe(ttsCacheName("hyw", "Բարեւ"));
        expect(ttsCacheName("hyw", "բարի   իրիկուն")).toBe(ttsCacheName("hyw", "բարի իրիկուն"));
        expect(ttsCacheName("hyw", "é")).toBe(ttsCacheName("hyw", "é"));
    });

    test("different text or a different voice gives a different name", () => {
        expect(ttsCacheName("hyw", "բարեւ")).not.toBe(ttsCacheName("hyw", "բարի"));
        expect(ttsCacheName("hyw", "բարեւ")).not.toBe(ttsCacheName("hye", "բարեւ"));
    });

    test("names are safe file names, prefixed with the voice", () => {
        expect(ttsCacheName("hyw", "ձայն/../x?")).toMatch(/^hyw-[0-9a-f]{16}$/);
    });

    test("no collisions across a few thousand different words", () => {
        const names = new Set<string>();
        for (let i = 0; i < 5000; i++) names.add(ttsCacheName("hyw", `word ${i} ա${i * 7}`));
        expect(names.size).toBe(5000);
    });
});

describe("normalizeSpeechText", () => {
    test("trims and collapses whitespace", () => {
        expect(normalizeSpeechText("  a \n b\t c ")).toBe("a b c");
        expect(normalizeSpeechText("   ")).toBe("");
    });
});

describe("language speech config", () => {
    test("Armenian uses the server voice, Russian and Chinese use the phone's", () => {
        expect(getRemoteVoice("hy")).toBe("hyw");
        expect(getRemoteVoice("ru")).toBeUndefined();
        expect(getRemoteVoice("zh")).toBeUndefined();
    });

    test("Russian and Chinese keep their phone language codes", () => {
        expect(getTTSLanguageCode("ru")).toBe("ru-RU");
        expect(getTTSLanguageCode("zh")).toBe("zh-CN");
    });
});
