# LLM Analytics Developer Guide

## Getting Started

### Local Development Setup

1. **Start PostHog services**:
```bash
# Start full stack (includes ClickHouse, Kafka, Postgres, Redis)
./bin/start

# Or minimal stack
docker-compose -f docker-compose.dev-minimal.yml up
```

2. **Access LLM Analytics UI**:
   - Navigate to: `http://localhost:8000/llm-analytics`
   - Create a test project if needed
   - Get your project API key from settings

3. **Send test events**:
```python
# Using posthog-python SDK
import posthog

posthog.project_api_key = 'your-key'
posthog.host = 'http://localhost:8000'

# Capture a trace
posthog.capture(
    distinct_id='test-user',
    event='$ai_trace',
    properties={
        '$ai_trace_id': 'trace-123',
        '$ai_trace_name': 'Test Conversation',
    }
)

# Capture a generation
posthog.capture(
    distinct_id='test-user',
    event='$ai_generation',
    properties={
        '$ai_trace_id': 'trace-123',
        '$ai_model': 'gpt-4',
        '$ai_input': [{'role': 'user', 'content': 'Hello'}],
        '$ai_output_choices': [{'message': {'role': 'assistant', 'content': 'Hi there!'}}],
        '$ai_input_tokens': 10,
        '$ai_output_tokens': 5,
        '$ai_latency': 1.2,
        '$ai_total_cost_usd': 0.001,
    }
)
```

---

## Common Development Tasks

### Adding a New Event Property

1. **Define in schema** (`posthog/schema.py` or frontend schema):
```python
# Backend
class LLMTraceEvent(BaseModel):
    # ... existing fields
    my_new_property: Optional[str] = None
```

```typescript
// Frontend (frontend/src/queries/schema/schema-general.ts)
export interface LLMTraceEvent {
    // ... existing fields
    myNewProperty?: string
}
```

2. **Update query runner** (`posthog/hogql_queries/ai/traces_query_runner.py`):
```python
def _map_event(self, ...):
    return LLMTraceEvent(
        # ... existing mappings
        myNewProperty=properties.get('$ai_my_new_property'),
    )
```

3. **Update frontend display** (`products/llm_analytics/frontend/`):
```typescript
// Display in trace view
{event.myNewProperty && (
    <div>My Property: {event.myNewProperty}</div>
)}
```

4. **Add tests**:
```python
# posthog/hogql_queries/ai/test/test_traces_query_runner.py
def test_new_property(self):
    self._create_event(
        event="$ai_generation",
        properties={
            "$ai_trace_id": "trace-1",
            "$ai_my_new_property": "test-value",
        },
    )
    # ... assertions
```

### Adding a New Provider

1. **Create provider file** (`products/llm_analytics/backend/providers/my_provider.py`):
```python
from typing import Any, Generator
from .base import BaseProvider

class MyProviderConfig:
    SUPPORTED_MODELS = ["my-model-1", "my-model-2"]
    
    PRICING = {
        "my-model-1": {
            "input": 0.01,    # per 1M tokens
            "output": 0.03,
        },
    }

class MyProvider(BaseProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Initialize client
    
    def stream_completion(self, model: str, messages: list, **kwargs) -> Generator:
        # Implement streaming logic
        for chunk in self._stream_api_call(model, messages, **kwargs):
            yield self._format_chunk(chunk)
    
    def _format_chunk(self, chunk: Any) -> dict:
        # Convert provider chunk to standard format
        return {
            "type": "text",
            "text": chunk.get("content", ""),
        }
```

2. **Register in proxy** (`products/llm_analytics/backend/api/proxy.py`):
```python
from products.llm_analytics.backend.providers.my_provider import MyProvider, MyProviderConfig

class LLMProxyViewSet(viewsets.ViewSet):
    def _get_completion_provider(self, data: ProviderData):
        match data["model"]:
            # ... existing cases
            case model if model in MyProviderConfig.SUPPORTED_MODELS:
                return MyProvider(api_key=os.environ["MY_PROVIDER_API_KEY"])
```

