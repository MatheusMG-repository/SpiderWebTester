import { AIConfig } from './ai-selector';

export function buildPageObjectPrompt(contextStr: string, targetUrl: string): string {
  return `You are a senior frontend QA automation engineer.
Your task is to analyze the page description below and create a robust Playwright Page Object Model in TypeScript.

Authoritative target URL for this page: ${targetUrl}
Use this exact URL in the page object's \`goto()\` method. Do not substitute an example, generic, or inferred URL.

Here is the context of the scraped target page (including page title, URL, interactive elements, captured API requests, and accessibility tree):

${contextStr}

Requirements for the page object:
1. Export a class named \`PageObject\` and accept a Playwright \`Page\` in its constructor.
2. Implement an async \`goto()\` method that navigates to the exact authoritative target URL above.
3. Encapsulate useful page locators and user actions as readable properties and methods. Prefer accessible Playwright locators when supported by the context; otherwise use the supplied selectors.
4. Keep selectors and interaction logic in this class. Do not include tests, assertions, or test-runner imports.
5. Import types from \`playwright\` and return ONLY the TypeScript code inside a markdown code block (starting with \`\`\`typescript and ending with \`\`\`). Do not include explanations outside the code block.

Please output the page object code:
`;
}

export function buildTestPrompt(pageObjectCode: string, pageObjectImportPath: string): string {
  return `You are a senior frontend QA automation engineer.
Write a comprehensive, maintainable Playwright test suite in TypeScript using the supplied Page Object Model.

Page object module:
\`\`\`typescript
${pageObjectCode}
\`\`\`

Requirements for the test suite:
1. Import \`test\` and \`expect\` from \`@playwright/test\`.
2. Import \`PageObject\` from \`${pageObjectImportPath}\`, instantiate it with the test's \`page\`, and call its \`goto()\` method in setup.
3. Use only locators and actions exposed by the PageObject for page interaction; do not duplicate selectors or reimplement its behavior in the tests.
4. Write meaningful scenarios and assertions based on the available PageObject API. Do not invent methods or application behavior not supported by the PageObject.
5. Structure the suite in a \`test.describe\` block.
6. Return ONLY the TypeScript code inside a markdown code block (starting with \`\`\`typescript and ending with \`\`\`). Do not include explanations outside the code block.

Please output the test code:
`;
}

/**
 * Central AI dispatch function.
 * Routes to the appropriate backend (local Ollama or cloud provider)
 * and always returns the extracted TypeScript code string.
 */
export async function callAI(prompt: string, config: AIConfig): Promise<string> {
  let rawResponse: string;

  if (config.mode === 'local') {
    rawResponse = await callOllama(prompt, config.modelName);
  } else {
    switch (config.provider) {
      case 'openai':
        rawResponse = await callOpenAI(prompt, config.apiKey, config.cloudModel);
        break;
      case 'gemini':
        rawResponse = await callGemini(prompt, config.apiKey, config.cloudModel);
        break;
      case 'anthropic':
        rawResponse = await callAnthropic(prompt, config.apiKey, config.cloudModel);
        break;
    }
  }

  return extractCodeBlock(rawResponse!);
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function callOllama(prompt: string, modelName: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName, prompt, stream: false }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP Error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { response: string };
  return result.response;
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI HTTP Error: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const result = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return result.choices[0].message.content;
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini HTTP Error: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const result = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return result.candidates[0].content.parts[0].text;
}

async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic HTTP Error: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const result = (await response.json()) as {
    content: { type: string; text: string }[];
  };
  return result.content[0].text;
}

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

/**
 * Extracts typescript/javascript code block content from markdown text.
 * Falls back to returning the whole response if no markdown block is found.
 */
export function extractCodeBlock(markdownText: string): string {
  // 1. Try to match a typescript code block
  const tsMatch = markdownText.match(/```typescript([\s\S]*?)```/i);
  if (tsMatch && tsMatch[1]) {
    return tsMatch[1].trim();
  }

  // 2. Try to match a javascript/js code block
  const jsMatch =
    markdownText.match(/```javascript([\s\S]*?)```/i) ||
    markdownText.match(/```js([\s\S]*?)```/i);
  if (jsMatch && jsMatch[1]) {
    return jsMatch[1].trim();
  }

  // 3. Fallback: match any code block
  const anyMatch = markdownText.match(/```([\s\S]*?)```/);
  if (anyMatch && anyMatch[1]) {
    return anyMatch[1].trim();
  }

  // 4. Return the raw text if no code block tags were parsed
  return markdownText.trim();
}
