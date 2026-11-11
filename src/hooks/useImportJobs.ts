import { useSyncExternalStore } from "react";
import { getJobs, subscribe, type ImportJob } from "../services/pdfImport";

/** The PDFs being prepared right now; the screen redraws as they progress. */
export const useImportJobs = (): readonly ImportJob[] => useSyncExternalStore(subscribe, getJobs, getJobs);
