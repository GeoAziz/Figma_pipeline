import {
  FigmaFileResponse,
  ExtractedFrame,
  ExtractedColor,
  ExtractedFont,
  ExtractedComponent,
  FlowConnection,
  TemplateType,
  MarkdownTemplate,
  ScreenGroup,
  DesignVariable,
  TokenMode,
  PageInfo,
  ExtractionDiagnostics,
  Asset,
} from "./types";
import { hexToRgb, parseScreenName } from "./figma";

interface GenerateMarkdownParams {
  fileData: FigmaFileResponse;
  frames: ExtractedFrame[];
  thumbnails: Record<string, string>;
  colors: Map<string, ExtractedColor>;
  fonts: Map<string, ExtractedFont>;
  components: ExtractedComponent[];
  interactions: FlowConnection[];
  fileKey: string;
  template?: TemplateType;
  effects?: Map<string, { type: string; count: number }>;
  /** Text labels extracted from Container flow-map frames */
  flowMapLabels?: string[];
  /** Grouped screen inventory (built during collection) */
  screenGroups?: Map<string, ScreenGroup>;
  /** Wave 2: Design variables and token modes */
  variables?: Map<string, DesignVariable>;
  tokenModes?: TokenMode[];
  /** Wave 2: Page information */
  pages?: PageInfo[];
  /** Wave 2: Extraction diagnostics */
  diagnostics?: ExtractionDiagnostics;
  /** Wave 2: Extracted assets */
  assets?: Asset[];
  /** Count of named styles fetched from /files/{key}/styles (separate namespace from fileData.styles) */
  namedStyleCount?: number;
}

// Pre-built markdown templates
export const MARKDOWN_TEMPLATES: Record<TemplateType, MarkdownTemplate> = {
  minimal: {
    type: "minimal",
    name: "Minimal Spec",
    description: "Essential screens, colors, and typography only",
    sections: ["overview", "colors", "typography", "flowmap", "screens", "instructions"],
  },
  full: {
    type: "full",
    name: "Full Specification",
    description: "Complete spec with components, layout, effects, interactions, tokens, and diagnostics",
    sections: [
      "overview",
      "colors",
      "typography",
      "components",
      "interactions",
      "layout",
      "effects",
      "tokens",
      "flowmap",
      "screens",
      "diagnostics",
      "instructions",
      "assets",
    ],
  },
  accessibility: {
    type: "accessibility",
    name: "Accessibility-Focused",
    description: "Emphasizes accessibility, component docs, and semantic naming",
    sections: [
      "overview",
      "colors",
      "typography",
      "components",
      "accessibility",
      "tokens",
      "flowmap",
      "screens",
      "instructions",
    ],
  },
};

/**
 * Generate markdown specification with template support
 */
