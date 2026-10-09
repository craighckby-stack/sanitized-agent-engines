# FirecrawlRuntimeEngine Web Scraper & Structured Markdown Engine
*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> **Source Origin**: [mendableai/firecrawl](https://github.com/mendableai/firecrawl) (TypeScript)
> **License**: AGPL-3.0 (Authentic Source License)
> **Architecture**: Asynchronous Crawl Queue + DOM HTML Sanitizer + LLM Structured Extractor.

---

## Engine 1: FirecrawlRuntimeEngineHtmlToMarkdownConverter

### What it does
Cleans raw HTML pages, strips script/style tags, and transforms DOM trees into clean LLM-ready markdown.

### Implementation Code
```typescript
export class FirecrawlRuntimeEngineHtmlToMarkdownConverter {
  public convertHtmlToMarkdown(htmlContent: string): string {
    let clean = htmlContent
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, '');

    clean = clean.replace(/<h1[\s\S]*?>(.*?)<\/h1>/gi, '# $1\n\n');
    clean = clean.replace(/<h2[\s\S]*?>(.*?)<\/h2>/gi, '## $1\n\n');
    clean = clean.replace(/<h3[\s\S]*?>(.*?)<\/h3>/gi, '### $1\n\n');
    clean = clean.replace(/<p[\s\S]*?>(.*?)<\/p>/gi, '$1\n\n');
    clean = clean.replace(/<a\s+href=["'](.*?)["'][\s\S]*?>(.*?)<\/a>/gi, '[$2]($1)');

    return clean.replace(/<[^>]+>/g, '').trim();
  }
}
```
