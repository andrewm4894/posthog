# LLM Analytics Data Models & Schema

## Event Schema Reference

### Core AI Events

All LLM Analytics events are stored in the standard ClickHouse `events` table with specialized properties.

---

## Event Type: `$ai_trace`

**Purpose**: Top-level container for an LLM workflow or conversation.

### Required Properties
```typescript
{
  "$ai_trace_id": string      // Unique trace identifier
}
```

### Optional Properties
```typescript
{
  "$ai_input_state": string | object    // Initial input/context (can be S3 URL)
  "$ai_output_state": string | object   // Final output/result (can be S3 URL)
  "$ai_trace_name": string              // Human-readable trace name
  "$ai_metadata": object                // Custom metadata
}
```

### Example Event
```json
{
  "event": "$ai_trace",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:30:00Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_trace_name": "Customer Support Chat",
    "$ai_input_state": "s3://bucket/llma/team123/2024-01-15/trace-abc-123_input.json",
    "$ai_output_state": "s3://bucket/llma/team123/2024-01-15/trace-abc-123_output.json",
    "$ai_metadata": {
      "user_id": "user_123",
      "session_id": "session_456"
    }
  }
}
```

---

## Event Type: `$ai_span`

**Purpose**: Represents a sub-operation within a trace (e.g., retrieval, processing, tool call).

### Required Properties
```typescript
{
  "$ai_trace_id": string,         // Parent trace ID
  "$ai_span_id": string           // Unique span identifier
}
```

### Optional Properties
```typescript
{
  "$ai_parent_span_id": string,   // Parent span (for nested spans)
  "$ai_span_name": string,        // Span name (e.g., "document_retrieval")
  "$ai_input_state": string | object,
  "$ai_output_state": string | object,
  "$ai_latency": number,          // Duration in seconds
  "$ai_metadata": object
}
```

### Example Event
```json
{
  "event": "$ai_span",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:30:05Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_span_id": "span-retrieval-1",
    "$ai_span_name": "document_retrieval",
    "$ai_latency": 0.45,
    "$ai_input_state": {
      "query": "What is our refund policy?",
      "top_k": 5
    },
    "$ai_output_state": {
      "documents": [/* ... */],
      "count": 5
    }
  }
}
```

---

## Event Type: `$ai_generation`

**Purpose**: Records an actual LLM API call/completion.

### Required Properties
```typescript
{
  "$ai_trace_id": string,
  "$ai_model": string             // Model identifier (e.g., "gpt-4", "claude-3-opus")
}
```

### Optional Properties
```typescript
{
  "$ai_parent_span_id": string,
  "$ai_generation_id": string,
  
  // Input/Output (can be inline or S3 URLs)
  "$ai_input": Array<Message> | string,
  "$ai_output_choices": Array<Choice> | string,
  
  // Tokens
  "$ai_input_tokens": number,
  "$ai_output_tokens": number,
  "$ai_total_tokens": number,
  "$ai_cached_tokens": number,    // For providers that support caching
  
  // Timing
  "$ai_latency": number,           // Total latency in seconds
  "$ai_time_to_first_token": number, // TTFT in seconds
  
  // Cost
  "$ai_input_cost_usd": number,
  "$ai_output_cost_usd": number,
  "$ai_total_cost_usd": number,
  
  // Model Parameters
  "$ai_temperature": number,
  "$ai_max_tokens": number,
  "$ai_top_p": number,
  "$ai_frequency_penalty": number,
  "$ai_presence_penalty": number,
  
  // Tool Calling
  "$ai_tools": Array<Tool>,
  "$ai_tool_calls": Array<ToolCall>,
  
  // Metadata
  "$ai_provider": string,          // "openai", "anthropic", "gemini"
  "$ai_metadata": object
}
```

### Message Format
```typescript
interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string | Array<ContentPart>
  name?: string
  tool_calls?: Array<ToolCall>
  tool_call_id?: string
}
```

### Example Event
```json
{
  "event": "$ai_generation",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:30:10Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_parent_span_id": "span-retrieval-1",
    "$ai_model": "gpt-4",
    "$ai_provider": "openai",
    
    "$ai_input": "s3://bucket/llma/team123/2024-01-15/gen-xyz-789_input.json",
    "$ai_output_choices": "s3://bucket/llma/team123/2024-01-15/gen-xyz-789_output.json",
    
    "$ai_input_tokens": 1500,
    "$ai_output_tokens": 800,
    "$ai_total_tokens": 2300,
    
    "$ai_latency": 2.3,
    "$ai_time_to_first_token": 0.4,
    
    "$ai_input_cost_usd": 0.015,
    "$ai_output_cost_usd": 0.024,
    "$ai_total_cost_usd": 0.039,
    
    "$ai_temperature": 0.7,
    "$ai_max_tokens": 1000
  }
}
```

---

## Event Type: `$ai_embedding`

**Purpose**: Records vector embedding generation.

### Required Properties
```typescript
{
  "$ai_trace_id": string,
  "$ai_model": string             // Embedding model (e.g., "text-embedding-3-small")
}
```

