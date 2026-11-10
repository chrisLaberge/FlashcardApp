declare module "az" {
    const Az: {
        load: (url: string, responseType: "json" | "arraybuffer", callback: (error: Error | null, data?: unknown) => void) => void;
        Morph: ((word: string) => { normalize(): { word: string }; score: number; parser: string }[]) & {
            init(path: string, callback: (error?: Error | null) => void): void;
        };
    };
    export default Az;
}
