import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { getBookIgnored, getBookSummary, getInDeckLemmas, getKnownLemmas, setLastPage, setMyTextBody, setWordKnown, setWordIgnored, type MyText } from "../../database/database";
import { bookText, learningKeys, marksWords, SYNC_SALT, unknownKeys } from "../../models/ReaderWords";
import type { Analyzer } from "../../models/language/types";
import { tokenize } from "../../models/Tokens";
import { readerAnalyzerFor } from "../../services/morphology";
import { openAddCard } from "../../services/openAddCard";
import { friendlyPdfError } from "../../models/PdfErrors";
import { sendPdf } from "../../services/pdfReading";
import { analyzeBook, syncIfCardsChanged, syncKnownWords } from "../../services/vocabulary";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";
import LookupSheet from "../LookupSheet";
import { loadViewerHtml, WebView, type WebHandle } from "./viewerSource";

type Props = {
    book: MyText;
    languageName: string;
    /** Called once the words of the whole book have been counted, so coverage can be shown again. */
    onAnalyzed?: () => void;
};

type Incoming =
    | { type: "ready" }
    | { type: "page"; page: number; pages: number }
    | { type: "words"; words: string[]; replace?: boolean }
    | { type: "select"; text: string; context: string }
    | { type: "markPage"; keys: string[] }
    | { type: "text"; from: number; pages: string[] }
    | { type: "textDone" }
    | { type: "error"; message: string; code?: string };

