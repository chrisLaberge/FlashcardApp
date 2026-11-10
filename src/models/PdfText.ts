/**
 * Turns the text of a PDF into lines for the reading screen. Each line is short enough to be used
 * as the context of a word lookup (the server accepts up to 300 characters of it).
 */
export const MAX_LINE = 240;

const SENTENCE_END = /(?<=[.!?。！？…])\s*/u;

/** Cuts text that is still too long at a space (or anywhere, for text without spaces such as Chinese). */
function hardSplit(text: string): string[] {
    const out: string[] = [];
    let rest = text.trim();
    while (rest.length > MAX_LINE) {
        const space = rest.lastIndexOf(" ", MAX_LINE);
        const at = space > MAX_LINE / 2 ? space : MAX_LINE;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
    return out;
}

/** Paragraphs become sentences; sentences stay together until a line is about as long as it should be. */
export function pdfLines(text: string): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split(/\n+/)) {
        const cleaned = paragraph.replace(/\s+/g, " ").trim();
        if (!cleaned) continue;
        let current = "";
        for (const sentence of cleaned.split(SENTENCE_END).filter((s) => s.length > 0)) {
            if (sentence.length > MAX_LINE) {
                if (current) lines.push(current);
                current = "";
                lines.push(...hardSplit(sentence));
            } else if (current && current.length + 1 + sentence.length > MAX_LINE) {
                lines.push(current);
                current = sentence;
            } else {
                current = current ? `${current}${/[。！？]$/u.test(current) ? "" : " "}${sentence}` : sentence;
            }
        }
        if (current) lines.push(current);
    }
    return lines;
}

/** A readable title from a file name: "my story_1.pdf" becomes "my story 1". */
export function titleFromFileName(name: string | null | undefined): string {
    const base = (name ?? "").replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    return base.length > 0 ? base.slice(0, 80) : "Untitled PDF";
}