3. **Add to models list**:
```python
@action(detail=False, methods=["GET"])
def models(self, request):
    model_list = [
        # ... existing providers
        *[{"id": m, "name": m, "provider": "MyProvider"} 
          for m in MyProviderConfig.SUPPORTED_MODELS],
    ]
    return Response(model_list)
```

4. **Add tests** (`products/llm_analytics/backend/providers/test/test_my_provider.py`):
```python
from products.llm_analytics.backend.providers.my_provider import MyProvider

class TestMyProvider(TestCase):
    def test_stream_completion(self):
        provider = MyProvider(api_key="test-key")
        chunks = list(provider.stream_completion(
            model="my-model-1",
            messages=[{"role": "user", "content": "Hello"}],
        ))
        assert len(chunks) > 0
```

### Adding a New Query Type

1. **Define query schema** (`posthog/schema.py`):
```python
class MyCustomQuery(BaseModel):
    kind: Literal[NodeKind.MY_CUSTOM_QUERY]
    dateRange: Optional[DateRange] = None
    properties: Optional[list[AnyPropertyFilter]] = None
    # ... custom parameters
```

2. **Create query runner** (`posthog/hogql_queries/ai/my_custom_query_runner.py`):
```python
from posthog.hogql_queries.query_runner import AnalyticsQueryRunner

class MyCustomQueryRunner(AnalyticsQueryRunner):
    query: MyCustomQuery
    
    def _calculate(self):
        # Build and execute query
        hogql_query = self._build_hogql_query()
        result = self.execute_hogql_query(hogql_query)
        return self._format_response(result)
    
    def _build_hogql_query(self) -> str:
        return """
            SELECT 
                -- your query here
            FROM events
            WHERE team_id = {team_id}
        """
    
    def _format_response(self, result):
        # Format results
        return {"results": result.results}
```

3. **Register in router** (`posthog/hogql_queries/query_runner.py`):
```python
def get_query_runner(query, team, ...):
    # ... existing cases
    case {"kind": NodeKind.MY_CUSTOM_QUERY}:
        from posthog.hogql_queries.ai.my_custom_query_runner import MyCustomQueryRunner
        return MyCustomQueryRunner(query=MyCustomQuery.model_validate(query), ...)
```

4. **Add frontend logic** (`products/llm_analytics/frontend/myCustomLogic.ts`):
```typescript
import { kea } from 'kea'
import { query } from '~/queries/query'
import { MyCustomQuery, NodeKind } from '~/queries/schema'

export const myCustomLogic = kea({
    actions: {
        loadData: true,
    },
    
    loaders: {
        data: {
            loadData: async () => {
                const response = await query<MyCustomQuery>({
                    kind: NodeKind.MY_CUSTOM_QUERY,
                    // ... query params
                })
                return response.results
            },
        },
    },
})
```

### Adding Frontend Visualizations

1. **Create component** (`products/llm_analytics/frontend/MyVisualization.tsx`):
```typescript
import { useValues } from 'kea'
import { llmAnalyticsLogic } from './llmAnalyticsLogic'

export function MyVisualization(): JSX.Element {
    const { traces, tracesLoading } = useValues(llmAnalyticsLogic)
    
    if (tracesLoading) {
        return <SpinnerOverlay />
    }
    
    return (
        <div className="space-y-4">
            {traces.map(trace => (
                <div key={trace.id} className="border rounded p-4">
                    <h3>{trace.traceName}</h3>
                    <p>Cost: ${trace.totalCost?.toFixed(4)}</p>
                </div>
            ))}
        </div>
    )
}
```

2. **Add to scene** (`products/llm_analytics/frontend/LLMAnalyticsScene.tsx`):
```typescript
import { MyVisualization } from './MyVisualization'

const tabs: LemonTab<string>[] = [
    // ... existing tabs
    {
        key: 'my-viz',
        label: 'My Visualization',
        content: <MyVisualization />,
        link: combineUrl(urls.llmAnalyticsMyViz(), searchParams).url,
    },
]
```

3. **Add route** (`products/llm_analytics/manifest.tsx`):
```typescript
routes: {
    // ... existing routes
    '/llm-analytics/my-viz': ['LLMAnalytics', 'llmAnalyticsMyViz'],
}
```

---

## Code Patterns & Best Practices

### Backend Query Patterns

