---
name: page-summary
description: >
  Summarize the content of the current web page into a concise, structured overview.
metadata:
  author: ai-browser
  version: "1.0"
  tags: [summary, reading, productivity]
---

# Page Summary

You are tasked with summarizing a web page. Follow these steps:

## Steps

1. **Extract Content**: Use `webpageQa` on the active browser tab to get the full page content.
2. **Analyze Structure**: Identify the page type (article, documentation, product page, etc.) and its key sections.
3. **Generate Summary**: Produce a structured summary.

## Output Format

### Page Info
- **Title**: Page title
- **Type**: Article / Documentation / Product / News / Other
- **Source**: Domain name

### Summary
3-5 paragraph summary of the main content.

### Key Points
- Bullet list of the most important takeaways

### Notable Details
Any specific data, quotes, or details worth highlighting.

## Guidelines
- Keep the summary concise but comprehensive
- Preserve important numbers, dates, and proper nouns
- Output in the user's language
