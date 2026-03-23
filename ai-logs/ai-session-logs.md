## AI Usage & Development Process Summary

I followed a deliberate, step-by-step process rather than relying on one-shot full-project generation. AI tools were used mainly as reasoning partners, code assistants, and debug helpers — not as a replacement for understanding the problem.

1. First-principles understanding phase (≈ first 4–6 hours)
   - Used **Grok** and **DeepSeek** in browser/chat sessions to deeply understand the assignment from scratch.
   - Key early questions I asked:
     - "From first principles, what core problems does a context graph system solve in fragmented order-to-cash data?"
     - "Break down the typical SAP OTC document flow and the most important reference fields (VBAK → LIKP → VBRK chaining)"
     - "For a 2-day MVP with ~10k rows, compare in-memory graph vs SQLite-based neighbor queries vs full graph DB"
     - "What are proven prompt patterns to enforce strict dataset-only guardrails with function calling?"
   - Created handwritten markdown notes and a rough architecture sketch before any code was written.

2. Initial project setup & scaffolding (manual + Trae)
   - I manually created the pnpm monorepo structure (pnpm-workspace.yaml, apps/backend, apps/frontend, packages/shared).
   - Used **Trae** (AI-assisted IDE/tool) to quickly bootstrap:
     - Vite + React + TypeScript frontend
     - Express + TypeScript backend
     - Basic better-sqlite3 + csv-parse setup
     - Shared types folder
   - Wrote the first CSV → SQLite ingestion logic myself after manually opening several CSVs in a viewer to understand column names and references (VBELN, VGBEL, etc.).

3. Restructuring & mid-project phase – Google antigravity (Gemini)
   - After the initial skeleton, I switched to **Google Antigravity** for major restructuring and refactoring.
   - Used it heavily to:
     - Redesign the graph data model (deciding node/edge shape, sampling strategy for large graphs)
     - Rewrite API endpoints to be more RESTful and performant
     - Improve React component structure (especially the graph + chat layout)
     - Introduce Zod schemas for type-safe request/response handling
   - Typical prompt style:
     - "Here is my current /graph/edges endpoint — it loads everything into memory and is slow. Restructure it to return only neighbors of a given node using prepared SQLite statements."
     - "Convert this messy React state management into proper hooks + context for graph interaction and chat history."

4. Finishing & polishing phase – codex-style models (o1-preview / o1-mini)
   - For the final and most complex pieces (LLM integration, guardrails, graph interaction logic), I used **OpenAI codex** models.
   - These were especially helpful for:
     - Crafting a very tight system prompt + function/tool definitions that reliably enforce dataset-only answers
     - Writing graph traversal helpers (e.g., trace document flow across multiple hops)
     - Debugging tricky edge cases (React Flow node positioning, SQLite query parameterization)
   - Workflow pattern:
     a. Write detailed English spec of the desired behavior
     b. Request code in small, focused pieces (types → logic → tests → integration)
     c. Paste runtime errors / console logs → ask for diagnosis + corrected version
     d. Ask follow-up architectural questions when stuck ("Is it better to cache graph neighbors or recompute them per request?")

5. Debugging & iteration approach
   - Short feedback loops: run locally → observe issue → paste error + code snippet → ask for fix
   - Cross-checked suggestions across models when answers conflicted
   - Manually validated all generated SQL in DB Browser for SQLite before wiring to the app
   - Tested guardrails aggressively with off-topic prompts and iteratively tightened the rejection wording

Tools used (rough order of time spent):
- Grok + DeepSeek → early problem understanding & architecture
- Trae → rapid initial project bootstrap & folder setup
- Google Gemini ("antigravity") → mid-project restructuring, UI/API cleanup
- OpenAI codex → final prompt engineering, complex logic, finishing touches

No complete-project generators or copy-paste templates were used. Every major component went through multiple prompt → code → test → refine cycles.

Unfortunately I did not preserve/export the raw chat histories (multi-tab browser sessions across different tools), so I cannot attach verbatim logs. This summary reflects my actual process as accurately as I can reconstruct it.