/**
 * How far the on-screen keyboard overlaps the bottom of a container, in pixels.
 * `containerBottom` and `keyboardTop` must be in the same (window) coordinates.
 * Returns 0 when there is no keyboard, or when the system already resized the window
 * so the container ends above the keyboard.
 */
export function keyboardOverlap(containerBottom: number, keyboardTop: number | null): number {
    if (keyboardTop === null) return 0;
    return Math.max(0, Math.round(containerBottom - keyboardTop));
}
