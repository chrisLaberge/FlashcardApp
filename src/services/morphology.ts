/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs these paths written out as plain require() calls */
import Az from "az";
import { Asset } from "expo-asset";
import { createRussianAnalyzer } from "../models/language/russian";
import type { Analyzer } from "../models/language/types";

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
    const asset = Asset.fromModule(module);
    asset.downloadAsync()
        .then(() => fetch(asset.localUri ?? asset.uri))
        .then((response) => response.arrayBuffer())
        .then((buffer) => callback(null, buffer), (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
};

let russian: Promise<Analyzer> | null = null;

function loadRussian(): Promise<Analyzer> {
    return new Promise((resolve, reject) => {
        Az.Morph.init("az", (error) => (error ? reject(error) : resolve(createRussianAnalyzer(Az.Morph))));
    });
}

/**
 * The word analyser for a language, loaded the first time it is needed (the Russian dictionary takes a
 * moment). Null for languages without one. A failed load can be tried again later.
 */
export function analyzerFor(language: string): Promise<Analyzer | null> {
    if (language !== "ru") return Promise.resolve(null);
    russian ??= loadRussian().catch((error: unknown) => {
        russian = null;
        throw error;
    });
    return russian;
}
