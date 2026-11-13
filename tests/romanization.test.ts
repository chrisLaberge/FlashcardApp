import { chinesePinyin, getRomanization } from "@/utils/romanization";

describe("Chinese pinyin", () => {
    test.each([
        ["银行", "yín háng"],
        ["行李", "xíng li"],
        ["重庆", "chóng qìng"],
        ["长大", "zhǎng dà"],
        ["了解", "liǎo jiě"],
        ["还是", "hái shì"],
        ["睡觉", "shuì jiào"],
        ["一个人", "yí gè rén"],
        ["不对", "bú duì"],
        ["我去银行了", "wǒ qù yín háng le"],
    ])("%s reads %s", (text, expected) => {
        expect(chinesePinyin(text)).toBe(expected);
    });

    test("punctuation and other writing stay attached, with no stray spaces", () => {
        expect(chinesePinyin("你好，世界！")).toBe("nǐ hǎo， shì jiè！");
        expect(chinesePinyin("我有3个apple。")).toBe("wǒ yǒu 3 gè apple。");
        expect(chinesePinyin("（你好）")).toBe("（nǐ hǎo）");
    });

    test("goes through getRomanization for zh, and blank text gives nothing", async () => {
        expect(await getRomanization("银行", "zh")).toBe("yín háng");
        expect(await getRomanization("  ", "zh")).toBeNull();
    });
});
