# LLM Analytics Testing Guide

## Overview

Testing LLM Analytics involves multiple layers: Rust capture service, Python backend query runners, and TypeScript frontend logic. This guide covers all test types and how to run them.

---

## Test Categories

### 1. Backend Python Tests

#### Query Runner Tests
**Location**: `posthog/hogql_queries/ai/test/`

Tests for HogQL query execution and result mapping:

```bash
# All LLM Analytics query tests
pytest posthog/hogql_queries/ai/test/

# Specific test files
pytest posthog/hogql_queries/ai/test/test_traces_query_runner.py
pytest posthog/hogql_queries/ai/test/test_trace_query_runner.py
pytest posthog/hogql_queries/ai/test/test_team_taxonomy_query_runner.py
pytest posthog/hogql_queries/ai/test/test_vector_search_query_runner.py
```

**Key Test Files**:
- `test_traces_query_runner.py` - Tests trace list queries, filtering, pagination
- `test_trace_query_runner.py` - Tests single trace detail queries with event trees
- `test_team_taxonomy_query_runner.py` - Tests property definitions and schemas
- `test_vector_search_query_runner.py` - Tests semantic search functionality

**Snapshot Testing**:
Query tests use `@snapshot_postgres_queries` decorator to track SQL changes:
```python
from posthog.test.base import SnapshotBaseTestCase

class TestTracesQueryRunner(SnapshotBaseTestCase):
    @snapshot_postgres_queries
    def test_traces_query(self):
        # Test implementation
        # SQL snapshots stored in __snapshots__/
```

Snapshots are in: `posthog/hogql_queries/ai/test/__snapshots__/`

#### API Tests
**Location**: `products/llm_analytics/backend/api/test/`

```bash
# Dataset API tests
pytest products/llm_analytics/backend/api/test/test_datasets.py
```

Tests for:
- Dataset CRUD operations
- Dataset item management
- Access control and permissions
- Validation logic

#### Provider Tests
**Location**: `products/llm_analytics/backend/providers/test/`

```bash
# Gemini provider tests
pytest products/llm_analytics/backend/providers/test/test_gemini.py

# Tool handler tests
pytest products/llm_analytics/backend/providers/formatters/tools_handler/test/
```

Tests for:
- LLM API integrations (OpenAI, Anthropic, Gemini)
- Tool calling format conversion
- Streaming response handling
- Error scenarios

---

### 2. Frontend TypeScript Tests

#### Logic Tests (Kea)
**Location**: `products/llm_analytics/frontend/`

```bash
# Run all frontend tests for LLM Analytics
cd /path/to/posthog
pnpm --filter=@posthog/frontend test llm

# Specific test files
pnpm --filter=@posthog/frontend jest llmAnalyticsLogic.test.ts
pnpm --filter=@posthog/frontend jest llmAnalyticsTraceDataLogic.test.ts
pnpm --filter=@posthog/frontend jest llmAnalyticsPlaygroundLogic.test.ts
pnpm --filter=@posthog/frontend jest datasetItemModalLogic.test.ts
```

**Key Test Files**:
- `llmAnalyticsLogic.test.ts` - Main logic, queries, filters
- `llmAnalyticsTraceDataLogic.test.ts` - Trace data fetching, tree building
- `llmAnalyticsTraceLogic.test.ts` - Individual trace state
- `llmAnalyticsPlaygroundLogic.test.ts` - Playground interactions
- `llmAnalyticsDatasetsLogic.test.ts` - Dataset management
- `datasetItemModalLogic.test.ts` - Dataset item CRUD

#### Utility Tests

```bash
pnpm --filter=@posthog/frontend jest searchUtils.test.ts
pnpm --filter=@posthog/frontend jest traceExportUtils.test.ts
pnpm --filter=@posthog/frontend jest utils.test.ts
```

Tests for:
- Search/highlight functionality
- Trace export to JSON/CSV
- Data transformation utilities
- Message normalization

---

### 3. Rust Capture Service Tests

**Location**: `rust/capture/tests/`

```bash
# Run Rust tests
cd rust/capture
cargo test

# Run specific test
cargo test test_limiters
```

**Integration Test Suite**:
Documentation in `rust/capture/docs/llma-integration-test-suite.md`

Tests for:
- `/ai` endpoint multipart parsing
- S3 blob upload/download
- Kafka message publishing
- Authentication and authorization
- Error handling and retries

---

### 4. Integration Tests

#### Max AI Tools Tests
**Location**: `products/surveys/backend/test_max_tools.py`

```bash
pytest products/surveys/backend/test_max_tools.py -k llm
```

