import { FigmaNode, CollectionResults, ParsedScreenName } from "./types";

// ---------------------------------------------------------------------------
// Screen-discovery constants & helpers
// ---------------------------------------------------------------------------

/** Matches canvas-level screen names like "54_Light_create food - filled form" */
export const SCREEN_NAME_REGEX = /^\d+_(Light|Dark)_.+/;

/**
 * Substring blocklist for metadata / documentation frame names.
 * Applied case-insensitively. Does NOT include "container" because
 * Container flow-map frames are handled separately.
 */
export const METADATA_NAME_BLOCKLIST: readonly string[] = [
  "thumbnails",
  "quick start guide",
  "navigation marker",
  "notes",
  "navigation",
  "more products",
  "munirsr",
];

/**
 * Returns true when a frame name looks like a Figma component-property label
 * (e.g. "Dark=False, Component=Blur Background").
 * Such names are never valid screen names.
 */
export function isComponentInstanceLabel(name: string): boolean {
  return /(^|,\s*)\w[\w\s]*\s*=\s*[^,]+/.test(name);
}

/**
 * Returns true when a depth-1 canvas frame is documentation / metadata that
 * should not appear in the screen inventory or build order.
 */
export function isMetadataFrame(node: FigmaNode): boolean {
  const lower = node.name.toLowerCase();
  if (METADATA_NAME_BLOCKLIST.some((b) => lower.includes(b))) return true;
  const bb = node.absoluteBoundingBox;
  if (bb) {
    if (bb.width > 800 || bb.height > 1500) return true;
    if (bb.height === 152) return true;
  }
  return false;
}

/**
 * Returns true when a depth-1 node is one of the large Container flow-map
 * frames (name is exactly "Container" and dimensions are very large).
 */
export function isContainerFlowMap(node: FigmaNode): boolean {
  if (!/^container$/i.test(node.name.trim())) return false;
  const bb = node.absoluteBoundingBox;
  return !!(bb && (bb.width > 800 || bb.height > 1500));
}

/**
 * Returns true when a FRAME is a rasterized stub:
 * exactly one child RECTANGLE with the same name as the parent frame,
 * carrying an IMAGE fill.
 */
export function isRasterizedStub(node: FigmaNode): boolean {
  if (!node.children || node.children.length !== 1) return false;
  const child = node.children[0];
  if (child.type !== "RECTANGLE") return false;
  if (child.name !== node.name) return false;
  return (child.fills ?? []).some((f) => f.type === "IMAGE");
}

/**
 * Parses a screen name into its constituent parts.
 * Returns null when the name does not follow the `{num}_(Light|Dark)_{feature}` convention.
 */
export function parseScreenName(name: string): ParsedScreenName | null {
  const m = name.match(/^(\d+)_(Light|Dark)_(.+)$/);
  if (!m) return null;
  return { num: parseInt(m[1], 10), theme: m[2] as "Light" | "Dark", feature: m[3] };
}

/**
 * Recursively collects all TEXT node character strings from a subtree.
 * Used to extract navigation labels from Container flow-map frames.
 */
export function extractTextLabels(node: FigmaNode): string[] {
  const labels: string[] = [];
  function walk(n: FigmaNode): void {
    if (n.type === "TEXT") {
      const chars = (n as unknown as { characters?: string }).characters;
      if (chars?.trim()) labels.push(chars.trim());
    }
    n.children?.forEach(walk);
  }
  walk(node);
  return labels;
}

/**
 * Fetch data from Figma REST API
 */
export async function figmaFetch(
  path: string,
  token: string
): Promise<unknown> {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `Figma API error ${res.status}`
    );
  }

  return res.json();
}

/**
 * Recursively collect frames, components, colors, fonts, layout, effects, and interactions.
 *
 * Screen-discovery rules (applied at depth 1 — direct canvas children):
 *  - Only FRAME nodes whose name matches `SCREEN_NAME_REGEX` are added to `results.frames`.
 *  - Container flow-map frames have their TEXT descendants extracted to `results.flowMapLabels`.
 *  - Metadata / documentation frames are skipped entirely.
 *  - Rasterized stub screens are flagged; their children are not traversed for tokens.
 */