### Optional Properties
```typescript
{
  "$ai_parent_span_id": string,
  "$ai_input": string | Array<string>,  // Text(s) to embed
  "$ai_input_tokens": number,
  "$ai_latency": number,
  "$ai_total_cost_usd": number,
  "$ai_dimensions": number,       // Embedding dimensions
  "$ai_provider": string
}
```

### Example Event
```json
{
  "event": "$ai_embedding",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:30:02Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_model": "text-embedding-3-small",
    "$ai_provider": "openai",
    "$ai_input": ["What is your refund policy?"],
    "$ai_input_tokens": 7,
    "$ai_dimensions": 1536,
    "$ai_latency": 0.12,
    "$ai_total_cost_usd": 0.000001
  }
}
```

---

## Event Type: `$ai_metric`

**Purpose**: Custom metrics for LLM operations (e.g., similarity scores, confidence).

### Required Properties
```typescript
{
  "$ai_trace_id": string,
  "$ai_metric_name": string,
  "$ai_metric_value": number
}
```

### Optional Properties
```typescript
{
  "$ai_parent_span_id": string,
  "$ai_metric_unit": string,      // "score", "percentage", etc.
  "$ai_metadata": object
}
```

### Example Event
```json
{
  "event": "$ai_metric",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:30:15Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_metric_name": "similarity_score",
    "$ai_metric_value": 0.87,
    "$ai_metric_unit": "score",
    "$ai_metadata": {
      "method": "cosine"
    }
  }
}
```

---

## Event Type: `$ai_feedback`

**Purpose**: User feedback on LLM outputs.

### Required Properties
```typescript
{
  "$ai_trace_id": string,
  "$ai_feedback_type": string,    // "thumbs_up", "thumbs_down", "rating", "comment"
}
```

### Optional Properties
```typescript
{
  "$ai_feedback_value": number | string,  // Rating value or comment
  "$ai_feedback_target": string,          // Specific generation/span ID
  "$ai_metadata": object
}
```

### Example Event
```json
{
  "event": "$ai_feedback",
  "distinct_id": "user_123",
  "timestamp": "2024-01-15T10:35:00Z",
  "properties": {
    "$ai_trace_id": "trace-abc-123",
    "$ai_feedback_type": "thumbs_up",
    "$ai_feedback_value": 1,
    "$ai_metadata": {
      "comment": "Very helpful response"
    }
  }
}
```

---

## PostgreSQL Models

### Dataset Model

**Table**: `llm_analytics_dataset`

```python
class Dataset(UUIDModel, CreatedMetaFields, UpdatedMetaFields, DeletedMetaFields):
    id = UUID                    # Primary key
    team = ForeignKey(Team)      # Team ownership
    name = CharField(max_length=400)
    description = TextField(null=True, blank=True)
    metadata = JSONField(null=True, blank=True)
    created_at = DateTime
    updated_at = DateTime
    deleted_at = DateTime(null=True)
```

**Indexes**:
- `(team, created_at DESC, id)` - List datasets by team
- `(team, updated_at DESC, id)` - Recently updated
- GIN index on `name` (trigram search)
- GIN index on `description` (trigram search)

### DatasetItem Model

**Table**: `llm_analytics_datasetitem`

```python
class DatasetItem(UUIDModel, CreatedMetaFields, UpdatedMetaFields, DeletedMetaFields):
    id = UUID                    # Primary key
    dataset = ForeignKey(Dataset, related_name="items")
    team = ForeignKey(Team)
    
    # Data
    input = JSONField(null=True, blank=True)
    output = JSONField(null=True, blank=True)
    metadata = JSONField(null=True, blank=True)
    
    # Reference to source trace
    ref_trace_id = CharField(max_length=255, null=True)
    ref_timestamp = DateTime(null=True)
    ref_source_id = CharField(max_length=255, null=True)
    
    created_at = DateTime
    updated_at = DateTime
    deleted_at = DateTime(null=True)
```

**Indexes**:
- `(team, dataset, created_at DESC, id)` - List items in dataset
- `(team, dataset, updated_at DESC, id)` - Recently updated items

---

## HogQL Schema Types

### TracesQuery

```typescript
interface TracesQuery {
  kind: NodeKind.TRACES_QUERY
  dateRange?: DateRange
  properties?: AnyPropertyFilter[]
  limit?: number
  offset?: number
  orderBy?: string[]
}
```

### TracesQueryResponse

```typescript
interface TracesQueryResponse {
  results: LLMTrace[]
  columns: string[]
  hasMore?: boolean
  limit?: number
  offset?: number
  timings?: QueryTiming[]
}
```

### LLMTrace

```typescript
interface LLMTrace {
  id: string                    // Trace ID
  createdAt: string            // ISO timestamp
  person: LLMTracePerson
  
  // Aggregated metrics
  totalLatency?: number
  inputTokens?: number
  outputTokens?: number
  inputCost?: number
  outputCost?: number
  totalCost?: number
  
  // Trace data
  inputState?: any
  outputState?: any
  traceName?: string
  
  // Related events
  events: LLMTraceEvent[]
}
```

