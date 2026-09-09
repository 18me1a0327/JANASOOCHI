"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "../lib/supabase/client";
import type { Json } from "../supabase/database.types";

type DocumentInfo = {
  filename: string;
  part_number: number;
  revision_identifier: string | null;
  storage_path: string;
};

type VoterSource = {
  bounding_box: Json | null;
  pdf_page_number: number;
};

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

type ViewerStatus = "loading" | "ready" | "error";

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoundingBox(value: unknown): BoundingBox | null {
  let candidate = value;

  if (typeof candidate === "string") {
    const serialized = candidate;
    try {
      candidate = JSON.parse(serialized);
    } catch {
      const values = serialized.split(",").map((item) => finiteNumber(item.trim()));
      if (values.length === 6 && values.every((item) => item !== null)) {
        const [x, y, width, height, pageWidth, pageHeight] = values as number[];
        candidate = { x, y, width, height, pageWidth, pageHeight };
      } else {
        return null;
      }
    }
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

  const record = candidate as Record<string, unknown>;
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  const width = finiteNumber(record.width);
  const height = finiteNumber(record.height);
  const pageWidth = finiteNumber(record.pageWidth ?? record.page_width);
  const pageHeight = finiteNumber(record.pageHeight ?? record.page_height);

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null ||
    pageWidth === null ||
    pageHeight === null ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    pageWidth <= 0 ||
    pageHeight <= 0 ||
    x >= pageWidth ||
    y >= pageHeight
  ) {
    return null;
  }

  return {
    x,
    y,
    width: Math.min(width, pageWidth - x),
    height: Math.min(height, pageHeight - y),
    pageWidth,
    pageHeight,
  };
}

function parsePage(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function constrainPage(page: number, total: number) {
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, total));
}

function userFacingLoadError(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "PasswordException") return "This PDF is password protected and cannot be displayed.";
  if (name === "InvalidPDFException") return "The uploaded source is not a valid PDF.";
  if (name === "MissingPDFException") return "The uploaded PDF is unavailable.";
  return "Unable to open PDF. Please try again or ask an administrator to verify the document.";
}

