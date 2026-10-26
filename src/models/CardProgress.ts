export class CardProgress {
    id?: number;
    cardId: number;
    reviewCount: number;
    nextReviewAt?: number;
    mastered: boolean;
    fsrsCard?: string;
    lastReviewAt?: number;

    constructor(
        cardId: number,
        reviewCount: number = 0,
        nextReviewAt?: number,
        mastered: boolean = false,
        id?: number,
        fsrsCard?: string,
        lastReviewAt?: number,
    ) {
        this.cardId = cardId;
        this.reviewCount = reviewCount;
        this.nextReviewAt = nextReviewAt;
        this.mastered = mastered;
        this.id = id;
        this.fsrsCard = fsrsCard;
        this.lastReviewAt = lastReviewAt;
    }
}
