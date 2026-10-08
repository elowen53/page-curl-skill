/** The supplied Three.js namespace; pin revision 162 unless shader checks are rerun. */
export type ThreeNamespace = Record<string, any>;
export interface ContentPage {
  type: 'image' | 'html' | 'markdown' | 'svg' | 'pdf' | 'blank';
  /** URL at runtime; local file path in the standalone generator. */
  src?: string;
  /** Inline HTML, Markdown or SVG. Use src or content, never both. */
  content?: string;
  /** HTML/Markdown page CSS, isolated from the host application. */
  css?: string;
  /** Resolve relative resources for inline HTML/Markdown; inferred for fetched sources. */
  baseURL?: string;
  /** PDF's one-based page number, or selected numbers in requested order. */
  page?: number;
  pages?: number[];
  /** Logical page size; defaults to 800 x 1102, the curl's fixed aspect ratio. */
  width?: number;
  height?: number;
  /** Pixel density, defaults to min(devicePixelRatio, 2); maximum 4 and 4096px. */
  scale?: number;
  background?: string;
  fit?: 'contain' | 'cover';
}
export type PageSource = string | ContentPage;
export interface PageCurlConfig {
  title?: string;
  mode?: 'auto' | 'desktop' | 'mobile';
  /** Ordered sources. mountPageCurl expands documents and pads an odd count with blank paper. */
  pages?: PageSource[];
  /** Zero-based artwork index, including the desktop closed-book index. */
  startPage?: number;
  /** Zero-based spread; startPage takes precedence. */
  startSheet?: number;
}
export interface Environment {
  document?: Document;
  fetch?: typeof fetch;
  createCanvas?: () => HTMLCanvasElement;
  performance?: Pick<Performance, 'now'>;
  devicePixelRatio?: number;
  ResizeObserver?: typeof ResizeObserver;
  AbortController?: typeof AbortController;
  matchMedia?: (query: string) => MediaQueryList;
}
export interface PageCurlHandle {
  /** Artwork index: desktop spread*2, mobile visible leaf. */
  page(): number;
  next(): void;
  previous(): void;
  /** Synchronous, idempotent release; aborts listeners and pending loading. */
  dispose(): void;
}
export interface MountOptions {
  THREE: ThreeNamespace;
  stage: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  status: HTMLElement;
  config?: PageCurlConfig;
  environment?: Environment;
  /** Cancel even before the returned promise resolves. */
  signal?: AbortSignal;
  /** Optional testing diagnostic. Its internal shape is not a stable application API. */
  debug?: (internals: any) => void;
}
export interface ResponsiveHandle extends PageCurlHandle {
  mode(): 'desktop' | 'mobile' | null;
  /** Wait for queued responsive mounts; not a paper-turn completion signal. */
  ready(): Promise<void>;
}
export interface ResponsiveOptions extends MountOptions, PageCurlConfig {
  onError?: (error: Error) => void;
  factories?: {desktop(options: MountOptions): Promise<PageCurlHandle>; mobile(options: MountOptions): Promise<PageCurlHandle>};
}
