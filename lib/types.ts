// ============================================================================
// Types for Figma API responses and internal data structures
// ============================================================================

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface FigmaPaint {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND" | "IMAGE" | "EMOJI";
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit?: "PIXELS" | "PERCENT";
}

export interface FigmaShadow {
  type: "DROP_SHADOW" | "INNER_SHADOW";
  color: FigmaColor;
  offset: FigmaVector;
  blur: number;
  spread?: number;
  visible?: boolean;
}

export interface FigmaBlur {
  type: "LAYER_BLUR" | "BACKGROUND_BLUR";
  radius: number;
  visible?: boolean;
}

export interface FigmaEffect {
  type: string;
  visible?: boolean;
  [key: string]: unknown;
}

export interface FigmaLayoutGrid {
  pattern: "COLUMNS" | "ROWS" | "GRID";
  sectionSize: number;
  visible: boolean;
  color?: FigmaColor;
  offset?: number;
  count?: number;
  gutterSize?: number;
}

export interface FigmaConstraint {
  horizontal?: string;
  vertical?: string;
}

export interface FigmaPrototypeConnection {
  nodeID: string;
  navigationType: "NAVIGATE" | "SWAP" | "OVERLAY" | "BACK" | "CLOSE";
  transitionType: "DISSOLVE" | "SMART_ANIMATE" | "SCROLL_ANIMATE";
  transitionDuration?: number;
  destinationID?: string;
  displayType?: "INHERIT" | "CENTER" | "TOP_LEFT" | "TOP_CENTER" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_CENTER" | "BOTTOM_RIGHT";
  preserveScrollPosition?: boolean;
}

export interface LayerNamePattern {
  pattern: string;
  type: "state" | "semantic" | "size";
  examples: string[];
}

export interface FigmaVector {
  x: number;
  y: number;
}

export interface FigmaSize {
  width: number;
  height: number;
}

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: FigmaBoundingBox;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  style?: FigmaStyle;
  effects?: FigmaEffect[];
  shadow?: FigmaShadow[];
  blurRadius?: number;
  strokeAlign?: "INSIDE" | "CENTER" | "OUTSIDE";
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  layoutGrow?: number;
  prototypeStartNodeID?: string;
  prototypeConnections?: FigmaPrototypeConnection[];
  mainComponent?: string;
  componentProperties?: Record<string, { type: string; value: string | boolean }>;
  description?: string;
  documentation?: string;
  [key: string]: unknown;
}

export interface FigmaPage extends FigmaNode {
  type: "CANVAS";
}

export interface FigmaDocument {
  id: string;
  name: string;
  type: "DOCUMENT";
  children: FigmaPage[];
}

export interface FigmaFileResponse {
  name: string;
  version: string;
  lastModified?: string;
  document: FigmaDocument;
  components?: Record<string, { name: string }>;
  styles?: Record<string, { name: string; styleType?: string; description?: string }>;
}

export interface ExtractedStyleToken {
  id: string;
  name: string;
  styleType: string;
  description?: string;
}

export interface ExtractedVariableToken {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, string>;
  scopes?: string[];
}

// ============================================================================
// Wave 2 Enhancements: Responsiveness, Tokens, Topology, Diagnostics, Assets
// ============================================================================

export interface ExtractedConstraint {
  nodeId: string;
  nodeName: string;
  horizontal: string;
  vertical: string;
  horizontalResizing: "FIXED" | "HUG" | "FILL";
  verticalResizing: "FIXED" | "HUG" | "FILL";
}

export interface LayoutGridInfo {
  pattern: "COLUMNS" | "ROWS" | "GRID";
  sectionSize: number;
  count?: number;
  gutterSize?: number;
  offset?: number;
  visible: boolean;
}

export interface ResponsiveBreakpoint {
  label: string;
  minWidth?: number;
  maxWidth?: number;
  sizeClass: "mobile" | "tablet" | "desktop";
}

