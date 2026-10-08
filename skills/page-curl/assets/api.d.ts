/** The supplied Three.js namespace; pin revision 162 unless shader checks are rerun. */
export type ThreeNamespace = Record<string, any>;
export interface PageCurlConfig {
  title?: string;
  mode?: 'auto' | 'desktop' | 'mobile';
  /** Even-length image URL list; paired faces on desktop, separate fronts on mobile. */
  pages?: string[];
  /** Zero-based artwork index, including the desktop closed-book index. */
  startPage?: number;
  /** Zero-based spread; startPage takes precedence. */
  startSheet?: number;
}
export interface Environment {
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