Tests Max AI's usage of LLM Analytics data.

#### Temporal Workflow Tests
**Location**: `posthog/temporal/tests/ai/`

```bash
pytest posthog/temporal/tests/ai/test_summarize_session.py
pytest posthog/temporal/tests/ai/test_summarize_session_group.py
```

Tests for AI-powered session summarization using LLM traces.

---

## Running Tests

### Prerequisites

#### Python Tests
```bash
# Activate development environment
flox activate  # or activate your venv

# Install dependencies (if needed)
uv sync

# Activate venv (if flox not available)
source .venv/bin/activate
```

#### Frontend Tests
```bash
# Ensure dependencies installed
pnpm install
```

#### Rust Tests
```bash
# Rust toolchain installed via flox or rustup
cd rust/capture
cargo build
```

### Common Test Commands

#### Run All LLMA Tests
```bash
# Python
pytest posthog/hogql_queries/ai/ products/llm_analytics/

# Frontend
pnpm --filter=@posthog/frontend test llm

# Rust
cd rust/capture && cargo test
```

#### Run Specific Test
```bash
# Python - single test method
pytest posthog/hogql_queries/ai/test/test_traces_query_runner.py::TestTracesQueryRunner::test_basic_query

# Frontend - single test file
pnpm --filter=@posthog/frontend jest llmAnalyticsLogic.test.ts

# Rust - single test
cd rust/capture && cargo test test_limiters::test_rate_limiting
```

#### Watch Mode (Frontend)
```bash
pnpm --filter=@posthog/frontend test --watch llm
```

#### Update Snapshots
```bash
# Python
pytest posthog/hogql_queries/ai/test/ --snapshot-update

# Frontend
pnpm --filter=@posthog/frontend test -u llm
```

---

## Test Data Setup

### Creating Test Traces

Python test helper:
```python
from posthog.test.base import APIBaseTest

class MyTest(APIBaseTest):
    def setUp(self):
        super().setUp()
        
        # Create trace event
        self._create_event(
            event="$ai_trace",
            distinct_id="user1",
            team=self.team,
            properties={
                "$ai_trace_id": "trace-123",
                "$ai_input_state": '{"messages": [...]}',
                "$ai_output_state": '{"result": "..."}',
            },
        )
        
        # Create generation event
        self._create_event(
            event="$ai_generation",
            distinct_id="user1",
            team=self.team,
            properties={
                "$ai_trace_id": "trace-123",
                "$ai_model": "gpt-4",
                "$ai_input": [{"role": "user", "content": "Hello"}],
                "$ai_output_choices": [{"message": {"role": "assistant", "content": "Hi"}}],
                "$ai_input_tokens": 10,
                "$ai_output_tokens": 5,
                "$ai_latency": 1.2,
                "$ai_total_cost_usd": 0.001,
            },
        )
```

### Mock Data in Frontend

```typescript
import { expectLogic } from 'kea-test-utils'
import { llmAnalyticsLogic } from './llmAnalyticsLogic'

describe('llmAnalyticsLogic', () => {
    it('loads traces', async () => {
        await expectLogic(llmAnalyticsLogic)
            .toMount()
            .toDispatchActions(['loadTraces'])
            .toMatchValues({
                traces: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'trace-123',
                        events: expect.any(Array),
                    }),
                ]),
            })
    })
})
```

---

## Test Coverage Areas

### Backend Query Runners

✅ **Covered**:
- Basic trace queries with filters
- Date range filtering with capture window
- Property filtering (event, person, group)
- Pagination and limits
- Event tree building
- Person mapping
- Cost calculations
- Token aggregation

❌ **Gaps**:
- S3 blob fetching (coming with capture implementation)
- Large payload handling
- Concurrent trace queries
- Cache invalidation edge cases

### Frontend Logic

✅ **Covered**:
- Basic state management
- Query building
- Filter interactions
- Trace tree construction
- Search/highlight logic
- Dataset CRUD

❌ **Gaps**:
- Large trace rendering performance
- S3 blob streaming
- Offline/error recovery
- Cross-tab state sync

### Rust Capture

✅ **Covered** (via integration test plan):
- Multipart parsing
- Authentication
- Rate limiting
- Basic Kafka publishing

❌ **Gaps** (not yet implemented):
- S3 upload integration tests
- Blob boundary collision detection
- Large payload stress tests
- Concurrent upload handling

---

## Writing New Tests

### Backend Query Test Template

