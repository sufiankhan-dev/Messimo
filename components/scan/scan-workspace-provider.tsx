"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ApprovedFolder,
  OrganizationPlan,
  OrganizationPlanStatus,
  OrganizationProgress,
  ScanProgress,
  ScanResult,
} from "@/types";
import {
  apiErrorResponseSchema,
  scanStreamEventSchema,
  selectFolderResponseSchema,
} from "@/lib/validation/files";
import { organizationStreamEventSchema } from "@/lib/validation/organization";

export type ScanWorkspaceStatus =
  | "initializing"
  | "idle"
  | "selecting"
  | "scanning"
  | "ready"
  | "empty"
  | "cancelled"
  | "error";

interface ScanWorkspaceValue {
  folder: ApprovedFolder | null;
  result: ScanResult | null;
  progress: ScanProgress | null;
  status: ScanWorkspaceStatus;
  error: string | null;
  plan: OrganizationPlan | null;
  planStatus: OrganizationPlanStatus;
  planProgress: OrganizationProgress | null;
  planError: string | null;
  /** Resolves to an error message, or null when the folder was approved. */
  selectFolder: (path: string) => Promise<string | null>;
  scan: () => void;
  cancelScan: () => void;
  generatePlan: () => void;
  cancelPlan: () => void;
}

const STORAGE_KEY = "slothsort.selectedFolderPath";

/** Mirrors the planner default so the first progress state is realistic. */
const MAX_PLAN_FILES = 24;

const EMPTY_PROGRESS: ScanProgress = {
  scannedFiles: 0,
  directoriesScanned: 0,
  skippedCount: 0,
  currentRelativePath: "",
};

const ScanWorkspaceContext = createContext<ScanWorkspaceValue | null>(null);

