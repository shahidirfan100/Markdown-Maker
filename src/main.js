// Markdown Maker - Convert web pages to clean, AI-ready markdown
import { Actor } from 'apify';
import { BasicCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { extractFromHtml } from '@extractus/article-extractor';
import { load } from 'cheerio';
import { gotScraping } from 'got-scraping';
import { chromium } from 'playwright';

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

    // Initialize statistics tracking for QA
    const stats = {
        processedPages: 0,
        failedPages: 0,
        startTime: new Date(),
    };

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

    const resolvedProxyConfiguration = proxyConfiguration?.useApifyProxy
        ? await Actor.createProxyConfiguration(proxyConfiguration)
        : undefined;

    const crawler = new BasicCrawler({
        maxRequestsPerCrawl: maxItems || undefined,
        maxConcurrency: delayBetweenRequests > 0 ? 1 : 5,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 90,

        async requestHandler({ request, log }) {
            const url = request.url;
            log.info(`Processing: ${url}`);

            const proxyUrl = resolvedProxyConfiguration ? await resolvedProxyConfiguration.newUrl() : undefined;

            try {
                let result = null;

                // Fast path: fetch HTML and parse with Cheerio
                try {
                    const response = await gotScraping({
                        url,
                        proxyUrl,
                        timeout: { request: 30000 },
                        https: { rejectUnauthorized: false },
                    });

                    const { statusCode, body } = response;

                    if (!isBlockedResponse(statusCode, body) && body && body.length > 200) {
                        result = await buildMarkdownFromHtml(body, url, turndownService);
                        log.info('Used fast HTML fetch (Cheerio) for extraction');
                    } else {
                        log.warning(`Cheerio fetch looked blocked or empty (status ${statusCode ?? 'unknown'})`);
                    }
                } catch (fastError) {
                    log.warning(`Cheerio fetch failed for ${url} (${fastError.message}), will fallback to Playwright`);
                }

                // Fallback: use Playwright-rendered HTML (single-page browser to avoid navigation loops)
                if (!result) {
                    const browser = await chromium.launch({
                        headless: true,
                        proxy: proxyUrl ? { server: proxyUrl } : undefined,
                    });

                    try {
                        const page = await browser.newPage();
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

                        const title = await page.title().catch(() => 'Untitled');
                        const html = await page.content();
                        result = await buildMarkdownFromHtml(html, url, turndownService, title);
                        log.info('Used Playwright-rendered HTML for extraction');
                        await page.close().catch(() => {});
                    } finally {
                        await browser.close().catch(() => {});
                    }
                }

                // Push data with all required metadata for QA
                await Actor.pushData({
                    url,
                    title: result.title || 'Untitled',
                    markdown: result.markdown,
                    timestamp: new Date().toISOString(),
                    scrapedAt: new Date().toISOString(),
                    success: true,
                });

                stats.processedPages++;
                log.info(`✓ Successfully processed: ${url}`);
                log.info(`Progress: ${stats.processedPages} pages processed, ${stats.failedPages} failed`)

                if (delayBetweenRequests > 0) {
                    log.info(`Waiting ${delayBetweenRequests} seconds before next request...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * 1000));
                }

            } catch (error) {
                stats.failedPages++;
                log.error(`✗ Failed to process ${url}: ${error.message}`);
                
                // Push error data with consistent structure
                await Actor.pushData({
                    url,
                    title: 'Error',
                    markdown: `# Error Processing Page\n\n**URL:** ${url}\n\n**Error:** ${error.message}`,
                    timestamp: new Date().toISOString(),
                    scrapedAt: new Date().toISOString(),
                    success: false,
                    errorMessage: error.message,
                });
            }
        },

        failedRequestHandler({ request, log }) {
            stats.failedPages++;
            log.error(`✗ Request failed after retries: ${request.url}`);
            log.error(`Retry count: ${request.retryCount}`);
        },
    });

    // Run the crawler
    await crawler.run(startUrls);

    // Calculate final statistics
    const endTime = new Date();
    const duration = (endTime - stats.startTime) / 1000; // in seconds
    const totalPages = stats.processedPages + stats.failedPages;
    const successRate = totalPages > 0 ? ((stats.processedPages / totalPages) * 100).toFixed(2) : 0;

    // Log comprehensive statistics for QA validation
    console.log('\n' + '='.repeat(60));
    console.log('Markdown Maker completed successfully!');
    console.log('='.repeat(60));
    console.log(`Total pages processed: ${stats.processedPages}`);
    console.log(`Failed pages: ${stats.failedPages}`);
    console.log(`Success rate: ${successRate}%`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Average time per page: ${totalPages > 0 ? (duration / totalPages).toFixed(2) : 0} seconds`);
    console.log('='.repeat(60) + '\n');

    // Set output metadata for Apify platform
    await Actor.setValue('OUTPUT', {
        stats: {
            processedPages: stats.processedPages,
            failedPages: stats.failedPages,
            totalPages,
            successRate: parseFloat(successRate),
            durationSeconds: duration,
        },
    });

} catch (error) {
    console.error('Actor failed:', error.message);
    throw error;
} finally {
    // Exit the Actor
    await Actor.exit();
}
