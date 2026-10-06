export class Card {
    learningText: string;
    localizedText: string;
    exampleSentence: string;
    romanization: string;
    id?: number;

    constructor(
        learningText: string,
        localizedText: string,
        exampleSentence: string,
        romanization: string,
        id?: number
    ) {
        this.learningText = learningText;
        this.localizedText = localizedText;
        this.exampleSentence = exampleSentence;
        this.romanization = romanization;
        this.id = id;
    }
}