import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { ComponentType, Ref } from "react";
import { WebView as NativeWebView, type WebViewProps } from "react-native-webview";
import { viewerHtml } from "./viewerHtml";

export type WebHandle = { injectJavaScript: (script: string) => void };

// The package types its class so that it cannot be used in JSX as written; this is the shape it really has.
export const WebView = NativeWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebHandle> }>;

let page: Promise<string> | null = null;

/** The reader page, built once: pdf.js comes from files bundled with the app. */
export function loadViewerHtml(): Promise<string> {
    page ??= (async () => {
        const text = async (module: number) => {
            const asset = Asset.fromModule(module);
            await asset.downloadAsync();
            return new File(asset.localUri ?? asset.uri).text();
        };
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro needs these written as plain require() calls
        const [lib, worker] = await Promise.all([text(require("../../../assets/pdfviewer/pdf.min.pdfjs")), text(require("../../../assets/pdfviewer/pdf.worker.min.pdfjs"))]);
        return viewerHtml(lib, worker);
    })().catch((error: unknown) => {
        page = null;
        throw error;
    });
    return page;
}
