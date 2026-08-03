import { ExtractedPageContext } from './scraper';

export function formatContextForLLM(context: ExtractedPageContext): string {
  const elementsMarkdown = context.interactiveElements
    .map((e) => `- **[${e.role}]** "${e.name}" -> Selector: \`${e.selector}\` ${e.testId ? `(TestID: \`${e.testId}\`)` : ''}`)
    .join('\n');

  const apiMarkdown = context.networkTraffic
    .map((req) => `- \`${req.method}\` ${req.url} (Status: ${req.status || 'N/A'})`)
    .join('\n');

  return `
# Target Page: ${context.title}
**URL:** ${context.url}

## Interactive Elements
${elementsMarkdown || 'No explicit interactive elements found.'}

## Intercepted API Endpoints (Network Activity)
${apiMarkdown || 'No fetch/XHR calls detected on load.'}

## Accessibility Tree (Structured View)
\`\`\`json
${JSON.stringify(context.axTree, null, 2)}
\`\`\`
`.trim();
}