export function generateMarkdown({
  fileData,
  frames,
  thumbnails,
  colors,
  fonts,
  components,
  interactions,
  fileKey,
  template = "full",
  effects,
  flowMapLabels = [],
  screenGroups,
  variables = new Map(),
  tokenModes = [],
  pages = [],
  diagnostics,
  assets = [],
  namedStyleCount,
}: GenerateMarkdownParams): string {
  const selectedTemplate = MARKDOWN_TEMPLATES[template];
  const now = new Date().toISOString().split("T")[0];

  // Only extract tokens from live (non-rasterized) screens
  const liveFrames = frames.filter((f) => !f.isRasterized);
  const topColors = [...colors.values()]
    .sort((a, b) => b.usages - a.usages)
    .slice(0, 20);

  // Build screen groups from frames if not provided
  const groups: Map<string, ScreenGroup> = screenGroups ?? buildGroupsFromFrames(frames);

  let md = buildHeader(fileData, fileKey, now);

  selectedTemplate.sections.forEach((section) => {
    switch (section) {
      case "overview":
        md += buildOverview(fileData, frames, components, groups, namedStyleCount);
        break;
      case "colors":
        md += buildColorPalette(topColors, liveFrames.length, frames.length);
        break;
      case "typography":
        md += buildTypography(fonts, liveFrames.length, frames.length);
        break;
      case "components":
        md += buildComponentInventory(components);
        break;
      case "interactions":
        md += buildInteractions(interactions, frames);
        break;
      case "layout":
        md += buildLayoutGuide(frames);
        break;
      case "effects":
        md += buildEffectsGuide(frames, effects);
        break;
      case "flowmap":
        md += buildFlowMapSection(flowMapLabels);
        break;
      case "screens":
        md += buildScreenInventory(frames, thumbnails, fileKey, groups);
        break;
      case "accessibility":
        md += buildAccessibilityGuide(components);
        break;
      case "instructions":
        md += buildBuildInstructions(liveFrames, frames, topColors, fonts);
        break;
      case "assets":
        md += buildAssetChecklist(frames, fileKey);
        break;
      case "tokens":
        md += buildTokensAndVariables(variables, tokenModes);
        md += buildResponsiveness(frames);
        break;
      case "diagnostics":
        md += buildDiagnostics(diagnostics ?? { visitedNodes: 0, pagesScanned: 0, screensDetected: 0, screenLikeFrames: 0, metadataFiltered: 0, componentInstanceLabelFiltered: 0, rasterizedScreens: 0, constraintsExtracted: 0, variablesExtracted: 0, assetsIdentified: 0, extractionConfidence: 0, skippedReasons: {} }, frames);
        md += buildPageTopology(pages);
        md += buildAssetManifestSection(assets);
        break;
    }
  });

  const liveCount = liveFrames.length;
  const stubCount = frames.length - liveCount;
  md += `\n_Generated by **Figma→Markdown Generator** · ${frames.length} screens (${liveCount} live, ${stubCount} rasterized stubs) · ${topColors.length} colours · ${fonts.size} font families · ${components.length} components_\n`;

  return md;
}

/** Derive screen groups from a frames array (fallback when not passed in) */
function buildGroupsFromFrames(frames: ExtractedFrame[]): Map<string, ScreenGroup> {
  const groups = new Map<string, ScreenGroup>();
  frames.forEach((f) => {
    const parsed = f.screenGroup ?? parseScreenName(f.name);
    if (!parsed) return;
    const key = `${parsed.num}_${parsed.feature}`;
    if (!groups.has(key)) groups.set(key, { key, num: parsed.num, feature: parsed.feature });
    const g = groups.get(key)!;
    if (parsed.theme === "Light") g.light = f;
    else g.dark = f;
  });
  return groups;
}

function buildHeader(fileData: FigmaFileResponse, fileKey: string, date: string): string {
  return `# ${fileData.name} — AI Build Specification
> Auto-generated by Figma→Markdown on ${date}  
> Source file: \`${fileKey}\` | Version: ${fileData.version || "N/A"} | Last modified: ${fileData.lastModified?.split("T")[0] || "N/A"}

---

`;
}

function buildOverview(
  fileData: FigmaFileResponse,
  frames: ExtractedFrame[],
  components: ExtractedComponent[],
  groups: Map<string, ScreenGroup>,
  namedStyleCount?: number
): string {
  const pageNames = fileData.document.children.map((p) => p.name);
  const liveCount = frames.filter((f) => !f.isRasterized).length;
  const stubCount = frames.length - liveCount;
  const groupCount = groups.size;

  // Prefer the dedicated styles endpoint count; fall back to inline styles from the file document
  const styleCount =
    namedStyleCount !== undefined
      ? namedStyleCount
      : fileData.styles
        ? Object.keys(fileData.styles).length
        : "N/A";

  return `## 📋 Project Overview

| Field | Value |
|-------|-------|
| Project Name | **${fileData.name}** |
| Total Screens | ${frames.length} (${groupCount > 0 ? `${groupCount} screen groups × Light/Dark` : "flat list"}) |
| Live Screens | ${liveCount} (full component tree) |
| Rasterized Stubs | ${stubCount} (PNG-backed, no traversable children) |
| Pages | ${pageNames.join(", ")} |
| Components | ${components.length} |
| Named Styles | ${styleCount} |

`;
}

