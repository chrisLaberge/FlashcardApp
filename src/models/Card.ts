export class Card {
    learningText: string;
    localizedText: string;
    id?: number;

    constructor(
        learningText: string,
        localizedText: string,
        id?: number
    ) {
        this.learningText = learningText;
        this.localizedText = localizedText;
        this.id = id;
    }
}