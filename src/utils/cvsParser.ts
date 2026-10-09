import Papa from "papaparse";

export interface CsvCard {
    learningText: string;
    definition: string;
    example?: string;
    timeTillNextReview?: number;
}

export function parseCsv(csvText: string): CsvCard[] {
    const result = Papa.parse<string[]>(csvText, {
        header: false,
        skipEmptyLines: "greedy",
        transform: (value) => value.trim(),
    });

    if (result.errors.length > 0) {
        throw new Error(result.errors[0].message);
    }

    return result.data
        .filter((row) => row[0] || row[1])
        .flatMap((row, index): CsvCard[] => {
            if (index === 0 &&
                row[0].toLowerCase() === "learningtext") {
                return []; // Skip the header row
            }

            if (!row[0] || !row[1]) {
                throw new Error(
                    `Row ${index + 1}: learning text and definition are required.`
                );
            }

            const time = row[3]
                ? Number(row[3])
                : undefined;

            if (time !== undefined &&
                (!Number.isFinite(time) || time < 0)) {
                throw new Error(
                    `Row ${index + 1}: invalid review time.`
                );
            }

            return [{
                learningText: row[0],
                definition: row[1],
                example: row[2] || undefined,
                timeTillNextReview: time,
            }];
        })
}