function buildColorPalette(colors: ExtractedColor[], liveCount?: number, totalCount?: number): string {
  const caveat =
    liveCount !== undefined && totalCount !== undefined && liveCount < totalCount
      ? `\n> ⚠️ **Partial coverage** — tokens extracted from ${liveCount} live screen(s) only; ${totalCount - liveCount} rasterized stubs are not analysable.\n`
      : "";

  return `## 🎨 Colour Palette
${caveat}
${
  colors.length > 0
    ? `| Hex | RGB | Usage Count | Opacity |
|-----|-----|-------------|---------|
${colors.map((c) => `| \`${c.hex}\` | ${hexToRgb(c.hex)} | ${c.usages}× | ${c.alpha}% |`).join("\n")}`
    : "_No solid colour fills extracted_"
}

`;
}

function buildTypography(fonts: Map<string, ExtractedFont>, liveCount?: number, totalCount?: number): string {
  const caveat =
    liveCount !== undefined && totalCount !== undefined && liveCount < totalCount
      ? `\n> ⚠️ **Partial coverage** — typography extracted from ${liveCount} live screen(s) only; full token set requires the paid component library page.\n`
      : "";

  return `## 📝 Typography
${caveat}
${
  fonts.size > 0
    ? `| Font Family | Weights Used | Sizes Used |
|-------------|--------------|-----------|
${[...fonts.values()]
  .map(
    (f) =>
      `| **${f.family}** | ${[...f.weights].sort().join(", ")} | ${[...f.sizes]
        .sort((a, b) => a - b)
        .map((s) => s + "px")
        .join(", ")} |`
  )
  .join("\n")}`
    : "_No font data extracted_"
}

`;
}

function buildComponentInventory(components: ExtractedComponent[]): string {
  if (components.length === 0) {
    return `## 🧩 Components

_No components extracted._

`;
  }

  let md = `## 🧩 Components (${components.length} components)

`;

  components.slice(0, 20).forEach((comp) => {
    md += `### ${comp.name}
- **ID:** \`${comp.id}\`
- **Type:** ${comp.node.type}`;

    if (comp.description) {
      md += `\n- **Description:** ${comp.description}`;
    }

    if (comp.variants.length > 0) {
      md += `\n- **Variants:** ${comp.variants.length}
${comp.variants
  .slice(0, 5)
  .map(
    (v) =>
      `  - \`${v.name}\`${v.description ? `: ${v.description}` : ""}`
  )
  .join("\n")}`;
      if (comp.variants.length > 5) {
        md += `\n  - ... and ${comp.variants.length - 5} more variants`;
      }
    }

    if (comp.layoutInfo) {
      md += `\n- **Layout:** ${comp.layoutInfo.mode}${comp.layoutInfo.hasAutoLayout ? " (auto-layout)" : ""}`;
    }

    md += "\n\n";
  });

  if (components.length > 20) {
    md += `\n_... and ${components.length - 20} more components_\n\n`;
  }

  return md;
}

function buildInteractions(
  interactions: FlowConnection[],
  frames: ExtractedFrame[]
): string {
  if (interactions.length === 0) {
    return `## 🔗 User Flows & Interactions

_No prototype connections detected._

`;
  }

  const frameMap = new Map(frames.map((f) => [f.id, f.name]));
  let md = `## 🔗 User Flows & Interactions (${interactions.length} connections)

`;

  interactions.slice(0, 15).forEach((flow) => {
    const fromName = frameMap.get(flow.fromScreen) || "Unknown";
    const toName = frameMap.get(flow.toScreen) || "Unknown";
    md += `- **${fromName}** → **${toName}** on \`${flow.trigger}\` (${flow.transitionType})\n`;
  });

  if (interactions.length > 15) {
    md += `\n_... and ${interactions.length - 15} more connections_\n`;
  }

  md += "\n";
  return md;
}

function buildLayoutGuide(frames: ExtractedFrame[]): string {
  const framesWithLayout = frames.filter((f) => f.layout);

  if (framesWithLayout.length === 0) {
    return `## 🏗️ Layout & Constraints

_No auto-layout information extracted._

`;
  }

  let md = `## 🏗️ Layout & Constraints

Screens with auto-layout or responsive design:

`;

  framesWithLayout.slice(0, 10).forEach((frame) => {
    if (frame.layout) {
      md += `- **${frame.name}**
  - Mode: \`${frame.layout.mode}\`
  - Primary Axis: \`${frame.layout.primaryAxis}\`
  - Counter Axis: \`${frame.layout.counterAxis}\`\n`;
    }
  });

  if (framesWithLayout.length > 10) {
    md += `\n_... and ${framesWithLayout.length - 10} more screens with layouts_\n`;
  }

  md += "\n";
  return md;
}

