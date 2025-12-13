// Markdown Maker - Convert web pages to clean, AI-ready markdown
import { Actor } from 'apify';
import { PlaywrightCrawler, requestAsBrowser } from 'crawlee';
import TurndownService from 'turndown';
import { extractFromHtml } from '@extractus/article-extractor';
import { load } from 'cheerio';

const normalizeHtmlForMarkdown = (html, baseUrl) => {
    const $ = load(html || '', { decodeEntities: false });

    // Strip out obvious non-content tags before markdown conversion
    $('script, style, noscript, iframe, template').remove();

    const noiseSelectors = [
        'nav',
        'header',
        'footer',
        'aside',
        '.sidebar',
        '.advertisement',
        '.ads',
        '.ad',
        '.promo',
        '.newsletter',
        '.subscribe',
        '.share',
        '.social',
        '.breadcrumb',
        '.breadcrumbs',
        '.comment',
        '.comments',
        '.cookie',
        '.modal',
        '.popup',
    ];
    $(noiseSelectors.join(',')).remove();

    const toAbsolute = (value) => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed || ['#', 'mailto:', 'javascript:', 'tel:'].some(prefix => trimmed.startsWith(prefix))) {
            return null;
        }

        try {
            const resolved = new URL(trimmed, baseUrl);
            if (!['http:', 'https:'].includes(resolved.protocol)) return null;
            return resolved.href;
        } catch {
            return null;
        }
    };

    const absolutizeAttr = (selector, attr, transform) => {
        $(selector).each((_, element) => {
            const value = $(element).attr(attr);
            if (!value) return;

            const nextValue = transform ? transform(value) : toAbsolute(value);
            if (nextValue) {
                $(element).attr(attr, nextValue);
            }
        });
    };

    absolutizeAttr('a[href]', 'href');
    absolutizeAttr('img[src]', 'src');
    absolutizeAttr('source[src]', 'src');
    absolutizeAttr('video[src]', 'src');
    absolutizeAttr('audio[src]', 'src');
    absolutizeAttr('track[src]', 'src');
    absolutizeAttr('link[href]', 'href');
    absolutizeAttr('img[srcset], source[srcset]', 'srcset', (srcset) => {
        const parts = srcset.split(',').map(part => part.trim()).filter(Boolean);

        const normalized = parts
            .map(part => {
                const [link, descriptor] = part.split(/\s+/, 2);
                const absolute = toAbsolute(link);
                if (!absolute) return null;
                return descriptor ? `${absolute} ${descriptor}` : absolute;
            })
            .filter(Boolean);

        return normalized.join(', ');
    });

    const bodyHtml = $('body').html();
    return bodyHtml !== null && bodyHtml !== undefined ? bodyHtml : $.root().html() || '';
};

const CONTENT_SELECTORS = [
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.article-body',
    '.blog-post',
    '.markdown-body',
    '.docs-main',
    '.documentation',
];

const pickMainContent = (html) => {
    const $ = load(html || '', { decodeEntities: false });
    const getLength = (el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        return text.length;
    };

    let bestHtml = null;
    let bestLength = 0;

    for (const selector of CONTENT_SELECTORS) {
        $(selector).each((_, el) => {
            const len = getLength(el);
            if (len > bestLength && len > 120) {
                bestLength = len;
                bestHtml = $(el).html();
            }
        });
        if (bestHtml) break;
    }

    const titleFromDom = $('title').first().text().trim() || null;
    const mainHtml = bestHtml || $('body').html() || $.root().html() || '';

    return { mainHtml, titleFromDom };
};

const isBlockedResponse = (statusCode, body) => {
    if (statusCode && statusCode >= 400) return true;
    if (!body) return true;

    const sample = body.slice(0, 2000).toLowerCase();
    const blockSignals = [
        'access denied',
        'forbidden',
        'unauthorized',
        'captcha',
        'verify you are human',
        'bot detection',
        'temporary rate limit',
        'cloudflare',
    ];

    return blockSignals.some(signal => sample.includes(signal));
};

const buildMarkdownFromHtml = async (html, url, turndownService, titleFallback = 'Untitled') => {
    let extractedContent = null;

    try {
        extractedContent = await extractFromHtml(html, url);
    } catch (error) {
        // Article extractor can fail on some pages; fallback is handled below.
    }

    if (extractedContent && extractedContent.content) {
        const preparedContent = normalizeHtmlForMarkdown(extractedContent.content, url);
        const contentMarkdown = turndownService.turndown(preparedContent);
        const title = extractedContent.title || titleFallback || 'Untitled';

        const markdown = `# ${title}\n\n**URL Source:** ${url}\n\n---\n\n${contentMarkdown}`;
        return { markdown, title };
    }

    const { mainHtml, titleFromDom } = pickMainContent(html);
    const preparedContent = normalizeHtmlForMarkdown(mainHtml || html, url);
    const contentMarkdown = turndownService.turndown(preparedContent);
    const title = titleFromDom || titleFallback || 'Untitled';

    const markdown = `# ${title}\n\n**URL Source:** ${url}\n\n---\n\n${contentMarkdown}`;
    return { markdown, title };
};