/** The original PDF, page by page. Select text to see what it means; words you do not know yet are marked. */
export default function PdfReader({ book, languageName, onAnalyzed }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const web = useRef<WebHandle>(null);
    const [html, setHtml] = useState<string | null>(null);
    const [failure, setFailure] = useState("");
    const [lookup, setLookup] = useState<{ text: string; context: string } | null>(null);
    const [noText, setNoText] = useState(false);
    const [working, setWorking] = useState(false);

    const known = useRef<Set<string>>(new Set());
    const deck = useRef<Set<string>>(new Set());
    const prep = useRef<Promise<Analyzer> | null>(null);
    const pagesText = useRef<string[]>([]);
    const needText = book.body.trim() === "";
    const started = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // The analyser and the words you know, loaded once while the page opens.
    const ready = useCallback(() => {
        prep.current ??= (async () => {
            const analyzer = await readerAnalyzerFor(book.language);
            try {
                // Only does the work when the cards changed since the last time.
                await syncIfCardsChanged(book.language, () => Promise.resolve(analyzer), SYNC_SALT);
            } catch {
                // The words you marked yourself still work.
            }
            known.current = await getKnownLemmas(book.language);
            deck.current = await getInDeckLemmas(book.language);
            // Names the book's own capitalisation gives away are left unmarked too.
            for (const name of await getBookIgnored(book.id).catch(() => new Set<string>())) known.current.add(name);
            return analyzer;
        })();
        return prep.current;
    }, [book.language, book.id]);

    useEffect(() => {
        let active = true;
        loadViewerHtml().then((h) => active && setHtml(h), (e: unknown) => active && setFailure(e instanceof Error ? e.message : String(e)));
        return () => {
            active = false;
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [ready]);

    // Starts loading the word dictionary right away, while the PDF itself is still opening.
    useEffect(() => { void ready(); }, [ready]);

    const send = useCallback((message: object) => {
        web.current?.injectJavaScript(`window.onRN(${JSON.stringify(message)});true;`);
    }, []);

    // Coming back from adding a card: re-read what you know, so the word you just added stops being marked.
    const firstFocus = useRef(true);
    useFocusEffect(useCallback(() => {
        if (firstFocus.current) {
            firstFocus.current = false;
            return;
        }
        if (!prep.current) return;
        void (async () => {
            try {
                const analyzer = await ready();
                await syncKnownWords(book.language, analyzer);
                const fresh = await getKnownLemmas(book.language);
                for (const name of await getBookIgnored(book.id).catch(() => new Set<string>())) fresh.add(name);
                known.current = fresh;
                deck.current = await getInDeckLemmas(book.language);
                send({ t: "reclassify" });
                onAnalyzed?.();
            } catch {
                // The marks stay as they were.
            }
        })();
    }, [ready, send, book.language, book.id, onAnalyzed]));

    const open = useCallback(async () => {
        if (!book.pdfPath) return;
        try {
            await sendPdf(
                book.pdfPath,
                {
                    t: "open", page: book.lastPage ?? 1, needText, lang: book.language, segment: !marksWords(book.language),
                    theme: { bg: t.bg, bar: t.surface, fg: t.text, muted: t.muted, accent: t.blue },
                },
                send,
                undefined,
                () => !mounted.current,
            );
        } catch (error) {
            setFailure(error instanceof Error ? error.message : String(error));
        }
    }, [book.pdfPath, book.lastPage, book.language, needText, send, t]);

    const finishText = useCallback(async () => {
        const body = bookText(pagesText.current);
        if (!body) {
            setNoText(true);
            return;
        }
        setWorking(true);
        try {
            await setMyTextBody(book.id, body);
            await analyzeBook(book.id, await ready());
            onAnalyzed?.();
        } catch {
            // The book is still readable; its words are counted next time.
        } finally {
            setWorking(false);
        }
    }, [book.id, ready, onAnalyzed]);

    // Marks every highlighted word on the page as known, after asking, because it is easy to tap by accident.
    const askMarkPage = useCallback((keys: string[]) => {
        if (keys.length === 0) {
            Alert.alert("Nothing to mark", "There are no highlighted words on this page.");
            return;
        }
        Alert.alert(
            "Mark this page as known?",
            `${keys.length} highlighted word${keys.length === 1 ? "" : "s"} on this page will count as known.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mark known",
                    onPress: () => void (async () => {
                        const analyzer = await ready();
                        const lemmas = new Set(keys.map((k) => analyzer.lemma(k).lemma));
                        for (const lemma of lemmas) {
                            known.current.add(lemma);
                            await setWordKnown(book.language, lemma, true);
                        }
                        send({ t: "reclassify" });
                        onAnalyzed?.();
                    })(),
                },
            ],
        );
    }, [book.language, ready, send, onAnalyzed]);

    // After the first words are marked: if the book was counted with older rules, count it again, then tell the
    // header. Until then the percentage is not shown, so it does not jump while the book opens.
    const settled = useRef(false);
    const settle = useCallback((analyzer: Analyzer) => {
        if (settled.current) return;
        settled.current = true;
        setTimeout(() => void (async () => {
            try {
                const saved = await getBookSummary(book.id);
                if (saved && saved.analyzerVersion !== analyzer.version && analyzer.language === book.language) {
                    await analyzeBook(book.id, analyzer);
                }
            } catch {
                // The old counts stay.
            }
            if (mounted.current) onAnalyzed?.();
        })(), 800);
    }, [book.id, book.language, onAnalyzed]);

    const onMessage = useCallback(async (event: WebViewMessageEvent) => {
        let message: Incoming;
        try {
            message = JSON.parse(event.nativeEvent.data) as Incoming;
        } catch {
            return;
        }
        switch (message.type) {
            case "ready":
                void open();
                break;
            case "page": {
                // The page is on screen; only now load the word dictionary, so opening is never held up by it.
                if (!started.current) {
                    started.current = true;
                    void ready();
                }
                if (saveTimer.current) clearTimeout(saveTimer.current);
                const n = message.page;
                saveTimer.current = setTimeout(() => void setLastPage(book.id, n).catch(() => undefined), 600);
                break;
            }
            case "words": {
                const analyzer = await ready();
                send({
                    t: "unknown",
                    keys: unknownKeys(message.words, analyzer, known.current),
                    learning: learningKeys(message.words, analyzer, deck.current),
                    replace: !!message.replace,
                });
                settle(analyzer);
                break;
            }
            case "markPage":
                askMarkPage(message.keys);
                break;
            case "select":
                setLookup({ text: message.text, context: message.context });
                break;
            case "text":
                pagesText.current[message.from - 1] = "";
                message.pages.forEach((p, i) => { pagesText.current[message.from - 1 + i] = p; });
                break;
            case "textDone":
                void finishText();
                break;
            case "error":
                // pdf.js falls back to running on the page itself when its helper thread cannot start; that is fine.
                if (!/worker|importScripts/i.test(message.message)) setFailure(friendlyPdfError(message.code, message.message));
                break;
        }
    }, [book.id, open, ready, send, finishText, askMarkPage, settle]);

    // A single word can be marked known; a phrase cannot.
    const single = lookup ? (marksWords(book.language) ? tokenize(lookup.text).filter((x) => x.word).length === 1 : !/\s/.test(lookup.text.trim())) : false;

    const markKnown = async () => {
        if (!lookup) return;
        const analyzer = await ready();
        const lemma = analyzer.lemma(lookup.text.trim()).lemma;
        known.current.add(lemma);
        setLookup(null);
        send({ t: "clear" });
        await setWordKnown(book.language, lemma, true);
        send({ t: "reclassify" });
        onAnalyzed?.();
    };

    const markIgnored = async () => {
        if (!lookup) return;
        const analyzer = await ready();
        const lemma = analyzer.lemma(lookup.text.trim()).lemma;
        known.current.add(lemma);
        setLookup(null);
        send({ t: "clear" });
        await setWordIgnored(book.language, lemma, true);
        send({ t: "reclassify" });
        onAnalyzed?.();
    };

    if (failure) return <View style={s.center}><Text style={s.error}>{failure}</Text></View>;
    if (!html) return <View style={s.center}><ActivityIndicator color={t.blue} /></View>;

    return (
        <View style={s.container}>
            <WebView
                ref={web}
                originWhitelist={["*"]}
                source={{ html, baseUrl: "https://reader.local/" }}
                onMessage={(e) => void onMessage(e)}
                javaScriptEnabled
                domStorageEnabled={false}
                setSupportMultipleWindows={false}
                overScrollMode="never"
                allowsLinkPreview={false}
                style={s.web}
                containerStyle={s.web}
                onError={() => setFailure("Could not show the PDF.")}
                onRenderProcessGone={() => setFailure("The PDF reader stopped. Go back and open it again.")}
                onContentProcessDidTerminate={() => setFailure("The PDF reader stopped. Go back and open it again.")}
            />
            {working ? <View style={s.badge} pointerEvents="none"><ActivityIndicator size="small" color={t.blue} /><Text style={s.badgeText}>Counting words…</Text></View> : null}
            {noText ? <View style={s.badge} pointerEvents="none"><Text style={s.badgeText}>No text found (scanned PDF)</Text></View> : null}

            {lookup && (
                <LookupSheet
                    key={`${lookup.text}\u0001${lookup.context}`}
                    text={lookup.text}
                    context={lookup.context}
                    languageName={languageName}
                    onClose={() => { setLookup(null); send({ t: "clear" }); }}
                    onKnown={single ? () => void markKnown() : undefined}
                    onIgnore={single ? () => void markIgnored() : undefined}
                    onAdd={(entry) => {
                        const example = lookup.context !== lookup.text ? lookup.context : "";
                        setLookup(null);
                        send({ t: "clear" });
                        void openAddCard(book.language, { text: entry.word, meaning: entry.translation, example });
                    }}
                />
            )}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    web: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: t.bg },
    error: { color: t.red, textAlign: "center" },
    badge: { position: "absolute", top: 10, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.surface, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    badgeText: { color: t.muted, fontSize: 13 },
});
