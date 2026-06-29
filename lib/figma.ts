import {
  FigmaNode,
  CollectionResults,
  ParsedScreenName,
  ExtractedConstraint,
  LayoutGridInfo,
  NodePath,
  ComponentInstance,
  Asset,
  ExtractionDiagnostics,
  PropertyOverride,
} from "./types";

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
  if (lower === "navigation marker") return true;
  return false;
}

/**
 * Geometry fallback for screen discovery when naming conventions are absent.
 * We keep this intentionally permissive to avoid silently dropping real screens.
 */
function isLikelyScreenByGeometry(node: FigmaNode): boolean {
  const bb = node.absoluteBoundingBox;
  if (!bb) return false;
  if (bb.width < 280 || bb.height < 500) return false;
  if ((node.children?.length || 0) === 0) return false;
  return true;
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
 * Fetch design variables AND token modes from Figma file in a single API call.
 * The Figma Variables REST API wraps everything under `meta`:
 *   GET /files/{key}/variables/local → { meta: { variables: {...}, variableCollections: {...} } }
 *
 * Returns null when the endpoint is unavailable (free plan or insufficient scopes).
 */
export async function fetchVariablesData(
  fileKey: string,
  token: string
): Promise<{ variables: Map<string, any>; tokenModes: any[] } | null> {
  try {
    const res = (await figmaFetch(`/files/${fileKey}/variables/local`, token)) as any;
    const meta = res?.meta ?? res; // some proxy wrappers drop the meta envelope

    // ── Variables ──────────────────────────────────────────────────────────
    const variables = new Map<string, any>();
    const rawVars = meta?.variables ?? {};
    Object.values(rawVars).forEach((v: any) => {
      // Resolve valuesByMode: values may be typed objects ({ type, value }) or primitives
      const resolvedValues: Record<string, string> = {};
      Object.entries(v.valuesByMode ?? {}).forEach(([modeId, val]: [string, any]) => {
        if (val && typeof val === "object" && "type" in val) {
          // Alias reference
          if (val.type === "VARIABLE_ALIAS") {
            resolvedValues[modeId] = `alias:${val.id}`;
          } else if (val.r !== undefined) {
            // COLOR value  { r, g, b, a }
            const hex = `#${[val.r, val.g, val.b]
              .map((x: number) => Math.round(x * 255).toString(16).padStart(2, "0"))
              .join("")}`;
            resolvedValues[modeId] = hex;
          } else {
            resolvedValues[modeId] = String(val.value ?? val);
          }
        } else {
          resolvedValues[modeId] = String(val);
        }
      });

      variables.set(v.id, {
        id: v.id,
        name: v.name,
        resolvedType: v.resolvedType,
        valuesByMode: resolvedValues,
        scopes: v.scopes ?? [],
        isAlias: v.isAlias ?? false,
        aliasOf: v.aliasOf?.id,
      });
    });

    // ── Token Modes (from variableCollections) ─────────────────────────────
    const tokenModes: any[] = [];
    const rawCollections = meta?.variableCollections ?? {};
    Object.values(rawCollections).forEach((col: any) => {
      (col.modes ?? []).forEach((mode: any) => {
        tokenModes.push({
          id: mode.modeId,
          name: mode.name,
          description: col.name, // collection name as context
          isDefault: mode.modeId === col.defaultModeId,
        });
      });
    });

    return { variables, tokenModes };
  } catch {
    // Free plan / missing scopes — not a hard failure
    return null;
  }
}

/**
 * @deprecated Use fetchVariablesData instead (single API call).
 * Kept for back-compat if called externally.
 */
export async function fetchDesignVariables(
  fileKey: string,
  token: string
): Promise<Map<string, any>> {
  const data = await fetchVariablesData(fileKey, token);
  return data?.variables ?? new Map();
}

/**
 * @deprecated Use fetchVariablesData instead (single API call).
 * Kept for back-compat if called externally.
 */
export async function fetchTokenModes(
  fileKey: string,
  token: string
): Promise<any[]> {
  const data = await fetchVariablesData(fileKey, token);
  return data?.tokenModes ?? [];
}

/**
 * Fetch named styles (text, color, effect styles) from Figma file
 */
export async function fetchNamedStyles(
  fileKey: string,
  token: string
): Promise<Record<string, any>> {
  const styles: Record<string, any> = {};
  try {
    const res = (await figmaFetch(`/files/${fileKey}/styles`, token)) as any;
    if (res.meta && res.meta.styles) {
      res.meta.styles.forEach((style: any) => {
        styles[style.key] = {
          id: style.id,
          name: style.name,
          styleType: style.style_type,
          description: style.description,
        };
      });
    }
  } catch {
    // Silently fail if styles API is not available
  }
  return styles;
}

/**
 * Recursively collect frames, components, colors, fonts, layout, effects, and interactions.
 *
 * Screen-discovery rules:
 *  - FRAME nodes are added to `results.frames` when they match either naming convention
 *    or geometry fallback.
 *  - Container flow-map frames have their TEXT descendants extracted to `results.flowMapLabels`.
 *  - Metadata / documentation frames are excluded from screen inventory but still traversed for tokens.
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
    diagnostics: {
      visitedNodes: 0,
      pagesScanned: 0,
      screensDetected: 0,
      screenLikeFrames: 0,
      metadataFiltered: 0,
      componentInstanceLabelFiltered: 0,
      rasterizedScreens: 0,
      constraintsExtracted: 0,
      variablesExtracted: 0,
      assetsIdentified: 0,
      extractionConfidence: 0,
      skippedReasons: {},
    },
    pages: [],
    variables: new Map(),
    tokenModes: [],
    assets: [],
    nodePaths: new Map(),
  }
): CollectionResults {
  if (!node) return results;

  results.diagnostics.visitedNodes++;

  // Track page scans at depth 0 and build page info
  if (depth === 0 && node.type === "CANVAS") {
    results.diagnostics.pagesScanned++;

    // Populate page info
    const screenCount = (node.children ?? []).filter(
      (child) =>
        child.type === "FRAME" &&
        !isComponentInstanceLabel(child.name) &&
        !isMetadataFrame(child) &&
        (SCREEN_NAME_REGEX.test(child.name) || isLikelyScreenByGeometry(child))
    ).length;

    const componentCount = (node.children ?? []).filter(
      (child) => child.type === "COMPONENT" || child.type === "COMPONENT_SET"
    ).length;

    results.pages.push({
      id: node.id,
      name: node.name,
      screenCount,
      componentCount,
      hasVariables: false,
      hasStyles: false,
    });
  }

  // Extract labels from large flow-map containers.
  if (depth === 1 && isContainerFlowMap(node)) {
    results.flowMapLabels.push(...extractTextLabels(node));
  }

  // Track filtered metadata frames
  if (node.type === "FRAME" && depth === 1 && isMetadataFrame(node)) {
    results.diagnostics.metadataFiltered++;
  }

  // Track filtered component instance labels
  if (node.type === "FRAME" && depth === 1 && isComponentInstanceLabel(node.name)) {
    results.diagnostics.componentInstanceLabelFiltered++;
  }

  // ── Screen identification ────────────────────────────────────────────────
  const isScreen =
    node.type === "FRAME" &&
    !isComponentInstanceLabel(node.name) &&
    !isMetadataFrame(node) &&
    (SCREEN_NAME_REGEX.test(node.name) || isLikelyScreenByGeometry(node));

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

    const constraints = extractConstraints(node);
    const layoutGrids = extractLayoutGrids(node);
    const componentInstances = extractComponentInstances(node);

    // Track extracted constraints
    if (constraints.length > 0) {
      results.diagnostics.constraintsExtracted += constraints.length;
    }

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
      constraints,
      layoutGrids,
      componentInstances,
      pageName: node.name,
      responsiveness: {
        hasAutoLayout: !!node.layoutMode,
        hasLayoutGrids: layoutGrids.length > 0,
        layoutGridCount: layoutGrids.length,
        childConstraintCount: constraints.length,
        sizeClass: detectSizeClass(node),
      },
    };

    results.frames.push(frame);
    results.diagnostics.screensDetected++;
    if (isLikelyScreenByGeometry(node)) {
      results.diagnostics.screenLikeFrames++;
    }

    // Track rasterized screens
    if (rasterized) {
      results.diagnostics.rasterizedScreens++;
    }

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
      constraints: extractConstraints(node),
      instances: extractComponentInstances(node),
    });
  }

  // Extract fill colors (solid and gradients)
  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach((f: any) => {
      // Extract from solid fills
      if (f.type === "SOLID" && f.color) {
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
      }
      // Extract from gradient stop colors
      else if (
        (f.type === "GRADIENT_LINEAR" ||
          f.type === "GRADIENT_RADIAL" ||
          f.type === "GRADIENT_ANGULAR" ||
          f.type === "GRADIENT_DIAMOND") &&
        f.gradientStops
      ) {
        f.gradientStops.forEach((stop: any) => {
          if (stop.color) {
            const { r, g, b, a = 1 } = stop.color;
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
          }
        });
      }
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

  // Wave 2: Extract assets and diagnostics
  const pageName = depth === 0 ? node.name : "Unknown Page";
  extractAssets(node, pageName, results.assets);
  if (results.assets.length > 0) {
    results.diagnostics.assetsIdentified = results.assets.length;
  }

  // Traverse children deeply enough to cover nested section/page structures.
  if (node.children && Array.isArray(node.children) && depth < 12) {
    node.children.forEach((child) =>
      collectAll(child, depth + 1, results)
    );
  }

  return results;
}

/**
 * Detect size class based on frame dimensions
 */
function detectSizeClass(node: FigmaNode): "mobile" | "tablet" | "desktop" {
  const bb = node.absoluteBoundingBox;
  if (!bb) return "mobile";

  if (bb.width < 600) return "mobile";
  if (bb.width < 1200) return "tablet";
  return "desktop";
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
 * Extract constraints for a frame and its children
 */
export function extractConstraints(node: FigmaNode): ExtractedConstraint[] {
  const constraints: ExtractedConstraint[] = [];

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child) => {
      const bb = child.absoluteBoundingBox;
      if (bb) {
        constraints.push({
          nodeId: child.id,
          nodeName: child.name,
          horizontal: (child as any).constraints?.horizontal || "FIXED",
          vertical: (child as any).constraints?.vertical || "FIXED",
          horizontalResizing: (child as any).horizontalResizing || "FIXED",
          verticalResizing: (child as any).verticalResizing || "FIXED",
        });
      }
    });
  }

  return constraints;
}