export function collectAll(
  node: FigmaNode | undefined,
  depth: number = 0,
  results: CollectionResults = {
    frames: [],
    components: [],
    colors: new Map(),
    fonts: new Map(),
    interactions: [],
    effects: new Map(),
    layerPatterns: new Map(),
    flowMapLabels: [],
    screenGroups: new Map(),
  }
): CollectionResults {
  if (!node) return results;

  // ── Depth-1 gate: apply canvas-level filtering ──────────────────────────
  if (depth === 1) {
    // Container flow-map frames: extract text labels and stop.
    if (isContainerFlowMap(node)) {
      results.flowMapLabels.push(...extractTextLabels(node));
      return results;
    }

    // Non-screen FRAME nodes (metadata, docs, etc.): skip entirely.
    if (
      node.type === "FRAME" &&
      (!SCREEN_NAME_REGEX.test(node.name) || isComponentInstanceLabel(node.name))
    ) {
      if (isMetadataFrame(node) || !SCREEN_NAME_REGEX.test(node.name)) {
        return results;
      }
    }
  }

  // ── Screen identification (depth-1 FRAMEs matching naming convention) ───
  const isScreen =
    node.type === "FRAME" &&
    depth === 1 &&
    SCREEN_NAME_REGEX.test(node.name) &&
    !isComponentInstanceLabel(node.name);

  if (isScreen) {
    const rasterized = isRasterizedStub(node);
    const parsed = parseScreenName(node.name);

    const layout = node.layoutMode
      ? {
          mode: node.layoutMode,
          primaryAxis: node.primaryAxisAlignItems || "MIN",
          counterAxis: node.counterAxisAlignItems || "MIN",
        }
      : undefined;

    const effects = extractEffects(node);

    const interactions = node.prototypeConnections || [];
    interactions.forEach((conn) => {
      if (conn.destinationID) {
        results.interactions.push({
          fromScreen: node.id,
          toScreen: conn.destinationID,
          trigger: conn.navigationType,
          transitionType: conn.transitionType || "DISSOLVE",
        });
      }
    });

    const frame = {
      id: node.id,
      name: node.name,
      type: node.type,
      node,
      layout,
      effects,
      interactions,
      isRasterized: rasterized,
      screenGroup: parsed ?? undefined,
    };

    results.frames.push(frame);

    // Maintain grouped screen-inventory map
    if (parsed) {
      const groupKey = `${parsed.num}_${parsed.feature}`;
      if (!results.screenGroups.has(groupKey)) {
        results.screenGroups.set(groupKey, {
          key: groupKey,
          num: parsed.num,
          feature: parsed.feature,
        });
      }
      const group = results.screenGroups.get(groupKey)!;
      if (parsed.theme === "Light") {
        group.light = frame;
      } else {
        group.dark = frame;
      }
    }

    // Rasterized stubs have no traversable component tree; skip children.
    if (rasterized) return results;
  }

  // Collect component definitions with variants
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    const variants = extractComponentVariants(node);
    const layoutInfo = node.layoutMode
      ? {
          mode: node.layoutMode,
          hasAutoLayout: !!node.layoutMode,
        }
      : undefined;

    results.components.push({
      id: node.id,
      name: node.name,
      description: node.description,
      node,
      variants,
      layoutInfo,
    });
  }

  // Extract solid fill colors
  if (node.fills && Array.isArray(node.fills)) {
    node.fills
      .filter((f): f is { type: "SOLID"; color: { r: number; g: number; b: number; a?: number } } =>
        f.type === "SOLID" && f.color !== undefined
      )
      .forEach((f) => {
        const { r, g, b, a = 1 } = f.color;
        const hex = `#${[r, g, b]
          .map((x) =>
            Math.round(x * 255)
              .toString(16)
              .padStart(2, "0")
          )
          .join("")}`;

        if (!results.colors.has(hex)) {
          results.colors.set(hex, {
            hex,
            alpha: Math.round(a * 100),
            usages: 0,
          });
        }

        const color = results.colors.get(hex);
        if (color) color.usages++;
      });
  }

  // Extract typography data
  if (node.style?.fontFamily) {
    const key = node.style.fontFamily;
    if (!results.fonts.has(key)) {
      results.fonts.set(key, {
        family: key,
        weights: new Set(),
        sizes: new Set(),
      });
    }

    const font = results.fonts.get(key);
    if (font) {
      if (node.style.fontWeight) font.weights.add(node.style.fontWeight);
      if (node.style.fontSize) font.sizes.add(node.style.fontSize);
    }
  }

  // Parse layer naming patterns
  parseLayerNaming(node.name, results);

  // Traverse children up to depth 4
  if (node.children && Array.isArray(node.children) && depth < 4) {
    node.children.forEach((child) =>
      collectAll(child, depth + 1, results)
    );
  }

  return results;
}

