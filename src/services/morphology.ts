/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs these paths written out as plain require() calls */
import Az from "az";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { getDecks } from "../database/database";
import { fromBase64 } from "../models/Base64";
import { createRussianAnalyzer } from "../models/language/russian";
import { createStemAnalyzer } from "../models/language/stemmed";
import type { Analyzer } from "../models/language/types";
import { plainAnalyzer } from "../models/ReaderWords";

// The dictionary files az needs, bundled with the app (about 11 MB).
const JSON_FILES: Record<string, unknown> = {
    "grammemes.json": require("az/dicts/grammemes.json"),
    "gramtab-opencorpora-int.json": require("az/dicts/gramtab-opencorpora-int.json"),
    "gramtab-opencorpora-ext.json": require("az/dicts/gramtab-opencorpora-ext.json"),
    "suffixes.json": require("az/dicts/suffixes.json"),
};
const BINARY_FILES: Record<string, number> = {
    "words.dawg": require("az/dicts/words.dawg"),
    "p_t_given_w.intdawg": require("az/dicts/p_t_given_w.intdawg"),
    "paradigms.array": require("az/dicts/paradigms.array"),
    "prediction-suffixes-0.dawg": require("az/dicts/prediction-suffixes-0.dawg"),
    "prediction-suffixes-1.dawg": require("az/dicts/prediction-suffixes-1.dawg"),
    "prediction-suffixes-2.dawg": require("az/dicts/prediction-suffixes-2.dawg"),
};

// az asks for files by path; answer from the bundled copies instead of a file system.
Az.load = (url, responseType, callback) => {
    const name = url.slice(url.lastIndexOf("/") + 1);
    if (responseType === "json") {
        const data = JSON_FILES[name];
        callback(data === undefined ? new Error(`Missing ${name}`) : null, data);
        return;
    }
    const module = BINARY_FILES[name];
    if (module === undefined) {
        callback(new Error(`Missing ${name}`));
        return;
    }
    readBundled(module).then((buffer) => {
        try {
            callback(null, buffer);
        } catch (error) {
            // A file that does not parse would otherwise be an unhandled error and the load would never finish.
            loadFailed?.(error instanceof Error ? error : new Error(String(error)));
        }
    }, (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
};

/** A bundled file's exact bytes. Read as base64 and decoded here: `fetch(...).arrayBuffer()` returns cut-off data for big files on some phones. */
async function readBundled(module: number): Promise<ArrayBuffer> {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const bytes = fromBase64(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

let loadFailed: ((error: Error) => void) | null = null;

let russian: Promise<Analyzer> | null = null;

function loadRussian(): Promise<Analyzer> {
    return new Promise((resolve, reject) => {
        loadFailed = reject;
        const timer = setTimeout(() => reject(new Error("The Russian dictionary took too long to load.")), 90_000);
        Az.Morph.init("az", (error) => {
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(createRussianAnalyzer(Az.Morph));
        });
    });
}

/**
 * The word analyser for a language, loaded the first time it is needed (the Russian dictionary takes a
 * moment). Null for languages without one. A failed load can be tried again later.
 */
export function analyzerFor(language: string): Promise<Analyzer | null> {
    if (language !== "ru") return Promise.resolve(createStemAnalyzer(language));
    russian ??= loadRussian().catch((error: unknown) => {
        russian = null;
        throw error;
    });
    return russian;
}

/** The analyser the PDF reader uses: the language's own, or a plain one (a word is just itself) when it has none. */
export async function readerAnalyzerFor(language: string): Promise<Analyzer> {
    try {
        return (await analyzerFor(language)) ?? plainAnalyzer(language);
    } catch {
        return plainAnalyzer(language);
    }
}

/** Starts loading the Russian dictionary in the background when you study Russian, so opening a PDF does not wait for it. */
export async function prewarmAnalyzers(): Promise<void> {
    try {
        if ((await getDecks()).some((d) => d.language === "ru")) await analyzerFor("ru");
    } catch {
        // It loads again when it is needed.
    }
}