/**
 * Extract layout grids from a node
 */
export function extractLayoutGrids(node: FigmaNode): LayoutGridInfo[] {
  const grids: LayoutGridInfo[] = [];

  const gridProp = (node as any).layoutGrids;
  if (gridProp && Array.isArray(gridProp)) {
    gridProp.forEach((grid: any) => {
      grids.push({
        pattern: grid.pattern || "GRID",
        sectionSize: grid.sectionSize || 0,
        count: grid.count,
        gutterSize: grid.gutterSize,
        offset: grid.offset,
        visible: grid.visible !== false,
      });
    });
  }

  return grids;
}

/**
 * Build a node path for layer topology tracking
 */
export function buildNodePath(
  nodeId: string,
  nodeName: string,
  pageId: string,
  pageName: string,
  ancestryPath: string[],
  currentDepth: number
): NodePath {
  const fullPath = ancestryPath.length > 0 ? ancestryPath.join(".") + "." + nodeName : nodeName;

  return {
    nodeId,
    nodeName,
    path: ancestryPath,
    fullPath,
    pageId,
    pageName,
    depth: currentDepth,
  };
}

/**
 * Extract component instances with overrides
 */
export function extractComponentInstances(node: FigmaNode): ComponentInstance[] {
  const instances: ComponentInstance[] = [];

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child) => {
      // Detect component instances by presence of mainComponent ID
      // mainComponent can be a string ID or an object with .id property
      const mainComp = (child as any).mainComponent;
      const mainCompId = typeof mainComp === "string" ? mainComp : mainComp?.id;

      if (mainCompId) {
        const overrides: PropertyOverride[] = [];

        // Extract property overrides if available
        const componentProps = (child as any).componentProperties;
        if (componentProps) {
          Object.entries(componentProps).forEach(([propName, propValue]: [string, any]) => {
            overrides.push({
              nodeName: child.name,
              property: propName,
              value: propValue?.value ?? propValue,
              mainComponentProperty: propName,
            });
          });
        }

        instances.push({
          instanceId: child.id,
          instanceName: child.name,
          mainComponentId: mainCompId,
          mainComponentName: child.name, // Placeholder; would need API lookup
          overrides,
        });
      }

      // Recursively extract nested instances
      instances.push(...extractComponentInstances(child));
    });
  }

  return instances;
}

