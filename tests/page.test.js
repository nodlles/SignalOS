import assert from "node:assert/strict";
import { extractReadableText } from "../src/ingest/page.js";

const html = `<!doctype html>
<html>
  <head>
    <meta name="description" content="Short fallback description">
    <script type="application/ld+json">
      {
        "@type": "BlogPosting",
        "headline": "Agent Runtime Update",
        "description": "A short description",
        "articleBody": "The new runtime adds durable state, tool calling, and better observability for production agent workflows."
      }
    </script>
  </head>
  <body>
    <article>
      <h1>Agent Runtime Update</h1>
      <p>The new runtime adds durable state.</p>
      <p>It also improves tool calling and observability.</p>
    </article>
  </body>
</html>`;

const text = extractReadableText(html);

assert.match(text, /Agent Runtime Update/);
assert.match(text, /durable state/);
assert.match(text, /observability/);

console.log("page extraction tests passed");