function buildEffectsGuide(
  frames: ExtractedFrame[],
  effects?: Map<string, { type: string; count: number }>
): string {
  const framesWithEffects = frames.filter((f) => f.effects && f.effects.length > 0);

  if (framesWithEffects.length === 0) {
    return `## ✨ Visual Effects

_No effects (shadows, blur) detected._

`;
  }

  let md = `## ✨ Visual Effects

`;

  if (effects && effects.size > 0) {
    md += `### Effect Summary

| Effect Type | Count |
|-------------|-------|
${[...effects.entries()]
  .map(([type, data]) => `| ${type} | ${data.count} |`)
  .join("\n")}

`;
  }

  md += `### Screens with Effects

`;

  framesWithEffects.slice(0, 10).forEach((frame) => {
    if (frame.effects && frame.effects.length > 0) {
      md += `- **${frame.name}**: ${frame.effects.map((e) => e.type).join(", ")}\n`;
    }
  });

  if (framesWithEffects.length > 10) {
    md += `\n_... and ${framesWithEffects.length - 10} more screens_\n`;
  }

  md += "\n";
  return md;
}

/** Navigation / Flow Map section derived from Container frame text nodes */
function buildFlowMapSection(labels: string[]): string {
  if (labels.length === 0) {
    return `## 🗺️ Navigation / Flow Map

_No Container flow-map frames detected._

`;
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique = labels.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  return `## 🗺️ Navigation / Flow Map

> Extracted from Container flow-map frame(s). Each label below corresponds to a named screen or state in the user navigation graph.

${unique.map((l) => `- ${l}`).join("\n")}

`;
}

function buildScreenInventory(
  frames: ExtractedFrame[],
  thumbnails: Record<string, string>,
  fileKey: string,
  groups?: Map<string, ScreenGroup>
): string {
  const liveCount = frames.filter((f) => !f.isRasterized).length;
  const stubCount = frames.length - liveCount;

  // When we have groups (Nutrio-style), render a grouped view
  if (groups && groups.size > 0) {
    const sortedGroups = [...groups.values()].sort((a, b) => a.num - b.num);

    let md = `## 📱 Screen Inventory (${groups.size} screen groups · ${frames.length} total · ${liveCount} live · ${stubCount} rasterized stubs)

> Screens are grouped by number + feature. Each group has a Light and Dark variant.\n\n`;

    sortedGroups.forEach((g, i) => {
      md += `### ${i + 1}. Group \`${g.num}_${g.feature}\`\n`;

      const renderVariant = (f: ExtractedFrame | undefined, theme: "Light" | "Dark") => {
        if (!f) {
          md += `- **${theme}:** _not found_\n`;
          return;
        }
        const bb = f.node?.absoluteBoundingBox;
        const dims = bb ? `${Math.round(bb.width)}×${Math.round(bb.height)}px` : "N/A";
        const status = f.isRasterized ? "🖼 rasterized stub (PNG export)" : "✅ live";
        const thumb = thumbnails[f.id] ? ` · ![thumb](${thumbnails[f.id]})` : "";
        md += `- **${theme}:** \`${f.id}\` · ${dims} · ${status}${thumb}\n`;
        if (!f.isRasterized) {
          const childCount = f.node?.children?.length || 0;
          const childNames = f.node?.children?.slice(0, 6).map((c) => c.name).join(", ") || "";
          if (childCount > 0) {
            md += `  - _Children:_ ${childNames}${childCount > 6 ? ` … +${childCount - 6} more` : ""}\n`;
          }
        }
        md += `  - [Open in Figma](https://www.figma.com/design/${fileKey}?node-id=${f.id.replace(":", "-")})\n`;
      };

      renderVariant(g.light, "Light");
      renderVariant(g.dark, "Dark");
      md += "\n";
    });

    return md;
  }

  // Fallback: flat list (non-Nutrio files)
  let md = `## 📱 Screen Inventory (${frames.length} screens)\n\n`;

  frames.forEach((f, i) => {
    const bb = f.node?.absoluteBoundingBox;
    const fills = f.node?.fills?.filter(
      (x: { type: string; color?: { r: number; g: number; b: number } }) =>
        x.type === "SOLID" && x.color
    ) as any[] | undefined;
    const bgHex =
      fills && fills.length > 0
        ? (() => {
            const { r, g, b } = fills[0].color;
            return `#${[r, g, b]
              .map((x) =>
                Math.round(x * 255)
                  .toString(16)
                  .padStart(2, "0")
              )
              .join("")}`;
          })()
        : null;
    const childCount = f.node?.children?.length || 0;
    const childNames =
      f.node?.children?.slice(0, 8).map((c) => c.name).join(", ") || "";
    const thumb = thumbnails[f.id]
      ? `\n> 🖼️ Thumbnail: ![${f.name}](${thumbnails[f.id]})`
      : "";
    const status = f.isRasterized ? " 🖼 _(rasterized stub)_" : " ✅ _(live)_";

    md += `### ${i + 1}. ${f.name}${status}
- **Type:** \`${f.type}\`
- **Node ID:** \`${f.id}\`
- **Dimensions:** ${bb ? `${Math.round(bb.width)}×${Math.round(bb.height)}px` : "N/A"}
- **Background:** ${bgHex ? `\`${bgHex}\`` : "transparent/none"}
- **Direct children:** ${childCount} layers
${childCount > 0 ? `- **Layer names:** ${childNames}${childCount > 8 ? ` … +${childCount - 8} more` : ""}` : ""}
- **Figma link:** https://www.figma.com/design/${fileKey}?node-id=${f.id.replace(":", "-")}${thumb}

`;
  });

  return md;
}

function buildAccessibilityGuide(
  components: ExtractedComponent[]
): string {
  let md = `## ♿ Accessibility & Semantics

### Component Documentation

Components with descriptions:

`;

  const docsComponents = components.filter((c) => c.description);
  if (docsComponents.length > 0) {
    docsComponents.slice(0, 10).forEach((comp) => {
      md += `- **${comp.name}:** ${comp.description}\n`;
    });
  } else {
    md += "_No component descriptions available._\n";
  }

  md += `

### Layer Naming Conventions

Semantic layer names found (state, size, semantic prefixes):

- **State layers** (hover, active, disabled states) → map to CSS pseudo-classes or component states
- **Size layers** (xs, sm, md, lg, xl) → responsive breakpoints
- **Semantic prefixes** (btn-, icon-, text-, bg-) → component type hints

`;

  return md;
}

function buildBuildInstructions(
  liveFrames: ExtractedFrame[],
  allFrames: ExtractedFrame[],
  colors: ExtractedColor[],
  fonts: Map<string, ExtractedFont>
): string {
  const stubCount = allFrames.length - liveFrames.length;
  const tokenCaveat =
    stubCount > 0
      ? `\n> ⚠️ **Partial token coverage** — ${stubCount} rasterized screens are PNG-backed and do not expose fills or text styles. Tokens below are derived from ${liveFrames.length} live screen(s) only. Full design-system tokens require the paid component library page.\n`
      : "";

  return `## 🏗️ AI Build Instructions
${tokenCaveat}
Use this specification to build the full application. Follow these rules:

### Tech Stack Recommendations
- **Framework:** React (with TypeScript preferred) or Next.js for multi-page apps
- **Styling:** Tailwind CSS — map the colour palette above to a custom \`tailwind.config\`
- **Icons:** Lucide React or Heroicons (match icon style from designs)
- **Animations:** Framer Motion for transitions between screens
- **State:** Zustand or React Context depending on complexity

### Colour Token Setup
\`\`\`js
// tailwind.config.js — extend with extracted palette
module.exports = {
  theme: {
    extend: {
      colors: {
${colors
  .slice(0, 10)
  .map((c, i) => `        "brand-${i + 1}": "${c.hex}", // used ${c.usages}× in design`)
  .join("\n")}
      }
    }
  }
}
\`\`\`

### Font Setup
\`\`\`css
/* Import detected font families */
${[...fonts.values()]
  .map(
    (f) =>
      `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}:wght@${[...f.weights].sort().join(";")}&display=swap');`
  )
  .join("\n")}
