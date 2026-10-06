export class Card {
    learningText: string;
    localizedText: string;
    exampleSentence: string;
    id?: number;

    constructor(
        learningText: string,
        localizedText: string,
        exampleSentence: string,
        id?: number
    ) {
        this.learningText = learningText;
        this.localizedText = localizedText;
        this.exampleSentence = exampleSentence;
        this.id = id;
    }
}