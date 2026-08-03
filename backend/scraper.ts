import { chromium, Page } from 'playwright';
import { getAccessibilityTree } from './accessibility';

export interface ExtractedPageContext {
  url: string;
  title: string;
  axTree: any; // Accessibility tree snapshot
  interactiveElements: InteractiveElement[];
  networkTraffic: CapturedApiRequest[];
  discoveredLinks: string[];
}

export interface InteractiveElement {
  role: string;
  name: string;
  tagName: string;
  id?: string;
  testId?: string;
  selector: string;
  isVisible: boolean;
  isDisabled: boolean;
}

export interface CapturedApiRequest {
  url: string;
  method: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  responseBodySnippet?: string;
}

export class WebScraperService {
  /**
   * Navigates to a target URL, captures accessibility tree,
   * extracts interactive DOM elements, and intercepts API calls.
   */
  async extract(targetUrl: string): Promise<ExtractedPageContext> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const capturedRequests: CapturedApiRequest[] = [];

    // 1. Intercept XHR / Fetch calls (Prepares for future API test generation)
    page.on('response', async (response) => {
      const request = response.request();
      const resourceType = request.resourceType();

      if (resourceType === 'fetch' || resourceType === 'xhr') {
        let responseBodySnippet = '';
        try {
          const body = await response.text();
          responseBodySnippet = body.slice(0, 500); // Truncate large payloads
        } catch {
          responseBodySnippet = '[Non-text or binary body]';
        }

        capturedRequests.push({
          url: request.url(),
          method: request.method(),
          status: response.status(),
          responseBodySnippet,
        });
      }
    });

    // 2. Navigate and wait until network is idle
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 3. Extract standard Playwright Accessibility Snapshot
    const axTree = await getAccessibilityTree(page);

    // 4. Extract detailed interactive elements from the live DOM
    const interactiveElements = await page.evaluate(() => {
      const selectors = [
        'button',
        'a[href]',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[data-testid]',
      ];

      const elements = Array.from(document.querySelectorAll(selectors.join(',')));

      return elements.map((el) => {
        const htmlEl = el as HTMLElement;
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
        const role = el.getAttribute('role') || el.tagName.toLowerCase();

        // Generate a clean candidate selector
        let preferredSelector = '';
        if (testId) {
          preferredSelector = `[data-testid="${testId}"]`;
        } else if (el.id) {
          preferredSelector = `#${el.id}`;
        } else {
          preferredSelector = el.tagName.toLowerCase();
        }

        return {
          role,
          name: htmlEl.innerText?.trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '',
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          testId: testId || undefined,
          selector: preferredSelector,
          isVisible: htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0,
          isDisabled: (el as any).disabled || false,
        };
      });
    });

    const title = await page.title();

    // Capture unique raw hrefs on the page before closing the browser
    const rawHrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '');
    });

    await browser.close();

    // Filter to find unique, valid internal links
    const discoveredLinks: string[] = [];
    const targetUrlObj = new URL(targetUrl);
    
    for (const href of rawHrefs) {
      try {
        const resolvedUrl = new URL(href, targetUrl);
        // Remove hash fragment for comparison and canonical URL representation
        resolvedUrl.hash = '';
        
        // Skip if protocol is not http/https
        if (resolvedUrl.protocol !== 'http:' && resolvedUrl.protocol !== 'https:') {
          continue;
        }

        // Skip external domains
        if (resolvedUrl.hostname !== targetUrlObj.hostname) {
          continue;
        }

        // Skip static files
        const pathname = resolvedUrl.pathname.toLowerCase();
        if (/\.(pdf|zip|png|jpe?g|gif|svg|css|js|webp|ico|xml|txt)$/.test(pathname)) {
          continue;
        }

        // Skip if it is the target url itself (after removing hash)
        const targetClean = new URL(targetUrl);
        targetClean.hash = '';
        if (resolvedUrl.href === targetClean.href) {
          continue;
        }

        discoveredLinks.push(resolvedUrl.href);
      } catch {
        // Ignore invalid URLs
      }
    }

    const uniqueLinks = Array.from(new Set(discoveredLinks));

    return {
      url: targetUrl,
      title,
      axTree,
      interactiveElements: interactiveElements.filter((e) => e.isVisible),
      networkTraffic: capturedRequests,
      discoveredLinks: uniqueLinks,
    };
  }
}