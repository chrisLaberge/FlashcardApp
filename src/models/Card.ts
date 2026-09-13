export class Card {
    id?: number;
    front: string;
    back: string;

    constructor(front: string, back: string, id?: number) {
        this.front = front;
        this.back = back;
        this.id = id;
    }
}