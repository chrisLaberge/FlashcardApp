import { googlePhotoAvatar } from "../src/constants/avatars";

describe("googlePhotoAvatar", () => {
    it("keeps Google photos", () => {
        expect(googlePhotoAvatar("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe("photo:https://lh3.googleusercontent.com/a/abc=s96-c");
    });
    it("refuses anything else", () => {
        expect(googlePhotoAvatar("https://example.com/me.png")).toBeNull();
        expect(googlePhotoAvatar(null)).toBeNull();
    });
});
