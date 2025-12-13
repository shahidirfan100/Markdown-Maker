// Markdown Maker - Convert web pages to clean, AI-ready markdown
import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { extractFromHtml } from '@extractus/article-extractor';
import { load } from 'cheerio';

const normalizeHtmlForMarkdown = (html, baseUrl) => {
    const $ = load(html || '', { decodeEntities: false });

    // Strip out obvious non-content tags before markdown conversion
    $('script, style, noscript').remove();

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

    // Create a PlaywrightCrawler
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: proxyConfiguration?.useApifyProxy
            ? await Actor.createProxyConfiguration(proxyConfiguration)
            : undefined,
        
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

            try {
                // Wait for the page to load completely
                await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
                    log.warning('Network idle timeout, continuing anyway...');
                });

                // Get the page title
                const title = await page.title().catch(() => 'Untitled');

                // Get the HTML content
                const html = await page.content();

                let markdown = '';
                let extractedContent = null;

                // Try to extract article content using article-extractor
                try {
                    extractedContent = await extractFromHtml(html, url);
                } catch (error) {
                    log.warning(`Article extraction failed for ${url} (${error.message}), falling back to full page conversion`);
                }

                // Convert to markdown
                if (extractedContent && extractedContent.content) {
                    const preparedContent = normalizeHtmlForMarkdown(extractedContent.content, url);
                    const contentMarkdown = turndownService.turndown(preparedContent);
                    
                    markdown = `# ${extractedContent.title || title}\n\n`;
                    markdown += `**URL Source:** ${url}\n\n`;
                    markdown += `---\n\n`;
                    markdown += contentMarkdown;

                    log.info(`Extracted article content from: ${url}`);
                } else {
                    // Fallback: Try to find main content area
                    const mainContent = await page.evaluate(() => {
                        // Try to find main content container
                        const selectors = [
                            'article',
                            'main',
                            '[role="main"]',
                            '.main-content',
                            '.content',
                            '#content',
                            '.post-content',
                            '.entry-content',
                            'body',
                        ];

                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                // Remove script, style, nav, footer, aside elements
                                const clone = element.cloneNode(true);
                                const unwantedSelectors = [
                                    'script',
                                    'style',
                                    'nav',
                                    'footer',
                                    'aside',
                                    '.advertisement',
                                    '.ads',
                                    '.sidebar',
                                    '.comments',
                                    '[role="navigation"]',
                                    '[role="complementary"]',
                                ];
                                
                                unwantedSelectors.forEach(sel => {
                                    clone.querySelectorAll(sel).forEach(el => el.remove());
                                });
                                
                                return clone.innerHTML;
                            }
                        }
                        return document.body.innerHTML;
                    });

                    const preparedContent = normalizeHtmlForMarkdown(mainContent || html, url);
                    const contentMarkdown = turndownService.turndown(preparedContent);
                    
                    markdown = `# ${title}\n\n`;
                    markdown += `**URL Source:** ${url}\n\n`;
                    markdown += `---\n\n`;
                    markdown += contentMarkdown;

                    log.info(`Converted full page content from: ${url}`);
                }

                // Save to dataset
                await Actor.pushData({
                    url,
                    title: extractedContent?.title || title,
                    markdown,
                    timestamp: new Date().toISOString(),
                });

                processedCount++;
                log.info(`Progress: ${processedCount} pages processed`);

                // Apply delay if specified
                if (delayBetweenRequests > 0) {
                    log.info(`Waiting ${delayBetweenRequests} seconds before next request...`);
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * 1000));
                }

            } catch (error) {
                log.error(`Failed to process ${url}: ${error.message}`);
                
                // Save error information
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
