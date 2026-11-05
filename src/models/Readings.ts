/**
 * Short, simple texts to read. Each line carries its English meaning so a learner can check
 * themselves, and every word in the text can be tapped for a definition.
 */
export type ReadingLine = { text: string; meaning: string };

export type Reading = {
    id: string;
    /** Language code, as in constants/languages.ts. */
    language: string;
    title: string;
    titleMeaning: string;
    level: string;
    lines: ReadingLine[];
};

const make = (language: string, items: { title: string; titleMeaning: string; lines: [string, string][] }[]): Reading[] =>
    items.map((item, i) => ({
        id: `${language}-${i + 1}`,
        language,
        title: item.title,
        titleMeaning: item.titleMeaning,
        level: "Beginner",
        lines: item.lines.map(([text, meaning]) => ({ text, meaning })),
    }));

export const readings: Reading[] = [
    ...make("zh", [
        { title: "自我介绍", titleMeaning: "Introducing myself", lines: [["你好！我叫小明。", "Hello! My name is Xiaoming."], ["我是学生。", "I am a student."], ["我喜欢喝水，也喜欢吃米饭。", "I like drinking water and I also like eating rice."]] },
        { title: "我的一天", titleMeaning: "My day", lines: [["我早上七点起床。", "I get up at seven in the morning."], ["我喝茶，吃面包。", "I drink tea and eat bread."], ["然后我去学校。", "Then I go to school."], ["晚上我在家看书。", "In the evening I read at home."]] },
    ]),
    ...make("ru", [
        { title: "Знакомство", titleMeaning: "Getting acquainted", lines: [["Привет! Меня зовут Анна.", "Hi! My name is Anna."], ["Я живу в Москве.", "I live in Moscow."], ["Я люблю чай и хлеб.", "I like tea and bread."]] },
        { title: "Мой день", titleMeaning: "My day", lines: [["Утром я пью кофе.", "In the morning I drink coffee."], ["Потом я иду на работу.", "Then I go to work."], ["Вечером я читаю книгу дома.", "In the evening I read a book at home."]] },
    ]),
    ...make("es", [
        { title: "Me presento", titleMeaning: "Introducing myself", lines: [["¡Hola! Me llamo Carlos.", "Hello! My name is Carlos."], ["Vivo en Madrid con mi familia.", "I live in Madrid with my family."], ["Me gusta el café y el pan.", "I like coffee and bread."]] },
        { title: "Mi día", titleMeaning: "My day", lines: [["Por la mañana desayuno en casa.", "In the morning I have breakfast at home."], ["Después voy al trabajo en autobús.", "Afterwards I go to work by bus."], ["Por la noche leo un libro.", "At night I read a book."]] },
    ]),
    ...make("fr", [
        { title: "Je me présente", titleMeaning: "Introducing myself", lines: [["Bonjour ! Je m'appelle Claire.", "Hello! My name is Claire."], ["J'habite à Paris avec mon chat.", "I live in Paris with my cat."], ["J'aime le café et le pain.", "I like coffee and bread."]] },
        { title: "Ma journée", titleMeaning: "My day", lines: [["Le matin, je prends le petit déjeuner.", "In the morning, I have breakfast."], ["Ensuite, je vais au travail en métro.", "Then I go to work by metro."], ["Le soir, je lis un livre à la maison.", "In the evening I read a book at home."]] },
    ]),
    ...make("de", [
        { title: "Ich stelle mich vor", titleMeaning: "Introducing myself", lines: [["Hallo! Ich heiße Lena.", "Hello! My name is Lena."], ["Ich wohne mit meiner Familie in Berlin.", "I live in Berlin with my family."], ["Ich mag Kaffee und Brot.", "I like coffee and bread."]] },
        { title: "Mein Tag", titleMeaning: "My day", lines: [["Am Morgen frühstücke ich zu Hause.", "In the morning I have breakfast at home."], ["Dann fahre ich mit dem Bus zur Arbeit.", "Then I take the bus to work."], ["Am Abend lese ich ein Buch.", "In the evening I read a book."]] },
    ]),
];

export const readingsFor = (language: string): Reading[] => readings.filter((r) => r.language === language);
export const getReading = (id: string): Reading | undefined => readings.find((r) => r.id === id);