### LLMTraceEvent

```typescript
interface LLMTraceEvent {
  uuid: string
  event: string                 // Event type
  timestamp: string
  properties: Record<string, any>
  
  // For tree building
  spanId?: string
  parentSpanId?: string
}
```

### LLMTracePerson

```typescript
interface LLMTracePerson {
  distinct_id: string
  properties?: Record<string, any>
}
```

---

## S3 Blob Storage Schema

### Object Path Structure

```
s3://{bucket}/llma/{retention}/{team_id}/{date}/{event_id}_{random}.multipart
```

Example:
```
s3://posthog-llm-analytics/llma/30d/123/2024-01-15/gen-xyz-789_a3b5c7.multipart
```

### Multipart File Format

Each S3 object contains multiple blobs in multipart/mixed format:

```
Content-Type: multipart/mixed; boundary=----PostHogBlobBoundary

------PostHogBlobBoundary
Content-Disposition: form-data; name="$ai_input"
Content-Type: application/json
Content-Encoding: gzip
Content-Range: bytes 0-50000/50000

[Gzipped JSON data]

------PostHogBlobBoundary
Content-Disposition: form-data; name="$ai_output_choices"
Content-Type: application/json
Content-Range: bytes 50001-75000/25000

[JSON data]

------PostHogBlobBoundary--
```

### S3 Object Metadata

```json
{
  "team_id": "123",
  "event_id": "gen-xyz-789",
  "upload_timestamp": "2024-01-15T10:30:10Z",
  "content_type": "multipart/mixed",
  "blob_count": "2",
  "total_size": "75000"
}
```

### S3 URL Format in Events

Properties reference S3 blobs with byte range parameters:

```json
{
  "$ai_input": "s3://bucket/llma/123/2024-01-15/gen-xyz-789_a3b5c7.multipart?range=0-50000",
  "$ai_output_choices": "s3://bucket/llma/123/2024-01-15/gen-xyz-789_a3b5c7.multipart?range=50001-75000"
}
```

---

## ClickHouse Optimizations

### Materialized Columns

```sql
-- Auto-extract trace ID for faster filtering
ALTER TABLE events 
ADD COLUMN mat_$ai_trace_id String 
MATERIALIZED JSONExtractString(properties, '$ai_trace_id');

-- Index for fast trace lookups
ALTER TABLE events 
ADD INDEX idx_ai_trace_id mat_$ai_trace_id 
TYPE bloom_filter(0.001) GRANULARITY 1;
```

### Common Query Patterns

**Get all events for a trace**:
```sql
SELECT *
FROM events
WHERE team_id = 123
  AND mat_$ai_trace_id = 'trace-abc-123'
ORDER BY timestamp ASC
```

**Aggregate trace metrics**:
```sql
SELECT 
  mat_$ai_trace_id as trace_id,
  min(timestamp) as created_at,
  sum(toFloat64OrNull(JSONExtractString(properties, '$ai_latency'))) as total_latency,
  sum(toInt64OrNull(JSONExtractString(properties, '$ai_input_tokens'))) as input_tokens,
  sum(toInt64OrNull(JSONExtractString(properties, '$ai_output_tokens'))) as output_tokens,
  sum(toFloat64OrNull(JSONExtractString(properties, '$ai_total_cost_usd'))) as total_cost
FROM events
WHERE team_id = 123
  AND event = '$ai_generation'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY trace_id
ORDER BY created_at DESC
```

---

## Data Validation Rules

### Trace Hierarchy

1. Every `$ai_generation`, `$ai_span`, `$ai_embedding` must have a `$ai_trace_id`
2. A `$ai_span` can reference a parent via `$ai_parent_span_id`
3. A `$ai_generation` can reference a parent span via `$ai_parent_span_id`
4. Circular references are not allowed

### Token Counts

1. `$ai_total_tokens` should equal `$ai_input_tokens + $ai_output_tokens`
2. All token counts must be non-negative integers
3. Token counts are optional but recommended for cost tracking

### Cost Calculations

1. `$ai_total_cost_usd` should equal `$ai_input_cost_usd + $ai_output_cost_usd`
2. Costs are calculated using provider-specific pricing tables
3. Costs are in USD and must be non-negative floats

### S3 URLs

1. Must start with `s3://`
2. Must include byte range parameter: `?range=start-end`
3. Path must follow team isolation pattern: `llma/{team_id}/...`

---

## Migration & Evolution

### Schema Versioning

Event schemas are versioned implicitly through property presence:
- v1: Basic properties (`$ai_model`, `$ai_input`, etc.)
- v2: Added `$ai_cached_tokens` for caching support
- v3: Added `$ai_time_to_first_token` for TTFT tracking

### Backward Compatibility

- Old events without new properties continue to work
- Query runners handle missing properties gracefully
- Frontend displays "N/A" for missing data

### Future Schema Changes

Planned additions:
- Multimodal content types (images, audio, video)
- Advanced tool calling metadata
- Chain-of-thought reasoning traces
- Model-specific extended properties

