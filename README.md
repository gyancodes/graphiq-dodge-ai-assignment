# GraphIQ

GraphIQ is a graph-based data modeling and query system for SAP Order-to-Cash data. The project converts fragmented transactional records into a connected business graph, visualizes that graph in the UI, and provides a conversational interface that translates natural-language questions into executable SQL. Answers are generated from real query results, not from the model alone.

## Problem Statement

Order-to-Cash data is distributed across multiple tables such as customers, sales orders, deliveries, billing documents, journal entries, products, and plants. While the source data is relational, the business questions are often relationship-driven:

- Which products appear in the most billing documents?
- What is the complete flow for a billing document from sales order through accounting?
- Which sales orders have incomplete downstream processing?

This project addresses that gap by combining:

- a graph representation for exploration and relationship tracing
- a relational query engine for deterministic execution
- an LLM orchestration layer for natural-language query translation

## System Overview

The application has three major layers:

1. Frontend
   A React application renders the business graph with Cytoscape, provides a chat interface, supports node inspection, and highlights the path relevant to a query response.

2. Backend
   An Express server exposes graph, node-detail, system, and query endpoints. It also coordinates LLM prompting, SQL generation, SQL repair, answer synthesis, and graph-path highlighting.

3. Data and execution layer
   The dataset is ingested into SQLite and executed locally through `sql.js`. The graph shown in the UI is derived from the relational data model rather than stored separately in a dedicated graph database.

## Architecture Decisions

### Graph for interaction, SQL for execution

The central architectural decision was to separate the interaction model from the execution model.

- The graph is the right abstraction for users because Order-to-Cash questions are fundamentally about connected entities and process flow.
- SQL is the right execution layer because the dataset is tabular, the joins are explicit, and the target questions are analytical in nature.

This design avoids forcing a graph database into a problem where the source data and the query workload already map cleanly to relational operations. The graph is therefore used as a business-facing context layer, while SQLite remains the authoritative query engine.

### Modular backend structure

The backend was structured by responsibility rather than by route count. This keeps the codebase easier to reason about and reduces coupling between graph logic, query orchestration, and infrastructure concerns.

- `server/routes/`
  HTTP entry points for graph, query, and system endpoints
- `server/services/`
  Business logic for graph construction, node expansion, node details, and LLM-driven query processing
- `server/config/`
  Prompt templates and LLM configuration
- `server/lib/`
  SQLite loading and query helpers

This separation is especially important in the query pipeline because prompting, SQL validation, execution, repair, and highlight derivation are distinct concerns.

### Componentized frontend

The React frontend is split into focused components rather than keeping graph rendering, chat behavior, and node inspection in a single file.

- `GraphPanel` owns Cytoscape rendering and graph controls
- `ChatPanel` owns message flow and input interactions
- `ChatMessage` renders assistant and user messages, SQL disclosure, and result previews
- `NodeDetailPanel` handles metadata inspection and node expansion
- `App.tsx` coordinates application state and async orchestration

This structure improves readability and keeps the UI code maintainable as graph interactions and query metadata become richer.

### Progressive graph expansion

Rendering the full dataset at once would reduce readability and make the graph difficult to use. Instead, the system starts with a curated, connected Order-to-Cash overview and supports incremental expansion.

This design improves:

- usability, because the initial graph remains legible
- performance, because only the required neighborhood is loaded
- answer explainability, because the UI can expand only the nodes needed to show the path behind a response

## Database Choice

### Why SQLite

SQLite was chosen because it matches the assignment constraints and the scale of the dataset.

- The dataset is modest enough to fit comfortably in an embedded relational database.
- Setup is simple and reproducible because no separate database server is required.
- SQL is expressive enough for the joins, aggregations, filtering, and process-trace queries required by the assignment.
- Local development and demo setup remain straightforward.

### Why `sql.js`

The project uses `sql.js` to load and execute SQLite in-process inside Node.js.

This choice keeps the backend lightweight while still using a real SQL engine. It also avoids environment-specific database installation steps, which helps with portability and reviewer setup.