```python
from posthog.hogql_queries.ai.traces_query_runner import TracesQueryRunner
from posthog.schema import TracesQuery, DateRange
from posthog.test.base import APIBaseTest, snapshot_postgres_queries

class TestMyFeature(APIBaseTest):
    @snapshot_postgres_queries
    def test_my_trace_query(self):
        # Setup: Create test events
        self._create_event(
            event="$ai_generation",
            team=self.team,
            distinct_id="user1",
            properties={
                "$ai_trace_id": "trace-1",
                "$ai_model": "gpt-4",
                # ... other properties
            },
        )
        
        # Execute: Run query
        query = TracesQuery(
            dateRange=DateRange(date_from="-7d"),
            # ... query config
        )
        runner = TracesQueryRunner(team=self.team, query=query)
        response = runner.calculate()
        
        # Assert: Check results
        assert len(response.results) == 1
        assert response.results[0].id == "trace-1"
```

### Frontend Logic Test Template

```typescript
import { expectLogic } from 'kea-test-utils'
import { myLogic } from './myLogic'

describe('myLogic', () => {
    let logic: ReturnType<typeof myLogic.build>

    beforeEach(() => {
        logic = myLogic()
        logic.mount()
    })

    it('handles my action', async () => {
        await expectLogic(logic)
            .toDispatchActions(['myAction'])
            .toMatchValues({
                myValue: 'expected',
            })
    })
})
```

### Rust Test Template

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_my_feature() {
        // Setup
        let config = Config::default();
        
        // Execute
        let result = my_function(&config).await;
        
        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap().value, expected_value);
    }
}
```

---

## Continuous Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Pushes to master
- Nightly builds

### Test Requirements

Before merging:
- ✅ All backend tests pass
- ✅ All frontend tests pass
- ✅ Rust tests pass
- ✅ Snapshots updated if SQL changed
- ✅ No linting errors
- ✅ TypeScript type checks pass

---

## Debugging Failed Tests

### Backend
```bash
# Run with verbose output
pytest -vv posthog/hogql_queries/ai/test/test_traces_query_runner.py

# Run with print statements
pytest -s posthog/hogql_queries/ai/test/test_traces_query_runner.py

# Run with debugger
pytest --pdb posthog/hogql_queries/ai/test/test_traces_query_runner.py
```

### Frontend
```bash
# Run with verbose output
pnpm --filter=@posthog/frontend jest --verbose llmAnalyticsLogic.test.ts

# Run single test
pnpm --filter=@posthog/frontend jest -t "loads traces" llmAnalyticsLogic.test.ts
```

### Rust
```bash
# Run with output
cargo test -- --nocapture

# Run with specific log level
RUST_LOG=debug cargo test
```

---

## Performance Testing

### Load Testing Queries

```python
import time
from posthog.hogql_queries.ai.traces_query_runner import TracesQueryRunner

def test_query_performance():
    start = time.time()
    
    # Create many events
    for i in range(1000):
        _create_event(...)
    
    # Run query
    runner = TracesQueryRunner(team=self.team, query=query)
    response = runner.calculate()
    
    elapsed = time.time() - start
    assert elapsed < 2.0, f"Query too slow: {elapsed}s"
```

### Frontend Performance

```typescript
import { performance } from 'perf_hooks'

it('renders large trace efficiently', () => {
    const start = performance.now()
    
    // Render component with 1000 events
    const { container } = render(<TraceView trace={largeTrace} />)
    
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000) // < 1s
})
```

---

## Test Utilities

### Useful Helper Functions

**Backend** (`posthog/hogql_queries/ai/test/test_utils.py`):
```python
def create_trace_with_events(team, trace_id, num_generations=3):
    """Create a complete trace with multiple generation events."""
    # Implementation
```

**Frontend** (`products/llm_analytics/frontend/__mocks__/`):
```typescript
// fullTrace.json - Complete mock trace data
import fullTrace from './__mocks__/fullTrace.json'
```

---

## Coverage Reports

### Backend Coverage
```bash
pytest --cov=posthog/hogql_queries/ai --cov=products/llm_analytics/backend
```

### Frontend Coverage
```bash
pnpm --filter=@posthog/frontend test --coverage llm
```

Target: **>80% coverage** for core logic, **>60%** for UI components

---

## Known Test Issues

1. **Flaky Tests**: Some temporal/async tests may be flaky
   - Use `@pytest.mark.flaky` decorator
   - Add appropriate waits/retries

2. **Snapshot Drift**: SQL snapshots may change with ClickHouse updates
   - Review diffs carefully
   - Update snapshots if changes are expected

3. **Mock Data**: Some tests rely on hardcoded UUIDs
   - Use factories or fixtures for better isolation
   - See `posthog/test/base.py` for patterns

