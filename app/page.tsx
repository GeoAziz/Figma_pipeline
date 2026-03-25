"use client";

import { useState, useCallback, useRef } from "react";
import type {
  UIPhase,
  TabType,
  ExtractionResult,
  FigmaFileResponse,
  CollectionResults,
  TemplateType,
} from "@/lib/types";
import {
  figmaFetch,
  collectAll,
  extractFileKey,
  formatFileSize,
} from "@/lib/figma";
import { generateMarkdown, MARKDOWN_TEMPLATES } from "@/lib/markdown";

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: "connect", label: "Connect" },
  { id: "extract", label: "Extract" },
  { id: "generate", label: "Generate" },
  { id: "export", label: "Export" },
];

export default function FigmaToMarkdown(): JSX.Element {
  const [token, setToken] = useState<string>("");
  const [fileKey, setFileKey] = useState<string>("");
  const [phase, setPhase] = useState<UIPhase>("idle");
  const [step, setStep] = useState<number>(0);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState<TabType>("preview");
  const [copied, setCopied] = useState<boolean>(false);
  const [template, setTemplate] = useState<TemplateType>("full");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async (): Promise<void> => {
    if (!token.trim() || !fileKey.trim()) return;

    const key = extractFileKey(fileKey);
    setPhase("loading");
    setError("");
    setStep(0);

    try {
      // Step 1 – Fetch file
      setProgress("Fetching file structure from Figma…");
      const fileData = (await figmaFetch(
        `/files/${key}?depth=3`,
        token
      )) as FigmaFileResponse;
      setStep(1);

      // Step 2 – Extract design data
      setProgress("Extracting design tokens, frames & components…");
      const treeResults: CollectionResults = {
        frames: [],
        components: [],
        colors: new Map(),
        fonts: new Map(),
        interactions: [],
        effects: new Map(),
        layerPatterns: new Map(),
      };

      fileData.document.children.forEach((pageNode) => {
        pageNode.children?.forEach((child) =>
          collectAll(child, 1, treeResults)
        );
      });

      // Dedup frames
      const seen = new Set<string>();
      const uniqueFrames = treeResults.frames
        .filter((f) => {
          if (seen.has(f.id)) return false;
          seen.add(f.id);
          return true;
        })
        .slice(0, 60);

      setStep(2);

      // Step 3 – Fetch thumbnails in batches
      setProgress(`Fetching thumbnails for ${uniqueFrames.length} screens…`);
      const thumbnails: Record<string, string> = {};
      const ids = uniqueFrames.map((f) => f.id);

      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        try {
          const imgData = (await figmaFetch(
            `/images/${key}?ids=${batch.join(",")}&format=png&scale=1`,
            token
          )) as any;
          Object.assign(thumbnails, imgData.images || {});
          setProgress(
            `Thumbnails: ${Math.min(i + 10, ids.length)}/${ids.length} done…`
          );
        } catch {
          // Continue if thumbnail fetch fails
        }
      }

      // Step 4 – Generate markdown
      setProgress("Generating AI build specification…");
      const md = generateMarkdown({
        fileData,
        frames: uniqueFrames,
        thumbnails,
        colors: treeResults.colors,
        fonts: treeResults.fonts,
        components: treeResults.components,
        interactions: treeResults.interactions,
        effects: treeResults.effects,
        fileKey: key,
        template,
      });

      setResult({
        fileData,
        frames: uniqueFrames,
        thumbnails,
        colors: treeResults.colors,
        fonts: treeResults.fonts,
        components: treeResults.components,
        interactions: treeResults.interactions,
        effects: treeResults.effects,
      });
      setMarkdown(md);
      setStep(3);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }, [token, fileKey, template]);

  const download = (): void => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result?.fileData?.name?.replace(/\s+/g, "-").toLowerCase() || "design"}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = (): void => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const topColors = result
    ? [...result.colors.values()]
        .sort((a, b) => b.usages - a.usages)
        .slice(0, 12)
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#fafafa",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient mesh background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 20% 10%, rgba(139,92,246,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(244,114,182,0.05) 0%, transparent 50%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 20px 60px",
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: "40px 0 32px", borderBottom: "1px solid #18181b" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              ✦
            </div>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: "-0.03em",
                }}
              >
                Figma → Markdown
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#52525b",
                  marginTop: 1,
                }}
              >
                AI Build Spec Generator · Product v1
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 6,
              }}
            >
              <span
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#71717a",
                }}
              >
                REST API
              </span>
              <span
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#a78bfa",
                }}
              >
                v1.0
              </span>
            </div>
          </div>
          <p
            style={{
              color: "#71717a",
              fontSize: 14,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            Extract your entire Figma design — screens, components, colours,
            typography — and generate a structured{" "}
            <strong style={{ color: "#a1a1aa" }}>.md spec file</strong> ready
            to drop into any AI to build the full product.
          </p>
        </div>

        {/* ── Progress stepper ── */}
        <div style={{ display: "flex", gap: 0, padding: "28px 0 0", marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i < STEPS.length - 1 ? "1" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background:
                      step > i
                        ? "linear-gradient(135deg, #a78bfa, #7c3aed)"
                        : step === i && phase === "loading"
                          ? "rgba(139,92,246,0.2)"
                          : "#18181b",
                    border: `1.5px solid ${step > i ? "transparent" : step === i ? "#a78bfa" : "#27272a"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color:
                      step > i ? "#fff" : step === i ? "#a78bfa" : "#52525b",
                    transition: "all 0.3s",
                    position: "relative",
                  }}
                >
                  {step > i ? "✓" : i + 1}
                  {step === i && phase === "loading" && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: "2px solid transparent",
                        borderTopColor: "#a78bfa",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: step >= i ? "#a78bfa" : "#3f3f46",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      step > i
                        ? "linear-gradient(90deg, #7c3aed, #a78bfa)"
                        : "#18181b",
                    margin: "0 8px",
                    marginBottom: 22,
                    transition: "all 0.3s",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Input card ── */}
        {phase !== "done" && (
          <div
            style={{
              background: "#111113",
              border: "1px solid #1e1e22",
              borderRadius: 16,
              padding: 28,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#71717a",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 8,
                  }}
                >
                  Figma Personal Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="figd_xxxxxxxxxxxxxxxxxxxx"
                  style={{
                    width: "100%",
                    background: "#0d0d0f",
                    border: "1px solid #27272a",
                    borderRadius: 10,
                    padding: "11px 14px",
                    color: "#fafafa",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "monospace",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#7c3aed")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#27272a")
                  }
                />
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 5 }}>
                  Settings → Personal Access Tokens in Figma
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#71717a",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 8,
                  }}
                >
                  Figma File URL or Key
                </label>
                <input
                  type="text"
                  value={fileKey}
                  onChange={(e) => setFileKey(e.target.value)}
                  placeholder="https://figma.com/design/AbCdEf… or just the key"
                  style={{
                    width: "100%",
                    background: "#0d0d0f",
                    border: "1px solid #27272a",
                    borderRadius: 10,
                    padding: "11px 14px",
                    color: "#fafafa",
                    fontSize: 13,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#7c3aed")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#27272a")
                  }
                />
                <div style={{ fontSize: 11, color: "#3f3f46", marginTop: 5 }}>
                  Paste the full URL — the key is auto-extracted
                </div>
              </div>
            </div>

            <button
              onClick={run}
              disabled={
                !token.trim() || !fileKey.trim() || phase === "loading"
              }
              style={{
                width: "100%",
                padding: "13px 24px",
                background:
                  token && fileKey
                    ? "linear-gradient(135deg, #7c3aed, #a78bfa)"
                    : "#1e1e22",
                border: "none",
                borderRadius: 10,
                cursor:
                  token && fileKey
                    ? "pointer"
                    : "not-allowed",
                color: token && fileKey ? "#fff" : "#52525b",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "-0.01em",
                transition: "all 0.2s",
                opacity: phase === "loading" ? 0.7 : 1,
              }}
            >
              {phase === "loading"
                ? `⏳ ${progress}`
                : "✦ Extract & Generate Markdown Spec"}
            </button>
          </div>
        )}

        {/* ── Error state ── */}
        {phase === "error" && (
          <div
            style={{
              background: "#130a0a",
              border: "1px solid #3f1515",
              borderRadius: 14,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontSize: 20 }}>⚠️</div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Extraction failed
                </div>
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                >
                  {error}
                </div>
                <button
                  onClick={() => setPhase("idle")}
                  style={{
                    marginTop: 14,
                    background: "transparent",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    color: "#a1a1aa",
                    padding: "7px 18px",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ← Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {phase === "done" && result && (
          <div>
            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: "Screens", value: result.frames.length, icon: "📱" },
                { label: "Colours", value: result.colors.size, icon: "🎨" },
                {
                  label: "Font Families",
                  value: result.fonts.size,
                  icon: "✍️",
                },
                {
                  label: "Doc Size",
                  value: formatFileSize(markdown.length),
                  icon: "📄",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "#111113",
                    border: "1px solid #1e1e22",
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      background:
                        "linear-gradient(135deg, #fafafa, #a1a1aa)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#52525b",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Template Selector */}
            <div
              style={{
                background: "#111113",
                border: "1px solid #1e1e22",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#52525b",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                📋 Specification Template
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                {(Object.entries(MARKDOWN_TEMPLATES) as Array<[TemplateType, any]>).map(
                  ([key, tmpl]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setTemplate(key);
                        setProgress("Regenerating with new template…");
                        setPhase("loading");
                        setStep(3);
                        // Trigger regeneration by simulating the extraction process
                        setTimeout(() => {
                          if (result) {
                            const md = generateMarkdown({
                              fileData: result.fileData,
                              frames: result.frames,
                              thumbnails: result.thumbnails,
                              colors: result.colors,
                              fonts: result.fonts,
                              components: result.components,
                              interactions: result.interactions,
                              effects: result.effects,
                              fileKey: extractFileKey(fileKey),
                              template: key,
                            });
                            setMarkdown(md);
                            setPhase("done");
                          }
                        }, 500);
                      }}
                      style={{
                        background:
                          template === key
                            ? "linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(124, 58, 237, 0.2))"
                            : "#1e1e22",
                        border:
                          template === key
                            ? "1.5px solid #a78bfa"
                            : "1px solid #27272a",
                        borderRadius: 10,
                        padding: "12px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (template !== key) {
                          (
                            e.target as HTMLButtonElement
                          ).style.background = "#1a1a1e";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (template !== key) {
                          (e.target as HTMLButtonElement).style.background =
                            "#1e1e22";
                        }
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            template === key
                              ? "#a78bfa"
                              : "#fafafa",
                        }}
                      >
                        {tmpl.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#71717a",
                          marginTop: 2,
                        }}
                      >
                        {tmpl.description}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
            {topColors.length > 0 && (
              <div
                style={{
                  background: "#111113",
                  border: "1px solid #1e1e22",
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#52525b",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    fontWeight: 600,
                    marginBottom: 10,
                  }}
                >
                  Extracted Palette
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {topColors.map((c) => (
                    <div
                      key={c.hex}
                      title={`${c.hex} · used ${c.usages}×`}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: c.hex,
                        border: "1px solid rgba(255,255,255,0.08)",
                        cursor: "default",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Markdown viewer */}
            <div
              style={{
                background: "#111113",
                border: "1px solid #1e1e22",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Tabs + actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 20px",
                  borderBottom: "1px solid #1e1e22",
                  background: "#0d0d0f",
                }}
              >
                <div style={{ display: "flex" }}>
                  {(["preview", "raw"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: tab === t ? "#a78bfa" : "#52525b",
                        fontWeight: tab === t ? 600 : 400,
                        fontSize: 13,
                        padding: "14px 16px",
                        borderBottom: `2px solid ${tab === t ? "#a78bfa" : "transparent"}`,
                        transition: "all 0.2s",
                      }}
                    >
                      {t === "preview" ? "📄 Preview" : "🔤 Raw Markdown"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={copy}
                    style={{
                      background: "#1a1a1e",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      color: copied ? "#22c55e" : "#a1a1aa",
                      padding: "7px 14px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={download}
                    style={{
                      background:
                        "linear-gradient(135deg, #7c3aed, #a78bfa)",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      padding: "7px 16px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ↓ Download .md
                  </button>
                  <button
                    onClick={() => {
                      setPhase("idle");
                      setResult(null);
                      setMarkdown("");
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      color: "#52525b",
                      padding: "7px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                style={{
                  maxHeight: 520,
                  overflowY: "auto",
                  padding: tab === "raw" ? 0 : "0 24px 24px",
                }}
              >
                {tab === "raw" ? (
                  <textarea
                    ref={textRef}
                    readOnly
                    value={markdown}
                    style={{
                      width: "100%",
                      minHeight: 500,
                      background: "#0a0a0c",
                      color: "#a1a1aa",
                      border: "none",
                      outline: "none",
                      fontFamily:
                        "'JetBrains Mono', 'Fira Code', monospace",
                      fontSize: 12,
                      lineHeight: 1.7,
                      padding: 24,
                      resize: "none",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div style={{ paddingTop: 20 }}>
                    {/* Screen thumbnails grid */}
                    {result.frames.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#71717a",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            marginBottom: 16,
                          }}
                        >
                          {result.frames.length} Screens Extracted
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 12,
                            marginBottom: 24,
                          }}
                        >
                          {result.frames.slice(0, 9).map((f) => (
                            <div
                              key={f.id}
                              style={{
                                background: "#0d0d0f",
                                border: "1px solid #1e1e22",
                                borderRadius: 10,
                                overflow: "hidden",
                                cursor: "default",
                              }}
                            >
                              <div
                                style={{
                                  height: 120,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "#0a0a0c",
                                  overflow: "hidden",
                                }}
                              >
                                {result.thumbnails[f.id] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={result.thumbnails[f.id]}
                                    alt={f.name}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "contain",
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      color: "#3f3f46",
                                      fontSize: 24,
                                    }}
                                  >
                                    ⬚
                                  </div>
                                )}
                              </div>
                              <div style={{ padding: "8px 10px" }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#a1a1aa",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {f.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "#3f3f46",
                                    marginTop: 2,
                                  }}
                                >
                                  {f.node?.absoluteBoundingBox
                                    ? `${Math.round(f.node.absoluteBoundingBox.width)}×${Math.round(f.node.absoluteBoundingBox.height)}`
                                    : f.type}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {result.frames.length > 9 && (
                          <div
                            style={{
                              color: "#52525b",
                              fontSize: 12,
                              marginBottom: 16,
                            }}
                          >
                            + {result.frames.length - 9} more screens in the
                            .md file
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown preview as styled text */}
                    <div
                      style={{
                        background: "#0d0d0f",
                        borderRadius: 12,
                        padding: 20,
                        border: "1px solid #18181b",
                        fontSize: 12,
                        lineHeight: 1.8,
                        color: "#71717a",
                        fontFamily: "monospace",
                        maxHeight: 280,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {markdown.slice(0, 1200)}
                      <span style={{ color: "#3f3f46" }}>
                        {markdown.length > 1200
                          ? "\n\n… (full content in .md file)"
                          : ""}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI usage tip */}
            <div
              style={{
                background: "rgba(139,92,246,0.05)",
                border: "1px solid rgba(139,92,246,0.15)",
                borderRadius: 12,
                padding: "16px 20px",
                marginTop: 16,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontSize: 20 }}>💡</div>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#a78bfa",
                    marginBottom: 4,
                  }}
                >
                  How to use this spec
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#71717a",
                    lineHeight: 1.6,
                  }}
                >
                  Download the{" "}
                  <code
                    style={{
                      background: "#1e1e22",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    .md
                  </code>{" "}
                  file and paste it into Claude, GPT-4, Cursor, or any AI
                  with: <em>&quot;Build the full application described in this spec.&quot;</em>{" "}
                  All colours, typography, screen layouts, components and build
                  instructions are included.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── How it works ── */}
        {phase === "idle" && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize: 11,
                color: "#3f3f46",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              How it works
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {[
                {
                  n: "01",
                  title: "Connect",
                  desc: "Add your Figma PAT and file URL. No server, no storage — direct browser → Figma API.",
                },
                {
                  n: "02",
                  title: "Extract",
                  desc: "Pulls all screens, components, colours, typography and dimensions at depth-3 traversal.",
                },
                {
                  n: "03",
                  title: "Generate",
                  desc: "Builds a structured markdown spec with design tokens, screen inventory, build instructions.",
                },
                {
                  n: "04",
                  title: "Drop into AI",
                  desc: "Paste the .md into Claude / GPT / Cursor → get a fully built product, pixel-perfect.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  style={{
                    background: "#111113",
                    border: "1px solid #1e1e22",
                    borderRadius: 12,
                    padding: "18px 20px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#52525b",
                      marginBottom: 8,
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      marginBottom: 6,
                      color: "#e4e4e7",
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#52525b",
                      lineHeight: 1.6,
                    }}
                  >
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        input::placeholder { color: #3f3f46; }
      `}</style>
    </div>
  );
}
