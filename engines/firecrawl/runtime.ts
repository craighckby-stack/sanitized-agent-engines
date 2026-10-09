/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 * Unified Clean-Room Runtime for firecrawl
 * Source Origin: mendableai/firecrawl
 */

// ==========================================
// FirecrawlRuntimeEngineHtmlToMarkdownConverter
// ==========================================
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
