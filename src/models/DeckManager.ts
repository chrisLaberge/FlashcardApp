import { Card } from "./Card";
import { Deck } from "./Deck";

export const deck = new Deck([
    new Card("你好", "Hello"),
    new Card("谢谢", "Thank you"),
    new Card("再见", "Goodbye"),
]);

export const completedDeck = new Deck();
