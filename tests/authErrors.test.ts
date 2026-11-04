import { authErrorMessage, isPlausibleEmail } from "@/utils/authErrors";

describe("authErrorMessage", () => {
    test.each([
        ["auth/invalid-credential", "Wrong email or password."],
        ["auth/wrong-password", "Wrong email or password."],
        ["auth/user-not-found", "Wrong email or password."],
        ["auth/email-already-in-use", "An account with this email already exists. Try signing in instead."],
        ["auth/network-request-failed", "No connection. Check your internet and try again."],
        ["auth/too-many-requests", "Too many attempts. Wait a few minutes and try again."],
        ["auth/requires-recent-login", "For your security, sign out, sign in again, and then delete the account."],
    ])("%s", (code, message) => {
        expect(authErrorMessage({ code })).toBe(message);
    });

    test("wrong password and unknown email read the same, so accounts cannot be probed", () => {
        expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(authErrorMessage({ code: "auth/wrong-password" }));
    });

    test("closing the Google dialog is not an error message", () => {
        expect(authErrorMessage({ code: "SIGN_IN_CANCELLED" })).toBe("");
    });

    test("unknown errors fall back to their message, then to a generic one", () => {
        expect(authErrorMessage(new Error("boom"))).toBe("boom");
        expect(authErrorMessage({})).toBe("Something went wrong. Try again.");
        expect(authErrorMessage(undefined)).toBe("Something went wrong. Try again.");
    });
});

describe("isPlausibleEmail", () => {
    test("accepts normal addresses and trims spaces", () => {
        expect(isPlausibleEmail("a@b.co")).toBe(true);
        expect(isPlausibleEmail("  chris@example.com ")).toBe(true);
    });
    test("rejects obvious typos", () => {
        for (const bad of ["", "abc", "a@b", "a b@c.com", "@x.com", "a@.com "]) expect(isPlausibleEmail(bad)).toBe(false);
    });
});
