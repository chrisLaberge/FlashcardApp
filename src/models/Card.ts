export class Card {
    learningText: string;
    localizedText: string;
    exampleSentence: string;
    romanization: string;
    id?: number;
    /** Study level (see StudyMode). Only filled in when cards are loaded for review. */
    level?: number;
    /** When the card is next due. Only filled in by the card list. */
    nextReviewAt?: number;

    constructor(
        learningText: string,
        localizedText: string,
        exampleSentence: string,
        romanization: string,
        id?: number,
        level?: number
    ) {
        this.learningText = learningText;
        this.localizedText = localizedText;
        this.exampleSentence = exampleSentence;
        this.romanization = romanization;
        this.id = id;
        this.level = level;
    }
}