/**
 * Extract effects (shadows, blur) from a node
 */
function extractEffects(
  node: FigmaNode
): Array<{ type: string; visible: boolean; details: string }> {
  const effects: Array<{ type: string; visible: boolean; details: string }> = [];

  // Process raw effects array if available
  if (node.effects && Array.isArray(node.effects)) {
    node.effects.forEach((effect) => {
      const visible = effect.visible !== false;
      const type = (effect as any).type || "UNKNOWN";

      if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
        const shadow = effect as any;
        effects.push({
          type,
          visible,
          details: `offset(${shadow.offset?.x || 0},${shadow.offset?.y || 0}) blur:${shadow.blur || 0}px spread:${shadow.spread || 0}px`,
        });
      } else if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
        effects.push({
          type,
          visible,
          details: `radius:${(effect as any).radius || 0}px`,
        });
      }
    });
  }

  return effects;
}

/**
 * Extract component variants from a COMPONENT_SET
 */
function extractComponentVariants(
  node: FigmaNode
): Array<{ id: string; name: string; properties: Record<string, string | boolean>; description?: string }> {
  const variants = [];

  // If this is a COMPONENT_SET, its children are variants
  if (node.type === "COMPONENT_SET" && node.children) {
    node.children.forEach((child) => {
      if (child.type === "COMPONENT") {
        variants.push({
          id: child.id,
          name: child.name,
          properties: (child as any).componentProperties || {},
          description: child.description,
        });
      }
    });
  } else if (node.type === "COMPONENT") {
    // Single component - treat as single variant
    variants.push({
      id: node.id,
      name: node.name,
      properties: (node as any).componentProperties || {},
      description: node.description,
    });
  }

  return variants;
}

/**
 * Parse layer naming patterns (e.g., btn-primary-hover, icon-star, bg-surface)
 */
function parseLayerNaming(name: string, results: CollectionResults): void {
  // State suffixes: -hover, -active, -disabled, -pressed, -focus
  const stateSuffixes = /-(hover|active|disabled|pressed|focus)$/i;
  const sizePatterns = /-(xs|sm|md|lg|xl|2xl)$/i;
  const semanticPrefix = /^(btn|icon|text|bg|container|wrapper|input|label|badge)-/i;

  if (stateSuffixes.test(name)) {
    const match = name.match(stateSuffixes);
    if (match) {
      const key = `state:${match[1].toLowerCase()}`;
      if (!results.layerPatterns.has(key)) {
        results.layerPatterns.set(key, {
          pattern: key,
          type: "state",
          examples: [],
        });
      }
      const pattern = results.layerPatterns.get(key);
      if (pattern && pattern.examples.length < 5) {
        pattern.examples.push(name);
      }
    }
  }

  if (sizePatterns.test(name)) {
    const match = name.match(sizePatterns);
    if (match) {
      const key = `size:${match[1].toLowerCase()}`;
      if (!results.layerPatterns.has(key)) {
        results.layerPatterns.set(key, {
          pattern: key,
          type: "size",
          examples: [],
        });
      }
      const pattern = results.layerPatterns.get(key);
      if (pattern && pattern.examples.length < 5) {
        pattern.examples.push(name);
      }
    }
  }

  if (semanticPrefix.test(name)) {
    const match = name.match(semanticPrefix);
    if (match) {
      const key = `semantic:${match[1].toLowerCase()}`;
      if (!results.layerPatterns.has(key)) {
        results.layerPatterns.set(key, {
          pattern: key,
          type: "semantic",
          examples: [],
        });
      }
      const pattern = results.layerPatterns.get(key);
      if (pattern && pattern.examples.length < 5) {
        pattern.examples.push(name);
      }
    }
  }
}

/**
 * Convert hex color to rgb() string
 */
export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Extract file key from Figma URL or return as-is if already a key
 */
export function extractFileKey(input: string): string {
  const match = input.match(/figma\.com\/(?:design|file|board|make)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : input.trim();
}

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
}