export function SourcePageViewer({ pdfId }: Readonly<{ pdfId: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [voterSource, setVoterSource] = useState<VoterSource | null>(null);
  const [box, setBox] = useState<BoundingBox | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const voterId = searchParams.get("voterId") ?? searchParams.get("voter");
  const requestedPage = parsePage(searchParams.get("page"));
  const bboxParameter = searchParams.get("bbox");
  const queryBox = useMemo(() => parseBoundingBox(bboxParameter), [bboxParameter]);

  const updateLocation = useCallback(
    (nextPage: number, totalPages = pdf?.numPages ?? 1) => {
      const constrained = constrainPage(nextPage, totalPages);
      setCurrentPage(constrained);
      const next = new URLSearchParams(searchParams.toString());
      next.set("page", String(constrained));
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [pdf?.numPages, router, searchParams],
  );

  useEffect(() => {
    let active = true;
    let loadedPdf: PDFDocumentProxy | null = null;
    let loadingTask: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | null = null;

    setStatus("loading");
    setError("");
    setPdf(null);
    setDocumentInfo(null);
    setVoterSource(null);
    setBox(null);

    void (async () => {
      try {
        const supabase = createClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("AUTH_REQUIRED");
        }

        const documentRequest = supabase
          .from("uploaded_pdfs")
          .select("filename,part_number,revision_identifier,storage_path")
          .eq("id", pdfId)
          .maybeSingle();

        const voterRequest = voterId
          ? supabase
              .from("voter_records")
              .select("bounding_box,pdf_page_number")
              .eq("id", voterId)
              .eq("pdf_id", pdfId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [documentResult, voterResult] = await Promise.all([documentRequest, voterRequest]);

        if (documentResult.error) {
          console.error("Source document query failed", documentResult.error);
          throw new Error("DATABASE_UNAVAILABLE");
        }
        if (!documentResult.data) throw new Error("SOURCE_NOT_FOUND");
        if (voterResult.error) {
          console.error("Voter source query failed", voterResult.error);
          throw new Error("DATABASE_UNAVAILABLE");
        }
        if (voterId && !voterResult.data) throw new Error("VOTER_SOURCE_NOT_FOUND");

        const source = documentResult.data as DocumentInfo;
        const voter = voterResult.data as VoterSource | null;
        const { data: signedSource, error: signedUrlError } = await supabase.storage
          .from("voter-pdfs")
          .createSignedUrl(source.storage_path, 300);

        if (signedUrlError || !signedSource?.signedUrl) {
          throw signedUrlError ?? new Error("SIGNED_URL_UNAVAILABLE");
        }

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ url: signedSource.signedUrl, withCredentials: false });
        loadedPdf = await loadingTask.promise;

        if (!active) {
          await loadedPdf.destroy();
          return;
        }

        const firstPage = constrainPage(voter?.pdf_page_number ?? requestedPage ?? 1, loadedPdf.numPages);
        setDocumentInfo(source);
        setVoterSource(voter);
        setBox(parseBoundingBox(voter?.bounding_box) ?? queryBox);
        setPdf(loadedPdf);
        setCurrentPage(firstPage);
        setStatus("ready");

        if (requestedPage !== firstPage) {
          const next = new URLSearchParams(searchParams.toString());
          next.set("page", String(firstPage));
          router.replace(`?${next.toString()}`, { scroll: false });
        }
      } catch (loadError) {
        console.error("Source PDF viewer load failed", loadError);
        if (!active) return;

        const message = loadError instanceof Error ? loadError.message : "";
        if (message === "AUTH_REQUIRED") {
          setError("Your session has expired. Sign in again to view this private source PDF.");
        } else if (message === "SOURCE_NOT_FOUND") {
          setError("Source document is unavailable or you do not have permission to view it.");
        } else if (message === "VOTER_SOURCE_NOT_FOUND") {
          setError("This voter record is not linked to the selected source PDF.");
        } else if (message === "DATABASE_UNAVAILABLE") {
          setError("Database temporarily unavailable. Please try again.");
        } else {
          setError(userFacingLoadError(loadError));
        }
        setStatus("error");
      }
    })();

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      if (loadingTask && !loadedPdf) void loadingTask.destroy();
      if (loadedPdf) void loadedPdf.destroy();
    };
    // Search parameters are deliberately captured at load time. Page-only changes
    // are handled by the synchronization effect below without reloading the PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfId, voterId, bboxParameter, reloadToken]);

  useEffect(() => {
    if (!pdf || requestedPage === null) return;
    const constrained = constrainPage(requestedPage, pdf.numPages);
    setCurrentPage(constrained);
    if (requestedPage !== constrained) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("page", String(constrained));
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }, [pdf, requestedPage, router, searchParams]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || status !== "ready") return;

    let cancelled = false;
    setRendering(true);
    setError("");
    renderTaskRef.current?.cancel();

    void (async () => {
      try {
        const sourcePage = await pdf.getPage(currentPage);
        if (cancelled) return;

        const viewport = sourcePage.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("CANVAS_UNAVAILABLE");

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const renderTask = sourcePage.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (renderError) {
        if (
          !cancelled &&
          !(renderError instanceof Error && renderError.name === "RenderingCancelledException")
        ) {
          console.error("Source PDF page render failed", renderError);
          setError("Unable to render this PDF page. Try a different page or reload the document.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [currentPage, pdf, status, zoom]);

  const highlightVisible = Boolean(
    box && (!voterSource || currentPage === voterSource.pdf_page_number),
  );

  return (
    <section className="source-page-viewer" aria-labelledby="source-viewer-title">
      <header className="source-page-viewer__header">
        <button className="button secondary small" type="button" onClick={() => router.back()}>
          <ArrowLeft aria-hidden="true" /> Back
        </button>
        <div>
          <span className="source-page-viewer__eyebrow">Authorized uploaded source</span>
          <h1 id="source-viewer-title">{documentInfo?.filename ?? "Original PDF page"}</h1>
          <p>
            {documentInfo ? `Part ${documentInfo.part_number}` : "Pallerlamudi electoral roll"}
            {documentInfo?.revision_identifier ? ` · ${documentInfo.revision_identifier}` : ""}
          </p>
        </div>
      </header>

      {status === "loading" && (
        <div className="source-page-viewer__state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" />
          <strong>Opening verified source page…</strong>
          <span>The private link is created only for your signed-in session.</span>
        </div>
      )}

      {status === "error" && (
        <div className="source-page-viewer__state source-page-viewer__state--error" role="alert">
          <FileSearch aria-hidden="true" />
          <strong>{error}</strong>
          <button className="button secondary small" type="button" onClick={() => setReloadToken((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && pdf && (
        <>
          <div className="source-page-viewer__toolbar" aria-label="PDF page controls">
            <button
              className="button secondary small"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => updateLocation(currentPage - 1)}
            >
              <ChevronLeft aria-hidden="true" /> Previous
            </button>
            <label className="source-page-viewer__page-input">
              <span>Physical page</span>
              <input
                aria-label="Physical PDF page"
                type="number"
                min={1}
                max={pdf.numPages}
                value={currentPage}
                onChange={(event) => updateLocation(Number(event.target.value) || 1)}
              />
              <span>of {pdf.numPages}</span>
            </label>
            <button
              className="button secondary small"
              type="button"
              disabled={currentPage >= pdf.numPages}
              onClick={() => updateLocation(currentPage + 1)}
            >
              Next <ChevronRight aria-hidden="true" />
            </button>
            <span className="source-page-viewer__toolbar-divider" aria-hidden="true" />
            <button
              className="button secondary small"
              type="button"
              disabled={zoom <= 0.6}
              onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.15).toFixed(2))))}
            >
              <ZoomOut aria-hidden="true" /> Zoom out
            </button>
            <span className="source-page-viewer__zoom" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="button secondary small"
              type="button"
              disabled={zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, Number((value + 0.15).toFixed(2))))}
            >
              <ZoomIn aria-hidden="true" /> Zoom in
            </button>
            <button className="button secondary small" type="button" onClick={() => setZoom(1.1)}>
              <RotateCcw aria-hidden="true" /> Reset
            </button>
          </div>

          {error && <div className="inline-notice source-page-viewer__render-error" role="alert">{error}</div>}

          <div className="source-page-viewer__stage" aria-busy={rendering} style={{ overflow: "auto" }}>
            {rendering && (
              <span className="source-page-viewer__rendering" role="status">
                <LoaderCircle className="spin" aria-hidden="true" /> Rendering page {currentPage}…
              </span>
            )}
            <div className="source-page-viewer__page" style={{ position: "relative", width: "fit-content" }}>
              <canvas ref={canvasRef} aria-label={`PDF physical page ${currentPage}`} />
              {highlightVisible && box && (
                <span
                  className="source-page-viewer__highlight"
                  aria-label="Voter card location"
                  style={{
                    position: "absolute",
                    left: `${Math.max(0, Math.min(100, (box.x / box.pageWidth) * 100))}%`,
                    top: `${Math.max(0, Math.min(100, (box.y / box.pageHeight) * 100))}%`,
                    width: `${Math.max(0, Math.min(100, (box.width / box.pageWidth) * 100))}%`,
                    height: `${Math.max(0, Math.min(100, (box.height / box.pageHeight) * 100))}%`,
                    border: "3px solid #e33f2e",
                    background: "rgba(255, 218, 55, 0.2)",
                    boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.8)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          <footer className="source-page-viewer__note">
            {highlightVisible ? (
              <><LocateFixed aria-hidden="true" /> The linked voter card is highlighted on its original page.</>
            ) : voterId ? (
              <><FileSearch aria-hidden="true" /> Exact voter-card coordinates are unavailable. The correct physical PDF page is shown.</>
            ) : (
              <><FileSearch aria-hidden="true" /> Showing the original uploaded PDF. Physical and printed page numbers remain separate.</>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

