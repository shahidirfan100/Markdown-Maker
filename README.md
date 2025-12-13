# Markdown Maker

> **Convert any web page into clean, AI-ready markdown format in seconds.** Perfect for feeding content to AI models, creating documentation, or archiving web content in a portable format.

[![Apify Actor](https://img.shields.io/badge/Apify-Actor-blue)](https://apify.com)
[![Markdown](https://img.shields.io/badge/Format-Markdown-lightgrey)](https://apify.com)
[![AI Ready](https://img.shields.io/badge/AI-Ready-green)](https://apify.com)

## 📋 What This Actor Does

Markdown Maker automatically transforms web pages into clean, well-formatted markdown that's optimized for AI processing and human readability. Whether you're building an AI training dataset, creating documentation, or archiving web content, this tool extracts the main content from any URL and converts it to structured markdown—eliminating ads, navigation menus, and other clutter.

Perfect for:

- **AI Training Data** - Convert documentation and articles into markdown for feeding to language models
- **Content Archiving** - Save web content in a portable, future-proof format
- **Documentation Migration** - Extract content from old sites to import into new documentation platforms
- **Research** - Collect and organize content from multiple sources
- **Data Analysis** - Convert web content to structured format for text analysis

### ✨ Key Features

- 🎯 **Smart Content Extraction** - Automatically identifies and filters out ads, navigation, and clutter
- 📝 **GitHub-Flavored Markdown** - Clean, standardized markdown with proper table syntax and formatting
- ⚡ **Batch Processing** - Process multiple URLs at once with optional delays
- 🔒 **Reliable Scraping** - Built-in proxy rotation and retry logic for consistent results
- 🌐 **Universal Compatibility** - Works on any website including JavaScript-heavy pages
- 🚀 **Production Ready** - Optimized for speed and reliability

## 🚀 Quick Start

### Basic Usage - Single URL

```json
{
  "startUrls": [
    {
      "url": "https://docs.apify.com/api/v2"
    }
  ]
}
```

### Multiple URLs

```json
{
  "startUrls": [
    {
      "url": "https://docs.apify.com/api/v2"
    },
    {
      "url": "https://example.com/article"
    },
    {
      "url": "https://blog.example.com/post"
    }
  ],
  "maxItems": 10
}
```

### With Rate Limiting

```json
{
  "startUrls": [
    {
      "url": "https://docs.example.com/page1"
    },
    {
      "url": "https://docs.example.com/page2"
    }
  ],
  "delayBetweenRequests": 2,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

## 📊 Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `startUrls` | array | ✅ Yes | List of URLs to convert to markdown | `[{"url": "https://example.com"}]` |
| `maxItems` | integer | ❌ No | Maximum number of pages to process | `10` (default: unlimited) |
| `delayBetweenRequests` | integer | ❌ No | Seconds to wait between processing each URL (0-300) | `2` (default: 0) |
| `proxyConfiguration` | object | ❌ No | Proxy settings for reliable access | `{"useApifyProxy": true}` |

## 📈 Output Data Structure

Each converted page provides clean markdown with metadata:

```json
{
  "url": "https://docs.apify.com/api/v2",
  "title": "Apify API Documentation",
  "markdown": "# Apify API Documentation\n\n**URL Source:** https://docs.apify.com/api/v2\n\n---\n\nThe Apify API provides programmatic access...\n\n## Authentication\n\n...",
  "timestamp": "2024-12-13T10:30:00.000Z"
}
```

### Output Fields

- **`url`** - Source web page URL
- **`title`** - Extracted page title
- **`markdown`** - Full content converted to clean markdown format
- **`timestamp`** - When the page was processed

### Markdown Format Features

- ✅ Proper heading hierarchy (H1-H6)
- ✅ Clean table syntax with pipes (`|`)
- ✅ Bullet points using asterisks (`*`)
- ✅ Code blocks with triple backticks
- ✅ Strikethrough and emphasis preserved
- ✅ Horizontal rules under major sections
- ✅ Source URL included in output

## 🎯 Use Cases & Applications

### AI & Machine Learning
- **Training Data Preparation** - Convert documentation for AI model training
- **RAG Systems** - Prepare content for retrieval-augmented generation
- **Knowledge Bases** - Build searchable AI knowledge repositories
- **Prompt Engineering** - Create clean context for LLM prompts

### Documentation & Content
- **Documentation Migration** - Move content to modern markdown-based systems
- **Content Archiving** - Preserve web content in portable format
- **Static Site Generation** - Feed content to Jekyll, Hugo, or Next.js
- **Knowledge Management** - Build internal wikis and documentation

### Research & Analysis
- **Academic Research** - Collect and analyze web content
- **Market Research** - Extract competitor information
- **Text Mining** - Prepare web data for NLP analysis
- **Content Monitoring** - Track changes to web pages over time

## ⚡ Performance & Cost Optimization

### Recommended Settings for Different Use Cases

| Use Case | Max Items | Delay | Est. Time |
|----------|-----------|-------|-----------|
| Quick Test | 5 | 0 | ~30 seconds |
| Documentation Site | 50 | 1 | ~2 minutes |
| Content Archive | 200 | 2 | ~8 minutes |
| Large Dataset | 500+ | 2 | ~20 minutes |

### Plan Limits

- **Free Plan**: Limited to 100 pages per run
- **Paid Plans**: Unlimited page processing

[Upgrade to a paid plan](https://apify.com/pricing) to process unlimited pages.

### Best Practices

- **Start Small**: Test with 5-10 URLs first to verify output quality
- **Use Delays**: Set `delayBetweenRequests` to avoid overwhelming servers
- **Enable Proxies**: Use Apify Proxy for reliable access to any website
- **Batch Processing**: Process URLs in batches for better control
- **Monitor Output**: Check markdown quality and adjust as needed

## 🔧 Configuration Examples

### Documentation Site

Convert entire documentation site for AI training:

```json
{
  "startUrls": [
    {"url": "https://docs.example.com/getting-started"},
    {"url": "https://docs.example.com/api-reference"},
    {"url": "https://docs.example.com/tutorials"}
  ],
  "maxItems": 50,
  "delayBetweenRequests": 1,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### Blog Archive

Archive blog posts in markdown format:

```json
{
  "startUrls": [
    {"url": "https://blog.example.com/2024/post-1"},
    {"url": "https://blog.example.com/2024/post-2"}
  ],
  "maxItems": 100,
  "delayBetweenRequests": 2
}
```

### Research Collection

Gather content from multiple sources:

```json
{
  "startUrls": [
    {"url": "https://wikipedia.org/wiki/Topic"},
    {"url": "https://example.com/research-paper"},
    {"url": "https://news.example.com/article"}
  ],
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### Quick Single Page

Convert a single page quickly:

```json
{
  "startUrls": [
    {"url": "https://example.com/important-page"}
  ]
}
```

## 📋 Supported Content & Features

### Website Compatibility
- ✅ Static HTML pages
- ✅ JavaScript-rendered content (SPA, React, Vue, Angular)
- ✅ Documentation sites (GitBook, Docusaurus, MkDocs)
- ✅ Blog platforms (WordPress, Medium, Ghost)
- ✅ Wiki pages (Wikipedia, Confluence)
- ✅ News articles and magazines
- ✅ Product pages and landing pages

### Content Extraction
- **Smart Filtering**: Automatically removes ads, navigation, footers, and sidebars
- **Semantic Analysis**: Identifies main content using multiple algorithms
- **Structure Preservation**: Maintains headings, lists, tables, and code blocks
- **Link Handling**: Preserves hyperlinks in markdown format
- **Image Alt Text**: Includes image descriptions when available

### Language Support
- Works with any language (Unicode support)
- Preserves special characters and formatting
- Handles RTL (right-to-left) text

## 🆘 Troubleshooting

### Common Issues

**Empty or Poor Quality Markdown**
- Page may have aggressive anti-scraping measures
- Enable `proxyConfiguration` with Apify Proxy
- Some pages may have no extractable content
- Try increasing `delayBetweenRequests`

**Timeout Errors**
- Reduce the number of URLs in `startUrls`
- Increase `delayBetweenRequests` to slow down processing
- Enable proxy configuration for better reliability
- Split large jobs into smaller batches

**Missing Content**
- JavaScript-heavy sites may need more processing time
- Some content may be dynamically loaded after page render
- Check if the page requires authentication

**Rate Limiting**
- Increase `delayBetweenRequests` (e.g., 2-5 seconds)
- Enable Apify Proxy to rotate IP addresses
- Process fewer URLs per run

### Support

For issues or feature requests:
- **Email**: Contact via Google Form
- **Documentation**: Check Apify documentation
- **Community**: Visit Apify Discord community

We're here to help! Fill out the form at https://docs.google.com/forms/d/e/1FAIpQLSfsKyzZ3nRED7mML47I4LAfNh_mBwkuFMp1FgYYJ4AkDRgaRw/viewform to get support.

## � Export Options

The Apify platform provides multiple ways to export your markdown data:

### JSON Format
Perfect for programmatic use or integration with other tools:
```json
[
  {
    "url": "https://example.com",
    "title": "Example Page",
    "markdown": "# Example Page\n\n..."
  }
]
```

### CSV Format
Great for opening in Excel or Google Sheets - each row contains one URL and its markdown content.

### Integration Options
- **Webhooks** - Send results to your own API
- **Google Sheets** - Automatically populate a spreadsheet
- **Make.com / Zapier** - Trigger workflows based on results
- **Other Apify Actors** - Chain multiple actors together

## 🔗 API Integration

Access your results programmatically:

```bash
# Get the dataset
curl https://api.apify.com/v2/datasets/{DATASET_ID}/items
```

Results are stored in Apify's dataset storage and remain available for download even after the actor finishes running.

## 📄 License & Terms

This actor extracts publicly available web content in accordance with applicable web scraping regulations and respects robots.txt directives.

---

**Built with ❤️ by Shahid**

**Keywords**: markdown converter, web scraping, ai training data, content extraction, documentation tools, markdown generator, web to markdown, apify actor, content archiving, ai-ready data