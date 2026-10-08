import type {PageSource, ContentPage, Environment} from './api.js';
export function validatePage(page: PageSource): void;
export function preparePages(pages: PageSource[], options?: {environment?: Environment; signal?: AbortSignal}): Promise<PageSource[]>;
export interface ContentRenderContext {
  env: Environment & {document: Document; createCanvas(): HTMLCanvasElement};
  scope: {controller: AbortController; assertActive(): void; add(cleanup: () => void): void};
}
export function renderPage(page: ContentPage, context: ContentRenderContext): Promise<HTMLCanvasElement>;
