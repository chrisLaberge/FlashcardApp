export class CardProgress {
    id?: number;
    cardId: number;
    reviewCount: number;
    nextReviewAt?: number;
    mastered: boolean;

    constructor(
        cardId: number,
        reviewCount: number = 0,
        nextReviewAt?: number,
        mastered: boolean = false,
        id?: number
    ) {
        this.cardId = cardId;
        this.reviewCount = reviewCount;
        this.nextReviewAt = nextReviewAt;
        this.mastered = mastered;
        this.id = id;
    }
}