### Why not a graph database

A graph database could represent the same domain, but it would add operational and implementation complexity without a proportionate benefit for this assignment. The graph in this project is a derived view used for exploration and explanation. The underlying data remains relational, and the core evaluation questions are answered more directly through SQL.

## Graph Model

The graph represents business entities as nodes and business process relationships as directed edges.

### Node types

- Customer
- Sales Order
- Delivery
- Billing Document
- Journal Entry
- Product
- Plant

### Relationship examples

- Customer -> Sales Order
- Sales Order -> Product
- Sales Order -> Delivery
- Delivery -> Billing Document
- Billing Document -> Journal Entry
- Delivery -> Plant

These relationships are derived from the foreign-key-like references already present in the dataset, for example:

- `sales_order_headers.sold_to_party`
- `outbound_delivery_items.reference_sd_document`
- `billing_document_items.reference_sd_document`
- `journal_entry_items.reference_document`
- `sales_order_items.material`
- `outbound_delivery_items.plant`

The graph therefore reflects the operational Order-to-Cash flow rather than an invented schema.

## LLM Prompting Strategy

The LLM layer is deliberately structured as a controlled pipeline rather than a single direct-answer prompt.

### Stage 1: Query planning

The first stage analyzes the user question and produces a structured query plan. The planner identifies:

- whether the question is in domain
- the likely intent
- referenced document identifiers
- relevant entities
- expected relationships
- aggregation or metric requirements

This intermediate representation makes the downstream SQL generation step more reliable and easier to debug.

### Stage 2: Natural language to SQL translation

The second stage converts the structured plan and conversation context into SQL. The prompt includes:

- the database schema
- key business relationships
- SQLite-specific guidance
- output formatting constraints
- domain restrictions

The model is instructed to return only raw SQL or the sentinel value `GUARDRAIL_REJECT`.

### Stage 3: SQL validation and repair

The generated SQL is validated before execution. The backend enforces:

- single-statement execution only
- `SELECT`-only queries
- no mutation or schema-altering operations

If validation fails or execution returns an error, the system runs a repair prompt that attempts to correct the query while preserving the original business intent. This makes the translation pipeline meaningfully stronger than a single-pass prompt.

### Stage 4: Grounded response generation

After the SQL succeeds, a separate prompt converts the executed SQL and returned rows into a concise business-facing answer. This stage is isolated from SQL generation so that phrasing and analysis remain grounded in the dataset output.

### Why this design was chosen

The multi-stage prompting strategy was chosen for four reasons:

- reliability, because planning and repair reduce brittle query generation
- transparency, because the generated SQL can be inspected
- grounding, because the answer is based on executed results
- maintainability, because each stage has a single responsibility

## Guardrails

Guardrails were implemented as a layered system rather than a single prompt instruction.

### 1. Planner-level domain restriction

The planning prompt determines whether the request belongs to the SAP Order-to-Cash domain. If the request is unrelated, the backend returns a refusal without entering the SQL pipeline.

### 2. SQL-generation sentinel

The SQL prompt is instructed to return `GUARDRAIL_REJECT` for out-of-domain requests. This creates a second independent guardrail in addition to the planner.

### 3. Execution safety checks

Even if the model produces syntactically valid SQL, the backend still enforces:

- `SELECT` only
- one statement only
- no destructive or schema-modifying keywords

This ensures the model cannot execute unsafe operations against the dataset.

### 4. Domain-scoped user feedback

Rejected prompts return a consistent message explaining that the system is restricted to SAP Order-to-Cash data. This keeps the product behavior aligned with the assignment requirement and avoids ambiguous failures.

## Highlighting Nodes Referenced in Responses

The graph-highlighting behavior is designed to explain answers visually, not just decorate the UI.

- The backend extracts candidate entities from the query plan, generated SQL, and result rows.
- It expands the relevant graph neighborhoods server-side and computes relationship paths between referenced entities.
- The response includes `highlightNodes`, `highlightEdges`, and a `focusNodeId`.
- The frontend ensures the required nodes exist in the current graph, merges the expansion payload, and highlights the exact relationship path in Cytoscape.

