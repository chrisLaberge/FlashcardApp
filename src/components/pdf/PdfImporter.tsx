import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { getMyText, getPendingPdfs, setMyTextBody } from "../../database/database";
import { bookText, marksWords } from "../../models/ReaderWords";
import { useImportJobs } from "../../hooks/useImportJobs";
import { readerAnalyzerFor } from "../../services/morphology";
import { drop, enqueue, fail, update } from "../../services/pdfImport";
import { pdfChunks } from "../../services/pdfReading";
import { analyzeBook, syncKnownWords } from "../../services/vocabulary";
import { loadViewerHtml, WebView, type WebHandle } from "./viewerSource";

type Incoming =
    | { type: "ready" }
    | { type: "opened"; pages: number }
    | { type: "progress"; page: number; pages: number }
    | { type: "text"; from: number; pages: string[] }
    | { type: "textDone" }
    | { type: "error"; message: string };

/** No sign of life from a PDF for this long and the job is marked failed, so one bad file cannot block the rest. */
const STALL_MS = 120_000;

/**
 * Prepares added PDFs in the background: reads every page's text, then counts the words. It lives at the
 * top of the app, so leaving the Library does not stop it, and anything unfinished when the app closed
 * starts again the next time. The page it uses is invisible.
 */
export default function PdfImporter() {
    const jobs = useImportJobs();
    const job = jobs.find((j) => j.phase !== "failed");
    const jobId = job?.id ?? null;
    const [html, setHtml] = useState<string | null>(null);
    const web = useRef<WebHandle>(null);
    const pages = useRef<string[]>([]);
    const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Unfinished PDFs from last time go back in line.
    useEffect(() => {
        void getPendingPdfs().then((ids) => ids.forEach(enqueue)).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (jobId === null || html) return;
        let active = true;
        loadViewerHtml().then((h) => active && setHtml(h), () => active && jobId !== null && fail(jobId, "Could not start the PDF reader."));
        return () => {
            active = false;
        };
    }, [jobId, html]);

    // A new book starts with an empty page list and a fresh watchdog.
    const kick = useCallback((id: number) => {
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = setTimeout(() => fail(id, "Reading took too long. Tap to try again."), STALL_MS);
    }, []);

    useEffect(() => {
        if (jobId === null) return;
        pages.current = [];
        kick(jobId);
        return () => {
            if (watchdog.current) clearTimeout(watchdog.current);
        };
    }, [jobId, kick]);

    const send = useCallback((message: object) => web.current?.injectJavaScript(`window.onRN(${JSON.stringify(message)});true;`), []);

    const start = useCallback(async (id: number) => {
        try {
            const book = await getMyText(id);
            if (!book?.pdfPath) return drop(id);
            update(id, { phase: "reading", done: 0, total: 0 });
            const chunks = await pdfChunks(book.pdfPath);
            send({ t: "open", chunks: chunks.length, page: 1, needText: true, headless: true, lang: book.language, segment: !marksWords(book.language) });
            chunks.forEach((d, i) => send({ t: "chunk", i, d }));
        } catch (error) {
            fail(id, error instanceof Error ? error.message : "Could not read the PDF.");
        }
    }, [send]);

    const finish = useCallback(async (id: number) => {
        update(id, { phase: "counting", done: 0, total: 1 });
        try {
            const book = await getMyText(id);
            if (!book) return drop(id);
            await setMyTextBody(id, bookText(pages.current));
            const analyzer = await readerAnalyzerFor(book.language);
            try {
                await syncKnownWords(book.language, analyzer);
            } catch {
                // Words you marked yourself still count.
            }
            await analyzeBook(id, analyzer, (done, total) => { kick(id); update(id, { done, total }); });
            drop(id);
        } catch (error) {
            fail(id, error instanceof Error ? error.message : "Could not count the words.");
        }
    }, [kick]);

    const onMessage = useCallback((event: WebViewMessageEvent) => {
        if (jobId === null) return;
        let message: Incoming;
        try {
            message = JSON.parse(event.nativeEvent.data) as Incoming;
        } catch {
            return;
        }
        kick(jobId);
        switch (message.type) {
            case "ready":
                void start(jobId);
                break;
            case "opened":
                update(jobId, { total: message.pages });
                break;
            case "progress":
                update(jobId, { done: message.page, total: message.pages });
                break;
            case "text":
                message.pages.forEach((p, i) => { pages.current[message.from - 1 + i] = p; });
                break;
            case "textDone":
                if (watchdog.current) clearTimeout(watchdog.current);
                void finish(jobId);
                break;
            case "error":
                // pdf.js falls back to running on the page itself when its helper thread cannot start; that is fine.
                if (!/worker|importScripts/i.test(message.message)) fail(jobId, "Could not read this PDF.");
                break;
        }
    }, [jobId, kick, start, finish]);

    if (jobId === null || !html) return null;
    return (
        <WebView
            key={jobId}
            ref={web}
            originWhitelist={["*"]}
            source={{ html, baseUrl: "https://reader.local/" }}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled={false}
            style={s.hidden}
            containerStyle={s.hidden}
            pointerEvents="none"
            onError={() => fail(jobId, "Could not start the PDF reader.")}
        />
    );
}

// Tiny and see-through, but still laid out, so the phone keeps running its page.
const s = StyleSheet.create({
    hidden: { position: "absolute", width: 2, height: 2, opacity: 0, bottom: 0, left: 0 },
});