\`\`\`

### Screen Build Order (live screens only — rasterized screens require PNG assets)
${liveFrames.length === 0 ? "_No live screens detected — all screens are rasterized stubs._" : liveFrames
  .map(
    (f, i) =>
      `${i + 1}. **${f.name}** — ${f.node?.absoluteBoundingBox ? `${Math.round(f.node.absoluteBoundingBox.width)}×${Math.round(f.node.absoluteBoundingBox.height)}px, ` : ""}${f.node?.children?.length || 0} layers`
  )
  .join("\n")}

### Rasterized Screen Handling
${stubCount > 0 ? `${stubCount} screen(s) are rasterized PNG stubs. For each:\n- Export the frame as PNG via the Figma Images API (see Asset Export Checklist)\n- Display as a static \`<Image />\` in the app (e.g., onboarding flow background, illustration screens)\n- Do not attempt component reconstruction from these screens` : "_All screens are live._"}

### General Principles
- Pixel-perfect implementation: match dimensions exactly from the screen inventory above
- Use \`rem\` units for spacing, convert px values using 1rem = 16px base
- All screens should be responsive — mobile-first approach
- Implement proper loading states, error boundaries, and empty states
- Use the Figma links in each screen section to inspect exact properties
- Implement Light/Dark theme support: each screen group has a Light and Dark variant (toggle via \`prefers-color-scheme\` or app theme state)

`;
}