This means a trace-style answer can highlight both the documents involved and the edges that connect them.

## API Summary

### `GET /graph`

Returns the initial connected graph payload used for the overview visualization.

### `GET /graph/expand/:nodeId`

Returns neighboring nodes and edges for progressive exploration.

### `GET /node/:nodeId`

Returns raw node metadata and related records for the detail panel.

### `POST /query`

Accepts a natural-language question and returns:

- natural-language answer
- generated SQL
- result rows
- total row count
- highlighted node IDs
- highlighted edge IDs
- focus node ID
- guardrail metadata
- query plan and SQL-attempt metadata for traceability

## Project Structure

```text
graphiq/
  client/
    src/
      components/
        AppHeader.tsx
        ChatMessage.tsx
        ChatPanel.tsx
        GraphPanel.tsx
        NodeDetailPanel.tsx
      constants/
        graph.ts
      services/
        api.ts
      types/
        app.ts
      utils/
        graph.ts
      App.tsx
      index.css
      main.tsx
      react-cytoscapejs.d.ts
  server/
    config/
      llm.js
      prompts.js
    lib/
      db-instance.js
      sql.js
    routes/
      graph-routes.js
      query-routes.js
      system-routes.js
    services/
      graph-expansion-service.js
      graph-helpers.js
      graph-overview-service.js
      node-detail-service.js
      query-service.js
      system-service.js
    app.js
    index.js
    ingest.js
    graphiq.db
  dataset/
    sap-data/
      sap-o2c-data/
  README.md
```

## Local Setup

### Prerequisites

- Node.js 18 or higher
- A Groq API key

### 1. Place the dataset

Extract the SAP Order-to-Cash dataset under:

```text
dataset/sap-data/sap-o2c-data/
```

### 2. Install server dependencies

```bash
cd server
npm install
```

Create `server/.env` with:

```env
GROQ_API_KEY=your_api_key_here
```

### 3. Ingest the data

```bash
npm run ingest
```

### 4. Start the backend

```bash
npm run dev
```

### 5. Install and start the frontend

```bash
cd ../client
npm install
npm run dev
```

The frontend runs on the Vite development server and communicates with the Express backend on port `3001`.

## Production Deployment

This project's separation of concerns automatically scales well when the services are hosted independently.

### 1. Deploy the Backend (Render)
We have included a `render.yaml` Blueprint which streamlines the backend configuration:
1. Push your GraphIQ repository code (including `server/graphiq.db`) to a GitHub repository.
2. Log into [Render](https://render.com/), choose "New", then "Blueprint".
3. Point it to your repository, and it will automatically detect the `render.yaml` spec.
4. **Important**: Go to the "Environment" settings on your newly created Render service, and assign your actual `GROQ_API_KEY`.
5. Your service will now be live on an auto-generated Render domain (e.g., `https://graphiq-server.onrender.com`).

### 2. Deploy the Frontend (Vercel)
Vercel handles fast Edge deployments for Vite Apps natively:
1. Go to [Vercel](https://vercel.com/) and click "Add New... Project".
2. Select your GraphIQ repository.
3. In the "Configure Project" screen, change the **Root Directory** to `client` and hit "Edit" and confirm.
4. Expand the **Environment Variables** section and add:
   - Key: `VITE_API_URL`
   - Value: `https://graphiq-server.onrender.com` (use whatever domain Render assigned your backend)
5. Click **Deploy**. Vercel will install the React dependencies and build the `dist` UI.

## Tradeoffs and Limitations

- The initial graph is intentionally selective rather than exhaustive to preserve readability.
- Query quality still depends on model quality, even though planning, validation, and repair improve reliability.
- Conversation memory is currently in-process and session-scoped rather than persistent.
- Guardrails are strong for this assignment, but a production system would add stronger policy enforcement and observability.