// Initialize Actor
await Actor.init();

try {
    // Get input from the Actor
    const input = await Actor.getInput();
    
    if (!input || !input.startUrls || !Array.isArray(input.startUrls) || input.startUrls.length === 0) {
        throw new Error('Invalid input: startUrls array is required and must contain at least one URL');
    }

    const {
        startUrls,
        maxItems = null,
        delayBetweenRequests = 0,
        proxyConfiguration = { useApifyProxy: true },
    } = input;

    console.log('Starting Markdown Maker...');
    console.log(`Processing ${startUrls.length} URLs`);
    if (maxItems) {
        console.log(`Limited to ${maxItems} items`);
    }
    if (delayBetweenRequests > 0) {
        console.log(`Delay between requests: ${delayBetweenRequests} seconds`);
    }

    // Initialize Turndown for HTML to Markdown conversion
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '*',
        codeBlockStyle: 'fenced',
        fence: '```',
    });

    // Configure Turndown for GitHub-flavored markdown
    turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'],
        replacement: (content) => `~~${content}~~`,
    });

    // Table handling
    turndownService.addRule('table', {
        filter: 'table',
        replacement: (content) => {
            return '\n' + content + '\n';
        },
    });

    // Track processed items
    let processedCount = 0;

    const resolvedProxyConfiguration = proxyConfiguration?.useApifyProxy
        ? await Actor.createProxyConfiguration(proxyConfiguration)
        : undefined;

    // Create a PlaywrightCrawler
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: resolvedProxyConfiguration,
        
        maxRequestsPerCrawl: maxItems || undefined,
        maxConcurrency: delayBetweenRequests > 0 ? 1 : undefined,

        // Use headless browser for JavaScript-heavy sites
        launchContext: {
            launchOptions: {
                headless: true,
            },
        },

        async requestHandler({ page, request, log }) {
            const url = request.url;
            log.info(`Processing: ${url}`);

            const proxyUrl = resolvedProxyConfiguration ? await resolvedProxyConfiguration.newUrl() : undefined;

            try {
                let result = null;

                // Fast path: fetch HTML and parse with Cheerio
                try {
                    const response = await requestAsBrowser({
                        url,
                        proxyUrl,
                        timeoutSecs: 30,
                        ignoreSslErrors: true,
                    });

                    if (!isBlockedResponse(response.statusCode, response.body) && response.body && response.body.length > 200) {
                        result = await buildMarkdownFromHtml(response.body, url, turndownService);
                        log.info('Used fast HTML fetch (Cheerio) for extraction');
                    } else {
                        log.warning(`Cheerio fetch looked blocked or empty (status ${response.statusCode ?? 'unknown'})`);
                    }
                } catch (fastError) {
                    log.warning(`Cheerio fetch failed for ${url} (${fastError.message}), will fallback to Playwright`);
                }

                // Fallback: use Playwright-rendered HTML
                if (!result) {
                    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
                        log.warning('Network idle timeout, continuing anyway...');
                    });

                    const title = await page.title().catch(() => 'Untitled');
                    const html = await page.content();
                    result = await buildMarkdownFromHtml(html, url, turndownService, title);
                    log.info('Used Playwright-rendered HTML for extraction');
                }

                await Actor.pushData({
                    url,
                    title: result.title,
                    markdown: result.markdown,
                    timestamp: new Date().toISOString(),
                });

                processedCount++;
                log.info(`Progress: ${processedCount} pages processed`);

                if (delayBetweenRequests > 0) {
                    log.info(`Waiting ${delayBetweenRequests} seconds before next request...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * 1000));
                }

            } catch (error) {
                log.error(`Failed to process ${url}: ${error.message}`);
                
                await Actor.pushData({
                    url,
                    title: 'Error',
                    markdown: `# Error Processing Page\n\n**URL:** ${url}\n\n**Error:** ${error.message}`,
                    timestamp: new Date().toISOString(),
                    error: true,
                });
            }
        },

        failedRequestHandler({ request, log }) {
            log.error(`Request failed after retries: ${request.url}`);
        },
    });

    // Run the crawler
    await crawler.run(startUrls);

    console.log('Markdown Maker completed successfully!');
    console.log(`Total pages processed: ${processedCount}`);

} catch (error) {
    console.error('Actor failed:', error.message);
    throw error;
} finally {
    // Exit the Actor
    await Actor.exit();
}
