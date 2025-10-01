# LLM Analytics (LLMA) Overview

## What is LLM Analytics?

LLM Analytics is PostHog's observability and analytics product for AI/LLM-powered applications. It captures, stores, and analyzes traces, generations, and metrics from language model interactions to help teams understand usage, performance, and costs.

## Core Concepts

### Event Types

LLM Analytics uses specialized event types prefixed with `$ai_`:

#### Events with Large Payloads (blob storage required)
- **`$ai_trace`** - Top-level execution trace
  - Properties: `$ai_input_state`, `$ai_output_state`, `$ai_trace_id`
  - Represents an entire LLM workflow or conversation
  
- **`$ai_span`** - Individual operation within a trace
  - Properties: `$ai_input_state`, `$ai_output_state`, `$ai_trace_id`, `$ai_parent_span_id`
  - Represents steps like retrieval, processing, or sub-calls
  
- **`$ai_generation`** - LLM model completion/generation
  - Properties: `$ai_input`, `$ai_output_choices`, `$ai_model`, `$ai_latency`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_total_cost_usd`
  - Core event for tracking actual LLM API calls (can contain 300k+ tokens)
  
- **`$ai_embedding`** - Vector embedding generation
  - Properties: `$ai_input`, `$ai_model`

#### Lightweight Events (standard pipeline)
- **`$ai_metric`** - Custom metrics (e.g., similarity scores, confidence)
- **`$ai_feedback`** - User feedback (thumbs up/down, ratings)

### Key Properties

- **`$ai_trace_id`** - Links related events together (trace, spans, generations)
- **`$ai_parent_span_id`** - Creates hierarchical relationships
- **`$ai_model`** - Model identifier (e.g., "gpt-4", "claude-3-opus")
- **`$ai_latency`** - Response time in seconds
- **`$ai_input_tokens`** / **`$ai_output_tokens`** - Token usage
- **`$ai_total_cost_usd`** - Calculated cost based on model pricing

## Architecture Components

### 1. Capture Layer (Rust)
**Location**: `rust/capture/`

The Rust capture service handles ingestion with a specialized `/ai` endpoint:

- **Multipart Request Handling**: Accepts events + binary blobs in single HTTP request
- **S3 Blob Storage**: Uploads large payloads (inputs/outputs) directly to S3
- **Event Transformation**: Replaces inline data with S3 URLs before Kafka
- **Authentication**: Validates API keys before processing

**Key Files**:
- `rust/capture/src/router.rs` - HTTP routing
- `rust/capture/src/v0_endpoint.rs` - Event processing
- `rust/capture/docs/llma-capture-overview.md` - Detailed architecture doc

**Data Flow**:
```
SDK → POST /ai (multipart) → Extract blobs → Upload to S3 → 
Replace with S3 URLs → Publish to Kafka → Standard ingestion pipeline
```

### 2. Backend Query Layer (Python/Django)
**Location**: `posthog/hogql_queries/ai/`, `products/llm_analytics/backend/`

Processes and queries LLM data using HogQL (PostHog's SQL-like query language):

**Query Runners**:
- `TracesQueryRunner` - Fetches and aggregates trace data
- `TracesQueryRunnerV2` - Optimized version with better performance
- `TraceQueryRunner` - Single trace details with full event tree
- `TeamTaxonomyQueryRunner` - Property definitions and schemas
- `VectorSearchQueryRunner` - Semantic search over traces/generations

**API Endpoints** (`products/llm_analytics/backend/api/`):
- `/api/llm_proxy/` - LLM proxy for playground feature
  - `POST /api/llm_proxy/completion` - Stream completions through PostHog
  - `GET /api/llm_proxy/models` - List available models
- `/api/datasets/` - Dataset CRUD operations
- `/api/dataset_items/` - Dataset item management

**Providers** (`products/llm_analytics/backend/providers/`):
- `openai.py` - OpenAI API integration
- `anthropic.py` - Anthropic/Claude integration
- `gemini.py` - Google Gemini integration
- `codestral.py` - Mistral Codestral for code completion
- `inkeep.py` - Inkeep documentation search

### 3. Frontend (React/TypeScript)
**Location**: `products/llm_analytics/frontend/`

**Main Scenes**:
- **Dashboard** (`LLMAnalyticsScene.tsx`) - Overview with tiles and charts
- **Traces** (`LLMAnalyticsTracesScene.tsx`) - List of all traces
- **Trace Detail** (`LLMAnalyticsTraceScene.tsx`) - Detailed trace view with tree
- **Generations** - Table of individual LLM calls
- **Users** - User-level analytics
- **Playground** (`LLMAnalyticsPlaygroundScene.tsx`) - Interactive LLM testing
- **Datasets** (`datasets/`) - Curated test/eval datasets

**Key Logic Files** (Kea state management):
- `llmAnalyticsLogic.tsx` - Main state, queries, filters
- `llmAnalyticsTraceLogic.ts` - Individual trace state
- `llmAnalyticsTraceDataLogic.ts` - Trace data fetching and tree building
- `llmAnalyticsPlaygroundLogic.ts` - Playground interactions

**Features**:
- Collapsible trace trees with hierarchical view
- Search/highlight within trace content
- Cost and latency visualization
- Export traces to datasets
- Conversation-style display for chat-based traces
- Real-time streaming in playground

### 4. Data Storage

**ClickHouse** (events table):
- Standard PostHog events table stores metadata
- Large payloads referenced via S3 URLs
- Indexed on `$ai_trace_id` for fast trace assembly
- Materialized columns for common properties

**S3** (blob storage):
- Bucket structure: `s3://bucket/llma/<team_id>/<YYYY-MM-DD>/<event_id>_<random>.multipart`
- Multipart format stores multiple blobs per event
- Byte-range parameters in URLs for efficient access
- Lifecycle policies for retention (default 30 days)

