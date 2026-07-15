# yo-docs-db

Document knowledge base powered by jieba tokenization + SQLite inverted index. Supports mixed Chinese/English keyword search.

## Install

```bash
npm install
```

Dependencies: `@node-rs/jieba`, Node.js 22+ (built-in `node:sqlite`).

## Usage

```typescript
import { YoDocsDB } from 'yo-docs-db';

const docs = new YoDocsDB({
  dbPath: './.yo_ddb/data/docs.db',
  docsDir: './.yo_ddb/docs',
});

// Write document (auto tokenize + build inverted index)
await docs.write({
  type: 'frontend',
  lang: 'vue',
  question: 'How to use Font Awesome in Vue',
  doc_name: 'fontawesome-usage',
  content: '# Font Awesome\n...',
});

// Keyword search (sorted by match count, returns document content)
const { results } = await docs.query({
  type: 'frontend',
  lang: 'vue',
  query: 'fontawesome icon',
  limit: 5,
});

// List documents (optional type/lang filter)
docs.list({ type: 'frontend', lang: 'vue' });

// Delete by ID (auto-cleanup orphaned keywords)
docs.delete({ id: 'uuid-xxx' });

// Tokenize text (expose underlying capability)
docs.tokenize('Vue Router how to configure');

// Release resources
docs.close();
```

## API

| Method | Description |
|--------|-------------|
| `write(params)` | Write document + build index, returns `{ id, keywords }` |
| `query(params)` | Keyword search, sorted by `match_count` desc |
| `list(params?)` | List documents, `type`/`lang` optional |
| `delete(params)` | Delete by ID, auto-cleanup orphaned keywords |
| `getById(id)` | Get document metadata by ID |
| `tokenize(text)` | jieba tokenization (stopwords/single-char/dedup) |
| `close()` | Close database connection |

## Data Structure

SQLite tables:

- **documents** — document records (id, type, lang, question, doc_path)
- **keywords** — dictionary (deduplicated tokens)
- **doc_keywords** — inverted index (document↔keyword mapping)

## Demo

```bash
node --experimental-strip-types demo.ts
```

Generates sample data in `.yo_ddb/data/docs.db` and `.yo_ddb/docs/`.
