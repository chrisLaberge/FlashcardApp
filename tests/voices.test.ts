import { chooseVoice, hasVoiceFor, languageBase } from "@/utils/voices";

describe("languageBase", () => {
    test("ignores region and separator, and maps three-letter codes", () => {
        expect(languageBase("ru-RU")).toBe("ru");
        expect(languageBase("fr_FR")).toBe("fr");
        expect(languageBase("cmn-CN")).toBe("zh");
        expect(languageBase("zh-CN")).toBe("zh");
        expect(languageBase("rus")).toBe("ru");
    });
});

describe("hasVoiceFor", () => {
    const voices = [{ language: "en-US" }, { language: "fr_FR" }, { language: "cmn-CN" }];

    test("matches by language", () => {
        expect(hasVoiceFor(voices, "fr-CA")).toBe(true);
        expect(hasVoiceFor(voices, "hy-AM")).toBe(false);
        expect(hasVoiceFor(voices, "ru-RU")).toBe(false);
        expect(hasVoiceFor(voices, undefined)).toBe(false);
    });

    test("Android's cmn-CN counts as Chinese (zh-CN)", () => {
        expect(hasVoiceFor(voices, "zh-CN")).toBe(true);
    });

    test("when the device lists no voices at all we assume speech works", () => {
        expect(hasVoiceFor([], "hy-AM")).toBe(true);
    });
});

describe("chooseVoice", () => {
    const ru = (id: string, language = "ru-RU", quality = "Default") => ({ identifier: id, language, quality });

    test("returns undefined when no voice speaks the language", () => {
        expect(chooseVoice([ru("en-us-x-1", "en-US")], "ru-RU")).toBeUndefined();
        expect(chooseVoice([], "ru-RU")).toBeUndefined();
        expect(chooseVoice([ru("a")], undefined)).toBeUndefined();
    });

    test("prefers the exact region, then enhanced quality, then voices stored on the phone", () => {
        expect(chooseVoice([ru("ua", "ru-UA"), ru("ru")], "ru-RU")!.identifier).toBe("ru");
        expect(chooseVoice([ru("plain"), ru("better", "ru-RU", "Enhanced")], "ru-RU")!.identifier).toBe("better");
        expect(chooseVoice([ru("ru-ru-x-ruf-network"), ru("ru-ru-x-ruf-local")], "ru-RU")!.identifier).toBe(
            "ru-ru-x-ruf-local",
        );
    });

    test("the choice is the same whatever order the phone lists the voices in", () => {
        const voices = [ru("b"), ru("a"), ru("c")];
        expect(chooseVoice(voices, "ru-RU")!.identifier).toBe("a");
        expect(chooseVoice([...voices].reverse(), "ru-RU")!.identifier).toBe("a");
    });

    test("finds a Chinese voice that Android calls cmn-CN", () => {
        expect(chooseVoice([ru("zh-voice", "cmn-CN")], "zh-CN")!.identifier).toBe("zh-voice");
    });
});