export interface TokenMode {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

export interface DesignVariable {
  id: string;
  name: string;
  resolvedType: string;
  description?: string;
  valuesByMode: Record<string, string>;
  scopes: string[];
  isAlias?: boolean;
  aliasOf?: string;
}

export interface PropertyOverride {
  nodeName: string;
  property: string;
  value: string | number | boolean;
  mainComponentProperty?: string;
}

export interface ComponentInstance {
  instanceId: string;
  instanceName: string;
  mainComponentId: string;
  mainComponentName: string;
  overrides: PropertyOverride[];
}

export interface NodePath {
  nodeId: string;
  nodeName: string;
  path: string[]; // Ancestry path: ["Page", "Section", "Component"]
  fullPath: string; // Dot-separated path string for location tracking
  pageId: string;
  pageName: string;
  depth: number;
}

export interface PageInfo {
  id: string;
  name: string;
  screenCount: number;
  componentCount: number;
  hasVariables: boolean;
  hasStyles: boolean;
}

export interface Asset {
  id: string;
  name: string;
  type: "ICON" | "ILLUSTRATION" | "BACKGROUND" | "PATTERN" | "IMAGE" | "LOGO";
  nodeId: string;
  pageName: string;
  dimensions: { width: number; height: number };
  fillColors?: string[];
  usageCount: number;
  exportFormats: ("PNG" | "SVG" | "PDF" | "JPEG")[];
}

export interface AssetManifest {
  totalAssets: number;
  assetsByType: Record<string, Asset[]>;
  assetsByUsage: Record<string, Asset[]>;
  deterministic: boolean; // true if list is stable across runs
}

export interface ExtractionDiagnostics {
  visitedNodes: number;
  pagesScanned: number;
  screensDetected: number;
  screenLikeFrames: number;
  metadataFiltered: number;
  componentInstanceLabelFiltered: number;
  rasterizedScreens: number;
  constraintsExtracted: number;
  variablesExtracted: number;
  assetsIdentified: number;
  extractionConfidence: number; // 0-100 score
  skippedReasons: Record<string, number>; // Reason -> count map
}

export interface ExtractedColor {
  hex: string;
  alpha: number;
  usages: number;
}

export interface ExtractedFont {
  family: string;
  weights: Set<number>;
  sizes: Set<number>;
}

/** Parsed parts of a screen name following the `{num}_(Light|Dark)_{feature}` convention */
export interface ParsedScreenName {
  num: number;
  theme: "Light" | "Dark";
  feature: string;
}

export interface ExtractedFrame {
  id: string;
  name: string;
  type: string;
  node: FigmaNode;
  layout?: {
    mode: string;
    primaryAxis: string;
    counterAxis: string;
  };
  effects?: Array<{
    type: string;
    visible: boolean;
    details: string;
  }>;
  interactions?: FigmaPrototypeConnection[];
  /** True when the screen is a rasterized PNG stub (single Rectangle child with IMAGE fill) */
  isRasterized?: boolean;
  /** Parsed screen-name components, present when name matches `^\d+_(Light|Dark)_.+` */
  screenGroup?: ParsedScreenName;
  responsiveness?: {
    hasAutoLayout: boolean;
    hasLayoutGrids: boolean;
    layoutGridCount: number;
    childConstraintCount: number;
    wrapMode?: string;
    sizeClass: "mobile" | "tablet" | "desktop";
  };
  constraints?: ExtractedConstraint[];
  layoutGrids?: LayoutGridInfo[];
  variables?: DesignVariable[];
  componentInstances?: ComponentInstance[];
  nodePath?: NodePath;
  pageName?: string;
  breakpoints?: ResponsiveBreakpoint[];
}

/**
 * Groups Light and Dark variants of a single numbered screen.
 * Key format: `{num}_{feature}` (e.g. "54_create food - filled form")
 */
export interface ScreenGroup {
  key: string;
  num: number;
  feature: string;
  light?: ExtractedFrame;
  dark?: ExtractedFrame;
}

export interface ComponentVariant {
  id: string;
  name: string;
  properties: Record<string, string | boolean>;
  description?: string;
}

export interface ExtractedComponent {
  id: string;
  name: string;
  description?: string;
  node: FigmaNode;
  variants: ComponentVariant[];
  layoutInfo?: {
    mode: string;
    hasAutoLayout: boolean;
  };
  instances?: ComponentInstance[];
  constraints?: ExtractedConstraint[];
  variables?: DesignVariable[];
  pageName?: string;
}

export interface FlowConnection {
  fromScreen: string;
  toScreen: string;
  trigger: string;
  transitionType: string;
}

export interface CollectionResults {
  frames: ExtractedFrame[];
  components: ExtractedComponent[];
  colors: Map<string, ExtractedColor>;
  fonts: Map<string, ExtractedFont>;
  interactions: FlowConnection[];
  effects: Map<string, { type: string; count: number }>;
  layerPatterns: Map<string, LayerNamePattern>;
  /** Text labels extracted from Container flow-map frames */
  flowMapLabels: string[];
  /** Grouped screen inventory keyed by `{num}_{feature}` */
  screenGroups: Map<string, ScreenGroup>;
  diagnostics: ExtractionDiagnostics;
  /** Wave 2: Page-level information */
  pages: PageInfo[];
  /** Wave 2: Design variables and tokens */
  variables: Map<string, DesignVariable>;
  tokenModes: TokenMode[];
  /** Wave 2: Asset inventory */
  assets: Asset[];
  /** Wave 2: Node paths for layer topology */
  nodePaths: Map<string, NodePath>;
}

export interface ExtractionResult {
  fileData: FigmaFileResponse;
  frames: ExtractedFrame[];
  thumbnails: Record<string, string>;
  colors: Map<string, ExtractedColor>;
  fonts: Map<string, ExtractedFont>;
  components: ExtractedComponent[];
  interactions: FlowConnection[];
  effects: Map<string, { type: string; count: number }>;
  styleTokens: ExtractedStyleToken[];
  variableTokens: ExtractedVariableToken[];
  diagnostics: ExtractionDiagnostics;
  /** Wave 2: Variables and token modes */
  variables: Map<string, DesignVariable>;
  tokenModes: TokenMode[];
  /** Wave 2: Pages */
  pages: PageInfo[];
  /** Wave 2: Assets */
  assets: Asset[];
  /** Wave 2: Node paths */
  nodePaths: Map<string, NodePath>;
}

export type TemplateType = "minimal" | "full" | "accessibility";

export interface MarkdownTemplate {
  type: TemplateType;
  name: string;
  description: string;
  sections: ("overview" | "colors" | "typography" | "components" | "instances" | "interactions" | "layout" | "effects" | "accessibility" | "screens" | "instructions" | "assets" | "flowmap" | "tokens" | "diagnostics")[];
}

export type UIPhase = "idle" | "loading" | "done" | "error";
export type TabType = "preview" | "raw";