**Efficient trace aggregation**:
```python
def _build_trace_aggregation_query(self):
    return """
        SELECT 
            mat_$ai_trace_id as trace_id,
            min(timestamp) as created_at,
            argMin(distinct_id, timestamp) as first_person_id,
            
            -- Aggregate from $ai_generation events
            sum(if(event = '$ai_generation', 
                toFloat64OrNull(JSONExtractString(properties, '$ai_latency')), 
                0)) as total_latency,
            
            sum(if(event = '$ai_generation',
                toInt64OrNull(JSONExtractString(properties, '$ai_input_tokens')),
                0)) as input_tokens,
            
            -- Get trace-level properties from $ai_trace event
            argMin(if(event = '$ai_trace',
                JSONExtractString(properties, '$ai_trace_name'),
                NULL), timestamp) as trace_name,
            
            -- Collect all events for the trace
            groupArray((uuid, event, timestamp, properties)) as events
            
        FROM events
        WHERE team_id = {team_id}
          AND mat_$ai_trace_id != ''
          AND timestamp >= {date_from}
          AND timestamp <= {date_to}
        GROUP BY trace_id
        ORDER BY created_at DESC
    """
```

**Property filtering**:
```python
def _apply_property_filters(self, base_query: str, filters: list) -> str:
    where_clauses = []
    
    for prop_filter in filters:
        expr = property_to_expr(prop_filter, team=self.team)
        where_clauses.append(f"({expr})")
    
    if where_clauses:
        combined = " AND ".join(where_clauses)
        base_query += f" AND {combined}"
    
    return base_query
```

### Frontend State Patterns

**Kea logic with query integration**:
```typescript
export const myLogic = kea<myLogicType>({
    path: ['products', 'llm_analytics', 'myLogic'],
    
    actions: {
        setFilters: (filters: PropertyFilter[]) => ({ filters }),
        loadData: true,
    },
    
    reducers: {
        filters: [
            [] as PropertyFilter[],
            {
                setFilters: (_, { filters }) => filters,
            },
        ],
    },
    
    loaders: ({ values }) => ({
        data: [
            null as MyData | null,
            {
                loadData: async () => {
                    const response = await query<MyQuery>({
                        kind: NodeKind.MY_QUERY,
                        properties: values.filters,
                        dateRange: values.dateFilter,
                    })
                    return response.results
                },
            },
        ],
    }),
    
    selectors: {
        processedData: [
            (s) => [s.data],
            (data): ProcessedData[] => {
                if (!data) return []
                return data.map(item => ({
                    ...item,
                    // Transform data
                }))
            },
        ],
    },
    
    events: ({ actions }) => ({
        afterMount: () => {
            actions.loadData()
        },
    }),
})
```

**Debounced search**:
```typescript
export const searchLogic = kea({
    actions: {
        setSearchQuery: (query: string) => ({ query }),
        performSearch: (query: string) => ({ query }),
    },
    
    reducers: {
        searchQuery: [
            '',
            {
                setSearchQuery: (_, { query }) => query,
            },
        ],
    },
    
    listeners: ({ actions }) => ({
        setSearchQuery: async ({ query }, breakpoint) => {
            await breakpoint(300) // Debounce 300ms
            actions.performSearch(query)
        },
        performSearch: ({ query }) => {
            // Perform search
        },
    }),
})
```

### Tree Building Patterns

**Build hierarchical trace tree**:
```typescript
interface TreeNode {
    event: LLMTraceEvent
    children: TreeNode[]
    depth: number
}

export function buildTraceTree(events: LLMTraceEvent[]): TreeNode[] {
    // Map events by their span ID
    const eventMap = new Map<string, TreeNode>()
    const roots: TreeNode[] = []
    
    // First pass: create nodes
    events.forEach(event => {
        const node: TreeNode = {
            event,
            children: [],
            depth: 0,
        }
        
        const spanId = event.properties.$ai_span_id || event.uuid
        eventMap.set(spanId, node)
    })
    
    // Second pass: build tree
    events.forEach(event => {
        const spanId = event.properties.$ai_span_id || event.uuid
        const parentSpanId = event.properties.$ai_parent_span_id
        const node = eventMap.get(spanId)!
        
        if (parentSpanId && eventMap.has(parentSpanId)) {
            const parent = eventMap.get(parentSpanId)!
            parent.children.push(node)
            node.depth = parent.depth + 1
        } else {
            roots.push(node)
        }
    })
    
    return roots
}
```