function buildAssetChecklist(frames: ExtractedFrame[], fileKey: string): string {
  return `## 📁 Asset Export Checklist

Use the Figma REST API to export assets before building:

\`\`\`bash
# Export all screen thumbnails (PNG @2x)
GET https://api.figma.com/v1/images/${fileKey}?ids=${frames
    .slice(0, 5)
    .map((f) => f.id)
    .join(",")}&format=png&scale=2
\`\`\`

For icons and SVG assets:
\`\`\`bash
GET https://api.figma.com/v1/images/${fileKey}?ids={ICON_NODE_IDS}&format=svg
\`\`\`

`;
}

// ============================================================================
// Wave 2: Responsiveness, Tokens, Diagnostics, Topology, Assets
// ============================================================================

function buildResponsiveness(frames: ExtractedFrame[]): string {
  const framesWithResponsiveness = frames.filter((f) => f.responsiveness);

  if (framesWithResponsiveness.length === 0) {
    return "## 📱 Responsiveness\n\n_No responsive designs detected in screens._\n\n";
  }

  let md = "## 📱 Responsive Design\n\n";
  md += `${framesWithResponsiveness.length} screens include responsive layout settings.\n\n`;

  const bySize = new Map<string, ExtractedFrame[]>();
  framesWithResponsiveness.forEach((f) => {
    const size = f.responsiveness!.sizeClass;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size)!.push(f);
  });

  md += "### Size Classes\n\n";
  md += "| Size Class | Count | Breakpoint |\n";
  md += "|-----------|-------|------------|\n";
  md += `| Mobile | ${bySize.get("mobile")?.length ?? 0} | < 600px |\n`;
  md += `| Tablet | ${bySize.get("tablet")?.length ?? 0} | 600px – 1200px |\n`;
  md += `| Desktop | ${bySize.get("desktop")?.length ?? 0} | > 1200px |\n\n`;

  md += "### Layout Modes\n\n";
  const autoLayoutCount = framesWithResponsiveness.filter((f) => f.responsiveness?.hasAutoLayout).length;
  const gridCount = framesWithResponsiveness.filter((f) => f.responsiveness?.hasLayoutGrids).length;

  md += `- **Auto Layout:** ${autoLayoutCount} screens\n`;
  md += `- **Layout Grids:** ${gridCount} screens\n\n`;

  return md;
}

