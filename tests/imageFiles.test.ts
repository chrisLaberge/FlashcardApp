import { imageFileName } from "@/utils/imageFiles";

describe("imageFileName", () => {
    test("keeps the extension of the original address", () => {
        expect(imageFileName(7, "https://storage.example.com/a/b/123.webp")).toBe("7.webp");
        expect(imageFileName(8, "https://x.test/pic.JPG")).toBe("8.jpg");
    });

    test("ignores query strings and fragments", () => {
        expect(imageFileName(9, "https://x.test/pic.png?token=abc.def#top")).toBe("9.png");
    });

    test("falls back to jpg when there is no usable extension", () => {
        expect(imageFileName(10, "https://x.test/download")).toBe("10.jpg");
        expect(imageFileName(11, "/images/123")).toBe("11.jpg");
    });

    test("works for the old partial paths", () => {
        expect(imageFileName(12, "/images/123.webp")).toBe("12.webp");
    });
});