/**
 * Identify and extract asset nodes (icons, illustrations, backgrounds)
 */
export function extractAssets(node: FigmaNode, pageName: string, assets: Asset[]): void {
  if (!node) return;

  const bb = node.absoluteBoundingBox;

  // Heuristic for icon: small square/rectangular shape (< 100x100px), often standalone
  if (node.type === "COMPONENT" && bb && bb.width <= 100 && bb.height <= 100 && bb.width > 0) {
    const asset: Asset = {
      id: node.id,
      name: node.name,
      type: "ICON",
      nodeId: node.id,
      pageName,
      dimensions: { width: bb.width, height: bb.height },
      fillColors: extractAssetColors(node),
      usageCount: 1,
      exportFormats: ["SVG", "PNG"],
    };
    assets.push(asset);
  }

  // Heuristic for illustration/background: requires COMPONENT type OR explicit IMAGE fill
  if (bb && bb.width > 200) {
    const hasImageFill = (node.fills ?? []).some((f: any) => f.type === "IMAGE");
    const isComponent = node.type === "COMPONENT" || node.type === "COMPONENT_SET";
    const isScreen = node.type === "FRAME" && /^\d+_(Light|Dark)_/.test(node.name);

    if ((isComponent || hasImageFill) && !isScreen && (node.children?.length ?? 0) > 0) {
      const asset: Asset = {
        id: node.id,
        name: node.name,
        type: (node.children?.length ?? 0) > 5 ? "ILLUSTRATION" : "BACKGROUND",
        nodeId: node.id,
        pageName,
        dimensions: { width: bb.width, height: bb.height },
        fillColors: extractAssetColors(node),
        usageCount: 1,
        exportFormats: ["PNG", "SVG"],
      };
      assets.push(asset);
    }
  }

  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child) => extractAssets(child, pageName, assets));
  }
}