**PostgreSQL** (datasets):
- `Dataset` model - Collections for evaluation/testing
- `DatasetItem` model - Individual examples with input/output pairs
- Links to traces via `ref_trace_id`

## Data Flow Example

1. **Capture**: SDK sends trace event to `POST /ai`
   ```
   event: $ai_generation
   properties: { model: "gpt-4", ... }
   blob: $ai_input (500KB of chat history)
   blob: $ai_output_choices (200KB of response)
   ```

2. **Processing**: Capture service
   - Uploads blobs to S3
   - Replaces blobs with URLs in event
   - Sends to Kafka

3. **Storage**: Event stored in ClickHouse
   ```json
   {
     "event": "$ai_generation",
     "properties": {
       "$ai_input": "s3://bucket/llma/123/2024-01-15/event_456.multipart?range=0-500000",
       "$ai_output_choices": "s3://bucket/llma/123/2024-01-15/event_456.multipart?range=500001-700000",
       "$ai_model": "gpt-4",
       "$ai_latency": 2.3,
       "$ai_input_tokens": 1500,
       "$ai_output_tokens": 800,
       "$ai_total_cost_usd": 0.042
     }
   }
   ```

4. **Query**: Frontend requests trace
   - `TracesQueryRunner` queries ClickHouse
   - Fetches related events via `$ai_trace_id`
   - Frontend fetches blobs from S3 when needed
   - Builds hierarchical tree structure
   - Displays in trace view

## Key Integrations

### SDKs
LLM Analytics requires server-side SDKs with multipart upload support:
- Python SDK (posthog-python)
- Node.js SDK (posthog-node)
- Ruby SDK (posthog-ruby)

### LLM Frameworks
Integrations exist for popular frameworks:
- LangChain
- LlamaIndex
- OpenAI SDK
- Anthropic SDK

## Feature Flags

- `LLM_OBSERVABILITY_SHOW_INPUT_OUTPUT` - Show/hide full inputs/outputs
- `LLM_OBSERVABILITY_PLAYGROUND` - Enable playground tab
- `LLM_ANALYTICS_DATASETS` - Enable datasets feature

## Cost Tracking

Costs calculated using pricing tables:
- `products/llm_analytics/backend/providers/openai.py` - OpenAI pricing
- `products/llm_analytics/backend/providers/anthropic.py` - Anthropic pricing
- `products/llm_analytics/backend/providers/gemini.py` - Gemini pricing

Pricing is per-model and considers:
- Input tokens × input price per 1M tokens
- Output tokens × output price per 1M tokens
- Cached tokens (reduced rate for some providers)

## Documentation

- User docs: https://posthog.com/docs/llm-analytics
- Capture architecture: `rust/capture/docs/llma-capture-overview.md`
- Implementation plan: `rust/capture/docs/llma-capture-implementation-plan.md`
- Integration tests: `rust/capture/docs/llma-integration-test-suite.md`

