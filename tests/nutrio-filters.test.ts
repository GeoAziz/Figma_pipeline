/**
 * Fixture-based tests for Nutrio extractor filtering/grouping logic.
 *
 * These tests exercise the pure helper functions in lib/figma.ts using
 * representative JSON snippets modelled on the Nutrio Figma file structure.
 */

import {
  SCREEN_NAME_REGEX,
  isComponentInstanceLabel,
  isMetadataFrame,
  isContainerFlowMap,
  isRasterizedStub,
  parseScreenName,
  extractTextLabels,
  collectAll,
} from "../lib/figma";
import type { FigmaNode, CollectionResults } from "../lib/types";

// ---------------------------------------------------------------------------
// Helpers to build minimal FigmaNode fixtures
// ---------------------------------------------------------------------------

function makeFrame(
  overrides: Partial<FigmaNode> & { id: string; name: string }
): FigmaNode {
  return {
    type: "FRAME",
    children: [],
    fills: [],
    ...overrides,
  };
}

function makeRectangle(
  overrides: Partial<FigmaNode> & { id: string; name: string }
): FigmaNode {
  return {
    type: "RECTANGLE",
    fills: [],
    ...overrides,
  };
}

function makeText(id: string, characters: string): FigmaNode {
  return { type: "TEXT", id, name: characters, characters } as unknown as FigmaNode;
}