/**
 * Extract fill colors from an asset node
 */
function extractAssetColors(node: FigmaNode): string[] {
  const colors: string[] = [];

  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach((fill: any) => {
      if (fill.type === "SOLID" && fill.color) {
        const { r, g, b } = fill.color;
        const hex = `#${[r, g, b]
          .map((x) => Math.round(x * 255).toString(16).padStart(2, "0"))
          .join("")}`;
        if (!colors.includes(hex)) colors.push(hex);
      }
    });
  }

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child) => {
      const childColors = extractAssetColors(child);
      childColors.forEach((color) => {
        if (!colors.includes(color)) colors.push(color);
      });
    });
  }

  return colors;
}

/**
 * Initialize extraction diagnostics with zero counts
 */
export function initializeDiagnostics(): ExtractionDiagnostics {
  return {
    visitedNodes: 0,
    pagesScanned: 0,
    screensDetected: 0,
    screenLikeFrames: 0,
    metadataFiltered: 0,
    componentInstanceLabelFiltered: 0,
    rasterizedScreens: 0,
    constraintsExtracted: 0,
    variablesExtracted: 0,
    assetsIdentified: 0,
    extractionConfidence: 0,
    skippedReasons: {},
  };
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
  const match = input.match(/figma\.com\/(?:design|file|board|make|proto)\/([a-zA-Z0-9]+)/);
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