---

## Debugging Tips

### Backend Debugging

**Enable query logging**:
```python
# In query runner
import structlog
logger = structlog.get_logger(__name__)

def _calculate(self):
    query = self.to_query()
    logger.info("executing_query", query=query, team_id=self.team.id)
    result = self.execute_hogql_query(query)
    logger.info("query_result", rows=len(result.results))
    return result
```

**Debug HogQL**:
```python
# In Django shell
from posthog.models import Team
from posthog.hogql_queries.ai.traces_query_runner import TracesQueryRunner
from posthog.schema import TracesQuery, DateRange

team = Team.objects.get(pk=123)
query = TracesQuery(dateRange=DateRange(date_from="-7d"))
runner = TracesQueryRunner(team=team, query=query)

# Print generated HogQL
print(runner.to_query())

# Execute and inspect
response = runner.calculate()
print(response.results)
```

### Frontend Debugging

**Debug Kea logic**:
```typescript
// In browser console
import { llmAnalyticsLogic } from './llmAnalyticsLogic'

const logic = llmAnalyticsLogic()
logic.mount()

// Inspect values
console.log(logic.values)

// Dispatch actions
logic.actions.loadTraces()

// Subscribe to changes
logic.subscribe(values => {
    console.log('Updated:', values.traces)
})
```

**Debug queries**:
```typescript
// Add to component
useEffect(() => {
    console.log('Query:', query)
    console.log('Response:', response)
}, [query, response])
```

### Rust Debugging

**Enable debug logging**:
```bash
RUST_LOG=debug cargo run
```

**Debug multipart parsing**:
```rust
// In capture service
tracing::debug!("Received multipart request: {:?}", request.headers());
tracing::debug!("Blob count: {}", blobs.len());
```

---

## Performance Optimization

### Query Optimization

1. **Use materialized columns** for frequently filtered properties
2. **Limit result sets** - always use pagination
3. **Cache query results** - use Redis caching for expensive queries
4. **Optimize joins** - use `select_related` / `prefetch_related` in Django

### Frontend Optimization

1. **Lazy load blobs** - fetch S3 blobs only when user expands trace
2. **Virtualize lists** - use `react-window` for long lists
3. **Memoize expensive computations**:
```typescript
const processedData = useMemo(
    () => expensiveTransformation(data),
    [data]
)
```
4. **Debounce filters** - avoid rapid query execution

---

## Common Gotchas

1. **Trace ID consistency**: Always use the same `$ai_trace_id` across all events in a trace
2. **Timestamp ordering**: Events may arrive out of order; sort by timestamp in queries
3. **Cost calculation**: Ensure pricing is up to date; costs change frequently
4. **S3 permissions**: Verify IAM roles have read/write access to blob storage
5. **Blob size limits**: Be aware of multipart upload size limits
6. **Cache invalidation**: Clear Redis cache when schema changes
7. **Feature flags**: Check feature flags before accessing beta features

---

## Useful Commands

```bash
# Backend
pytest posthog/hogql_queries/ai/              # Run backend tests
pytest -k "trace" -vv                         # Run specific tests
./bin/start                                   # Start dev server

# Frontend  
pnpm --filter=@posthog/frontend test llm      # Run frontend tests
pnpm --filter=@posthog/frontend typescript:check  # Type check
pnpm --filter=@posthog/frontend format        # Format code

# Rust
cd rust/capture && cargo test                 # Run Rust tests
cd rust/capture && cargo clippy               # Lint
cd rust/capture && cargo fmt                  # Format

# Database
./manage.py shell                             # Django shell
./manage.py dbshell                           # PostgreSQL shell
```

---

## Resources

- **Docs**: https://posthog.com/docs/llm-analytics
- **Slack**: #team-llm-analytics (internal)
- **Architecture**: `rust/capture/docs/llma-capture-overview.md`
- **Schema**: See `LLMA_DATA_MODELS.md` in this repo