function buildTokensAndVariables(variables: Map<string, DesignVariable>, tokenModes: TokenMode[]): string {
  if (variables.size === 0 && tokenModes.length === 0) {
    return "## 🎨 Design Tokens\n\n_No design variables or tokens detected._\n\n";
  }

  let md = "## 🎨 Design Tokens & Variables\n\n";

  if (tokenModes.length > 0) {
    md += "### Token Modes\n\n";
    md += "| Mode | Description |\n";
    md += "|------|-------------|\n";
    tokenModes.forEach((mode) => {
      md += `| **${mode.name}** | ${mode.description || "(no description)"} |\n`;
    });
    md += "\n";
  }

  if (variables.size > 0) {
    md += "### Variables\n\n";
    md += `Total: **${variables.size}** variables\n\n`;

    const byType = new Map<string, DesignVariable[]>();
    variables.forEach((v) => {
      if (!byType.has(v.resolvedType)) byType.set(v.resolvedType, []);
      byType.get(v.resolvedType)!.push(v);
    });

    byType.forEach((vars, type) => {
      md += `#### ${type} (${vars.length})\n\n`;
      vars.slice(0, 10).forEach((v) => {
        md += `- **${v.name}**: ${Object.entries(v.valuesByMode).map(([m, val]) => `${m}=${val}`).join(" | ")}\n`;
      });
      if (vars.length > 10) {
        md += `- ... and ${vars.length - 10} more\n`;
      }
      md += "\n";
    });
  }

  return md;
}

function buildDiagnostics(diagnostics: ExtractionDiagnostics, frames: ExtractedFrame[]): string {
  let md = "## 📊 Extraction Diagnostics\n\n";

  md += "### Coverage Summary\n\n";
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Nodes Visited | ${diagnostics.visitedNodes} |\n`;
  md += `| Pages Scanned | ${diagnostics.pagesScanned} |\n`;
  md += `| Screens Detected | ${diagnostics.screensDetected} |\n`;
  md += `| Live Screens | ${frames.filter((f) => !f.isRasterized).length} |\n`;
  md += `| Rasterized Stubs | ${diagnostics.rasterizedScreens} |\n`;
  md += `| Extraction Confidence | ${diagnostics.extractionConfidence}% |\n\n`;

  if (diagnostics.metadataFiltered > 0 || diagnostics.componentInstanceLabelFiltered > 0) {
    md += "### Filtered Items\n\n";
    if (diagnostics.metadataFiltered > 0) {
      md += `- **Metadata/Documentation:** ${diagnostics.metadataFiltered} frames\n`;
    }
    if (diagnostics.componentInstanceLabelFiltered > 0) {
      md += `- **Component Instance Labels:** ${diagnostics.componentInstanceLabelFiltered} frames\n`;
    }
    md += "\n";
  }

  if (Object.keys(diagnostics.skippedReasons).length > 0) {
    md += "### Skip Reasons\n\n";
    Object.entries(diagnostics.skippedReasons).forEach(([reason, count]) => {
      md += `- **${reason}:** ${count} nodes\n`;
    });
    md += "\n";
  }

  return md;
}

function buildPageTopology(pages: PageInfo[]): string {
  if (pages.length === 0) {
    return "## 🗺️ Page Structure\n\n_No page information available._\n\n";
  }

  let md = "## 🗺️ Page Structure & Navigation\n\n";
  md += "| Page | Screens | Components | Variables |\n";
  md += "|------|---------|------------|----------|\n";

  pages.forEach((page) => {
    md += `| ${page.name} | ${page.screenCount} | ${page.componentCount} | ${page.hasVariables ? "✓" : "—"} |\n`;
  });

  md += "\n";
  return md;
}

function buildAssetManifestSection(assets: Asset[]): string {
  if (assets.length === 0) {
    return "## 🎭 Asset Manifest\n\n_No assets extracted._\n\n";
  }

  let md = "## 🎭 Asset Manifest\n\n";
  md += `**Total Assets:** ${assets.length}\n\n`;

  // Group by type
  const byType = new Map<string, Asset[]>();
  assets.forEach((a) => {
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type)!.push(a);
  });

  md += "### Assets by Type\n\n";
  byType.forEach((assetList, type) => {
    md += `#### ${type} (${assetList.length})\n\n`;
    md += "| Asset | Dimensions | Colors | Formats |\n";
    md += "|-------|------------|--------|----------|\n";
    assetList.slice(0, 10).forEach((a) => {
      md += `| ${a.name} | ${a.dimensions.width}×${a.dimensions.height}px | ${a.fillColors?.length ?? 0} | ${a.exportFormats.join(", ")} |\n`;
    });
    if (assetList.length > 10) {
      md += `| ... | ... | ... | ... |\n`;
    }
    md += "\n";
  });

  return md;
}