function emptyResults(): CollectionResults {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// 1. SCREEN_NAME_REGEX
// ---------------------------------------------------------------------------

describe("SCREEN_NAME_REGEX", () => {
  it("matches valid screen names", () => {
    expect(SCREEN_NAME_REGEX.test("54_Light_create food - filled form")).toBe(true);
    expect(SCREEN_NAME_REGEX.test("1_Dark_splash screen")).toBe(true);
    expect(SCREEN_NAME_REGEX.test("132_Light_logout")).toBe(true);
    expect(SCREEN_NAME_REGEX.test("95_Dark_weight tracker - history - more options")).toBe(true);
  });

  it("rejects non-screen names", () => {
    expect(SCREEN_NAME_REGEX.test("Thumbnails")).toBe(false);
    expect(SCREEN_NAME_REGEX.test("Container")).toBe(false);
    expect(SCREEN_NAME_REGEX.test("Quick Start Guide")).toBe(false);
    expect(SCREEN_NAME_REGEX.test("Navigation Marker")).toBe(false);
    expect(SCREEN_NAME_REGEX.test("Navbar")).toBe(false);
    expect(SCREEN_NAME_REGEX.test("Dark=False, Component=Blur Background")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. isComponentInstanceLabel
// ---------------------------------------------------------------------------

describe("isComponentInstanceLabel", () => {
  it("detects Figma component-property labels", () => {
    expect(isComponentInstanceLabel("Dark=False, Component=Blur Background")).toBe(true);
    expect(isComponentInstanceLabel("Navbar=Default")).toBe(true);
    expect(isComponentInstanceLabel("Size=Large, State=Hover")).toBe(true);
  });

  it("does not flag normal screen names", () => {
    expect(isComponentInstanceLabel("54_Light_create food - filled form")).toBe(false);
    expect(isComponentInstanceLabel("Thumbnails")).toBe(false);
    expect(isComponentInstanceLabel("Container")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. isMetadataFrame
// ---------------------------------------------------------------------------

describe("isMetadataFrame", () => {
  it("flags frames on the blocklist", () => {
    expect(isMetadataFrame(makeFrame({ id: "1", name: "Thumbnails", absoluteBoundingBox: { x: 0, y: 0, width: 1600, height: 960 } }))).toBe(true);
    expect(isMetadataFrame(makeFrame({ id: "2", name: "Quick Start Guide" }))).toBe(true);
    expect(isMetadataFrame(makeFrame({ id: "3", name: "Notes", absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1100 } }))).toBe(true);
    expect(isMetadataFrame(makeFrame({ id: "4", name: "More Products MunirSr" }))).toBe(true);
    expect(isMetadataFrame(makeFrame({ id: "5", name: "Navigation" }))).toBe(true);
  });

  it("does not flag unknown large frames by dimensions alone", () => {
    expect(isMetadataFrame(makeFrame({ id: "6", name: "Some Doc", absoluteBoundingBox: { x: 0, y: 0, width: 2200, height: 5738 } }))).toBe(false);
  });

  it("flags Navigation Marker by explicit name", () => {
    expect(isMetadataFrame(makeFrame({ id: "7", name: "Navigation Marker", absoluteBoundingBox: { x: 0, y: 0, width: 430, height: 152 } }))).toBe(true);
  });

  it("does not flag normal 430×932 screens", () => {
    const screen = makeFrame({
      id: "8",
      name: "54_Light_create food",
      absoluteBoundingBox: { x: 0, y: 0, width: 430, height: 932 },
    });
    expect(isMetadataFrame(screen)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. isContainerFlowMap
// ---------------------------------------------------------------------------

describe("isContainerFlowMap", () => {
  it("identifies large Container frames", () => {
    const container = makeFrame({
      id: "c1",
      name: "Container",
      absoluteBoundingBox: { x: 0, y: 0, width: 11303, height: 36878 },
    });
    expect(isContainerFlowMap(container)).toBe(true);
  });

  it("does not flag small frames named Container", () => {
    const small = makeFrame({
      id: "c2",
      name: "Container",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 600 },
    });
    expect(isContainerFlowMap(small)).toBe(false);
  });

  it("does not flag non-Container large frames", () => {
    const other = makeFrame({
      id: "c3",
      name: "Quick Start Guide",
      absoluteBoundingBox: { x: 0, y: 0, width: 11303, height: 36878 },
    });
    expect(isContainerFlowMap(other)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. isRasterizedStub
// ---------------------------------------------------------------------------

describe("isRasterizedStub", () => {
  it("detects a rasterized stub correctly", () => {
    const child = makeRectangle({
      id: "child1",
      name: "1_Light_splash screen",
      fills: [{ type: "IMAGE" }],
    });
    const frame = makeFrame({
      id: "frame1",
      name: "1_Light_splash screen",
      children: [child],
    });
    expect(isRasterizedStub(frame)).toBe(true);
  });

  it("returns false when child name does not match parent", () => {
    const child = makeRectangle({
      id: "child2",
      name: "different name",
      fills: [{ type: "IMAGE" }],
    });
    const frame = makeFrame({ id: "frame2", name: "1_Light_splash screen", children: [child] });
    expect(isRasterizedStub(frame)).toBe(false);
  });

  it("returns false when there are multiple children", () => {
    const childA = makeRectangle({ id: "ca", name: "screen", fills: [{ type: "IMAGE" }] });
    const childB = makeRectangle({ id: "cb", name: "screen", fills: [{ type: "IMAGE" }] });
    const frame = makeFrame({ id: "frame3", name: "screen", children: [childA, childB] });
    expect(isRasterizedStub(frame)).toBe(false);
  });

  it("returns false when the child has no IMAGE fill", () => {
    const child = makeRectangle({
      id: "child4",
      name: "1_Light_splash screen",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    });
    const frame = makeFrame({ id: "frame4", name: "1_Light_splash screen", children: [child] });
    expect(isRasterizedStub(frame)).toBe(false);
  });

  it("returns false when child is not a RECTANGLE", () => {
    const child: FigmaNode = {
      id: "child5",
      name: "1_Light_splash screen",
      type: "FRAME",
      fills: [{ type: "IMAGE" }],
    };
    const frame = makeFrame({ id: "frame5", name: "1_Light_splash screen", children: [child] });
    expect(isRasterizedStub(frame)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. parseScreenName
// ---------------------------------------------------------------------------

describe("parseScreenName", () => {
  it("parses valid screen names", () => {
    expect(parseScreenName("54_Light_create food - filled form")).toEqual({
      num: 54,
      theme: "Light",
      feature: "create food - filled form",
    });
    expect(parseScreenName("132_Dark_logout")).toEqual({ num: 132, theme: "Dark", feature: "logout" });
    expect(parseScreenName("1_Light_splash screen")).toEqual({ num: 1, theme: "Light", feature: "splash screen" });
  });

  it("returns null for non-matching names", () => {
    expect(parseScreenName("Thumbnails")).toBeNull();
    expect(parseScreenName("Container")).toBeNull();
    expect(parseScreenName("Navbar")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. extractTextLabels
// ---------------------------------------------------------------------------

describe("extractTextLabels", () => {
  it("extracts text from nested TEXT nodes", () => {
    const tree: FigmaNode = {
      id: "root",
      name: "Container",
      type: "FRAME",
      children: [
        { id: "g1", name: "Group", type: "GROUP", children: [
          makeText("t1", "Sign In"),
          makeText("t2", "Sign Up"),
        ] },
        makeText("t3", "Forgot Password"),
      ],
    };
    expect(extractTextLabels(tree)).toEqual(["Sign In", "Sign Up", "Forgot Password"]);
  });

  it("returns empty array when no TEXT nodes", () => {
    const frame = makeFrame({ id: "f1", name: "Empty" });
    expect(extractTextLabels(frame)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. collectAll — integration tests
// ---------------------------------------------------------------------------

describe("collectAll", () => {
  /** Build a minimal page-level canvas child representing a rasterized screen */
  function rasterizedScreenNode(id: string, name: string): FigmaNode {
    const child = makeRectangle({ id: `${id}-img`, name, fills: [{ type: "IMAGE" }] });
    return makeFrame({
      id,
      name,
      absoluteBoundingBox: { x: 0, y: 0, width: 430, height: 932 },
      children: [child],
    });
  }

  /** Build a minimal live screen node */
  function liveScreenNode(id: string, name: string): FigmaNode {
    return makeFrame({
      id,
      name,
      absoluteBoundingBox: { x: 0, y: 0, width: 430, height: 932 },
      children: [
        { id: `${id}-navbar`, name: "Navbar", type: "FRAME", fills: [] },
      ],
    });
  }

  it("collects screens matching SCREEN_NAME_REGEX at depth 1 only", () => {
    const results = emptyResults();
    collectAll(rasterizedScreenNode("s1", "1_Light_splash screen"), 1, results);
    collectAll(rasterizedScreenNode("s2", "1_Dark_splash screen"), 1, results);
    expect(results.frames).toHaveLength(2);
    expect(results.frames[0].name).toBe("1_Light_splash screen");
  });

  it("skips sub-frames (depth > 1) from being treated as screens", () => {
    const results = emptyResults();
    // Live screen with sub-frames
    const live = liveScreenNode("live1", "66_Light_activity log history");
    collectAll(live, 1, results);
    // Only the top-level screen should be in frames — not its Navbar child
    expect(results.frames).toHaveLength(1);
    expect(results.frames[0].name).toBe("66_Light_activity log history");
  });

  it("marks rasterized stubs correctly", () => {
    const results = emptyResults();
    collectAll(rasterizedScreenNode("s3", "2_Light_home"), 1, results);
    collectAll(liveScreenNode("s4", "66_Light_activity log history"), 1, results);
    const stub = results.frames.find((f) => f.id === "s3")!;
    const live = results.frames.find((f) => f.id === "s4")!;
    expect(stub.isRasterized).toBe(true);
    expect(live.isRasterized).toBe(false);
  });

  it("skips metadata frames entirely", () => {
    const results = emptyResults();
    const thumbnails = makeFrame({
      id: "meta1",
      name: "Thumbnails",
      absoluteBoundingBox: { x: 0, y: 0, width: 1600, height: 960 },
    });
    collectAll(thumbnails, 1, results);
    expect(results.frames).toHaveLength(0);
  });

  it("skips component-instance-label frames", () => {
    const results = emptyResults();
    const instanceLabel = makeFrame({
      id: "ci1",
      name: "Dark=False, Component=Blur Background",
      absoluteBoundingBox: { x: 0, y: 0, width: 430, height: 932 },
    });
    collectAll(instanceLabel, 1, results);
    expect(results.frames).toHaveLength(0);
  });

  it("extracts text labels from Container flow-map frames", () => {
    const results = emptyResults();
    const container: FigmaNode = makeFrame({
      id: "cnt1",
      name: "Container",
      absoluteBoundingBox: { x: 0, y: 0, width: 11303, height: 36878 },
      children: [makeText("t1", "Home"), makeText("t2", "Sign In")],
    });
    collectAll(container, 1, results);
    expect(results.flowMapLabels).toContain("Home");
    expect(results.flowMapLabels).toContain("Sign In");
    // Container itself should NOT appear in frames
    expect(results.frames).toHaveLength(0);
  });

  it("groups Light and Dark variants correctly", () => {
    const results = emptyResults();
    collectAll(rasterizedScreenNode("l1", "54_Light_create food - filled form"), 1, results);
    collectAll(rasterizedScreenNode("d1", "54_Dark_create food - filled form"), 1, results);

    const group = results.screenGroups.get("54_create food - filled form");
    expect(group).toBeDefined();
    expect(group!.light?.id).toBe("l1");
    expect(group!.dark?.id).toBe("d1");
    expect(group!.num).toBe(54);
    expect(group!.feature).toBe("create food - filled form");
  });

  it("produces 264 frames and 132 groups for a representative 132-screen sample", () => {
    const results = emptyResults();
    for (let i = 1; i <= 132; i++) {
      collectAll(rasterizedScreenNode(`l${i}`, `${i}_Light_screen ${i}`), 1, results);
      collectAll(rasterizedScreenNode(`d${i}`, `${i}_Dark_screen ${i}`), 1, results);
    }
    expect(results.frames).toHaveLength(264);
    expect(results.screenGroups.size).toBe(132);
  });
});
