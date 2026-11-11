import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { getMyText, getPendingPdfs, setMyTextBody } from "../../database/database";
import { ANALYSIS_REVISION, bookText, marksWords } from "../../models/ReaderWords";
import { useImportJobs } from "../../hooks/useImportJobs";
import { readerAnalyzerFor } from "../../services/morphology";
import { drop, enqueue, fail, update } from "../../services/pdfImport";
import { sendPdf } from "../../services/pdfReading";
import { friendlyPdfError } from "../../models/PdfErrors";
import { analyzeBook, syncKnownWords } from "../../services/vocabulary";
import { loadViewerHtml, WebView, type WebHandle } from "./viewerSource";

type Incoming =
    | { type: "ready" }
    | { type: "opened"; pages: number }
    | { type: "progress"; page: number; pages: number }
    | { type: "text"; from: number; pages: string[] }
    | { type: "textDone" }
    | { type: "error"; message: string; code?: string };

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
    const currentRef = useRef<number | null>(null);
    useEffect(() => {
        currentRef.current = jobId;
    }, [jobId]);
    const [html, setHtml] = useState<string | null>(null);
    const web = useRef<WebHandle>(null);
    const pages = useRef<string[]>([]);
    const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Unfinished PDFs from last time go back in line.
    useEffect(() => {
        void getPendingPdfs(ANALYSIS_REVISION).then((ids) => ids.forEach(enqueue)).catch(() => undefined);
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

    const finish = useCallback(async (id: number, read: string[] | null = pages.current) => {
        update(id, { phase: "counting", done: 0, total: 1 });
        try {
            const book = await getMyText(id);
            if (!book) return drop(id);
            if (read) await setMyTextBody(id, bookText(read));
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

    const start = useCallback(async (id: number) => {
        try {
            const book = await getMyText(id);
            if (!book?.pdfPath) return drop(id);
            // Already read (only the counting rules changed): count again without reading the pages.
            if (book.body.trim()) return void finish(id, null);
            update(id, { phase: "reading", done: 0, total: 0 });
            await sendPdf(
                book.pdfPath,
                { t: "open", page: 1, needText: true, headless: true, lang: book.language, segment: !marksWords(book.language) },
                send,
                () => kick(id), // reading a big file is slow but not stuck
                () => currentRef.current !== id, // deleted or replaced: stop feeding the page
            );
        } catch (error) {
            fail(id, error instanceof Error ? error.message : "Could not read the PDF.");
        }
    }, [send, kick, finish]);

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
                if (!/worker|importScripts/i.test(message.message)) fail(jobId, friendlyPdfError(message.code, message.message));
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
            onRenderProcessGone={() => fail(jobId, "The PDF reader stopped. Tap to try again.")}
            onContentProcessDidTerminate={() => fail(jobId, "The PDF reader stopped. Tap to try again.")}
        />
    );
}

// Tiny and see-through, but still laid out, so the phone keeps running its page.
const s = StyleSheet.create({
    hidden: { position: "absolute", width: 2, height: 2, opacity: 0, bottom: 0, left: 0 },
});

