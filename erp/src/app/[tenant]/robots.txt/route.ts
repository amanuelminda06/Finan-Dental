import robotsConfig from '../robots';

/**
 * Next only emits the `robots.ts` metadata file from the *root* of `app`, so a
 * nested `app/[tenant]/robots.ts` is silently ignored. This route handler is
 * the per-tenant equivalent: it serialises the same config object used by the
 * unit tests and the sitemap at `/<tenant>/robots.txt`.
 */
function asLines(value: string | number | Array<string | number> | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

export async function GET(): Promise<Response> {
  const config = await robotsConfig();
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
  const lines: string[] = [];

  for (const rule of rules) {
    lines.push(...asLines(rule.userAgent).map((agent) => `User-agent: ${agent}`));
    lines.push(...asLines(rule.allow).map((path) => `Allow: ${path}`));
    lines.push(...asLines(rule.disallow).map((path) => `Disallow: ${path}`));
    if (rule.crawlDelay !== undefined) lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    for (const [directive, value] of Object.entries(rule.other ?? {})) {
      lines.push(...asLines(value).map((entry) => `${directive}: ${entry}`));
    }
    lines.push('');
  }
  lines.push(...asLines(config.sitemap).map((url) => `Sitemap: ${url}`));
  if (config.host) lines.push(`Host: ${config.host}`);

  return new Response(`${lines.join('\n').trimEnd()}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Revalidate so a tenant's rule change is never served from a shared cache.
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
