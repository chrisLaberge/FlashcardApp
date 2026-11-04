/** How long until a card is due, as short text: "Now", "15 min", "3 hr", "2 days". */
export function formatTimeRemaining(nextReviewAt?: number | null, now = Date.now()): string {
    if (!nextReviewAt) return "Now";

    const remaining = nextReviewAt - now;
    if (remaining <= 0) return "Now";

    const minutes = Math.ceil(remaining / (60 * 1000));
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours} hr`;

    const days = Math.ceil(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
}