export function ScanWorkspaceProvider({ children }: { children: ReactNode }) {
  const [folder, setFolder] = useState<ApprovedFolder | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [status, setStatus] = useState<ScanWorkspaceStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<OrganizationPlan | null>(null);
  const [planStatus, setPlanStatus] =
    useState<OrganizationPlanStatus>("idle");
  const [planProgress, setPlanProgress] =
    useState<OrganizationProgress | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const folderRef = useRef<ApprovedFolder | null>(null);
  const resultRef = useRef<ScanResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const runScan = useCallback(async (target: ApprovedFolder) => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setStatus("scanning");
    setError(null);
    setResult(null);
    resultRef.current = null;
    setProgress(EMPTY_PROGRESS);
    planAbortRef.current?.abort();
    planAbortRef.current = null;
    setPlan(null);
    setPlanStatus("idle");
    setPlanProgress(null);
    setPlanError(null);

    try {
      const response = await fetch("/api/folders/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: target.id }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await readApiMessage(response);
        if (runId !== runIdRef.current) return;
        setError(message);
        setStatus("error");
        return;
      }
      if (!response.body) {
        throw new Error("The scan response had no body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminalEventReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");
          if (!line) continue;

          let payload: unknown;
          try {
            payload = JSON.parse(line) as unknown;
          } catch {
            throw new Error("The scan stream was not valid JSON.");
          }

          const parsed = scanStreamEventSchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error("The scan stream returned an unexpected event.");
          }

          if (runId !== runIdRef.current) continue;
          const event = parsed.data;

          if (event.type === "progress") {
            setProgress(event.progress);
          } else if (event.type === "complete") {
            terminalEventReceived = true;
            resultRef.current = event.result;
            setResult(event.result);
            setProgress({
              scannedFiles: event.result.files.length,
              directoriesScanned: event.result.directoriesScanned,
              skippedCount: event.result.skippedCount,
              currentRelativePath: "",
            });
            setStatus(
              event.result.files.length === 0 &&
                event.result.skippedCount === 0
                ? "empty"
                : "ready",
            );
            setError(null);
          } else if (event.type === "error") {
            terminalEventReceived = true;
            setError(event.message);
            setStatus("error");
          } else if (event.type === "cancelled") {
            terminalEventReceived = true;
            setProgress(event.progress);
            setStatus("cancelled");
            setError(null);
          }
        }
      }

      if (runId !== runIdRef.current) return;
      if (!terminalEventReceived && !controller.signal.aborted) {
        setError(
          "The scan ended before it finished. Try again; no files were changed.",
        );
        setStatus("error");
      }
    } catch {
      if (runId !== runIdRef.current) return;
      if (controller.signal.aborted) {
        setStatus("cancelled");
        return;
      }
      setError(
        "The local scan endpoint did not respond. Check that the app server is running. No files were changed.",
      );
      setStatus("error");
    } finally {
      if (runId === runIdRef.current && abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const selectFolder = useCallback(
    async (path: string): Promise<string | null> => {
      const hadFolder = folderRef.current !== null;
      if (!hadFolder) setStatus("selecting");
      setError(null);

      try {
        const target = await requestFolderApproval(path);
        folderRef.current = target;
        setFolder(target);
        window.localStorage.setItem(STORAGE_KEY, target.displayPath);
        void runScan(target);
        return null;
      } catch (selectionError) {
        if (!hadFolder) setStatus("idle");
        return selectionError instanceof Error
          ? selectionError.message
          : "That folder could not be approved. Choose another folder.";
      }
    },
    [runScan],
  );

  const scan = useCallback(() => {
    const target = folderRef.current;
    if (!target) {
      setStatus("idle");
      return;
    }
    void runScan(target);
  }, [runScan]);

  const cancelScan = useCallback(() => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    setStatus("cancelled");
  }, []);

  const generatePlan = useCallback(() => {
    const target = folderRef.current;
    const scanned = resultRef.current;

    if (!target || !scanned) {
      setPlanError(
        "Scan a folder before generating suggestions. No files were changed.",
      );
      setPlanStatus("error");
      return;
    }

    const candidates = scanned.files.filter((file) => file.kind !== "other");
    if (candidates.length === 0) {
      setPlanError(
        "This scan has no supported files for local Gemma to review. No files were changed.",
      );
      setPlanStatus("error");
      return;
    }

    planAbortRef.current?.abort();
    const controller = new AbortController();
    planAbortRef.current = controller;

    setPlan(null);
    setPlanStatus("planning");
    setPlanError(null);
    setPlanProgress({
      completed: 0,
      total: Math.min(candidates.length, MAX_PLAN_FILES),
      currentFile: "",
      ready: 0,
      needsReview: 0,
      failed: 0,
    });

    void (async () => {
      try {
        const response = await fetch("/api/organize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId: target.id,
            relativePaths: candidates.map((file) => file.relativePath),
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setPlanError(await readApiMessage(response));
          setPlanStatus("error");
          return;
        }
        if (!response.body) {
          throw new Error("The organization response had no body.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let terminalEventReceived = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");
            if (!line) continue;

            let payload: unknown;
            try {
              payload = JSON.parse(line) as unknown;
            } catch {
              throw new Error("The organization stream was not valid JSON.");
            }

            const parsed = organizationStreamEventSchema.safeParse(payload);
            if (!parsed.success) {
              throw new Error(
                "The organization stream returned an unexpected event.",
              );
            }

            const event = parsed.data;

            if (event.type === "progress") {
              setPlanProgress(event.progress);
            } else if (event.type === "complete") {
              terminalEventReceived = true;
              setPlan(event.plan);
              setPlanProgress({
                completed: event.plan.totals.files,
                total: event.plan.totals.files,
                currentFile: "",
                ready: event.plan.totals.ready,
                needsReview: event.plan.totals.needsReview,
                failed: event.plan.totals.failed,
              });
              setPlanStatus("ready");
              setPlanError(null);
            } else if (event.type === "error") {
              terminalEventReceived = true;
              setPlanError(event.message);
              setPlanStatus("error");
            } else if (event.type === "cancelled") {
              terminalEventReceived = true;
              setPlanProgress(event.progress);
              setPlanStatus("cancelled");
              setPlanError(null);
            }
          }
        }

        if (!terminalEventReceived && !controller.signal.aborted) {
          setPlanError(
            "The organization preview ended before it finished. Try again; no files were changed.",
          );
          setPlanStatus("error");
        }
      } catch {
        if (controller.signal.aborted) {
          setPlanStatus("cancelled");
          return;
        }
        setPlanError(
          "The local organization endpoint did not respond. Check that the app server is running. No files were changed.",
        );
        setPlanStatus("error");
      } finally {
        if (planAbortRef.current === controller) {
          planAbortRef.current = null;
        }
      }
    })();
  }, []);

  const cancelPlan = useCallback(() => {
    if (!planAbortRef.current) return;
    planAbortRef.current.abort();
    setPlanStatus("cancelled");
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      // Defer the first state update so the effect only subscribes and returns.
      await Promise.resolve();
      if (!active) return;

      const storedPath = window.localStorage.getItem(STORAGE_KEY);
      if (!storedPath) {
        setStatus("idle");
        return;
      }

      setStatus("selecting");
      try {
        const target = await requestFolderApproval(storedPath);
        if (!active) return;
        folderRef.current = target;
        setFolder(target);
        window.localStorage.setItem(STORAGE_KEY, target.displayPath);
        await runScan(target);
      } catch {
        if (!active) return;
        window.localStorage.removeItem(STORAGE_KEY);
        setError(
          "The previously selected folder is no longer available. Choose a folder to start scanning.",
        );
        setStatus("idle");
      }
    })();

    return () => {
      active = false;
    };
  }, [runScan]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      planAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo<ScanWorkspaceValue>(
    () => ({
      folder,
      result,
      progress,
      status,
      error,
      plan,
      planStatus,
      planProgress,
      planError,
      selectFolder,
      scan,
      cancelScan,
      generatePlan,
      cancelPlan,
    }),
    [
      folder,
      result,
      progress,
      status,
      error,
      plan,
      planStatus,
      planProgress,
      planError,
      selectFolder,
      scan,
      cancelScan,
      generatePlan,
      cancelPlan,
    ],
  );

  return (
    <ScanWorkspaceContext.Provider value={value}>
      {children}
    </ScanWorkspaceContext.Provider>
  );
}

export function useScanWorkspace(): ScanWorkspaceValue {
  const context = useContext(ScanWorkspaceContext);
  if (!context) {
    throw new Error(
      "useScanWorkspace must be used inside ScanWorkspaceProvider.",
    );
  }
  return context;
}

async function requestFolderApproval(path: string): Promise<ApprovedFolder> {
  const response = await fetch("/api/folders/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiMessage(response));
  }

  const parsed = selectFolderResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("The folder response was not valid. Choose another folder.");
  }

  return parsed.data.folder;
}

async function readApiMessage(response: Response): Promise<string> {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // Fall through to a safe generic message.
  }

  if (response.status === 403) {
    return "This action is available only from the local SlothSort app on this computer.";
  }
  if (response.status === 404) {
    return "That folder is no longer available. Choose it again.";
  }

  return "The request could not be completed. No files were changed.";
}
