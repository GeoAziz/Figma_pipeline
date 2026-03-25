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
  styles?: Record<string, { name: string }>;
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
}

export type TemplateType = "minimal" | "full" | "accessibility";

export interface MarkdownTemplate {
  type: TemplateType;
  name: string;
  description: string;
  sections: ("overview" | "colors" | "typography" | "components" | "interactions" | "layout" | "effects" | "accessibility" | "screens" | "instructions" | "assets")[];
}

export type UIPhase = "idle" | "loading" | "done" | "error";
export type TabType = "preview" | "raw";
