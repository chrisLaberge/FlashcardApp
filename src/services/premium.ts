/**
 * Whether this person pays for "no ads". For now nobody does; when Play Billing is added this reads a flag
 * saved on the account (so it follows them between phones) and the banner below disappears for them.
 */
export function isPremium(): boolean {
    return false;
}
