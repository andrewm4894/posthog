# LLM Analytics Learning Resources

Welcome to the LLM Analytics (LLMA) codebase! This directory contains comprehensive documentation to help you understand and contribute to PostHog's LLM observability features.

## 📚 Documentation Index

### [LLMA_OVERVIEW.md](./LLMA_OVERVIEW.md)
**Start here!** High-level overview of LLM Analytics:
- What is LLM Analytics and how it works
- Core concepts (traces, generations, spans)
- Main architectural components
- Event types and data flow
- Key integrations

### [LLMA_ARCHITECTURE.md](./LLMA_ARCHITECTURE.md)
Visual architecture diagrams and system design:
- Data flow diagrams (Mermaid)
- Component interactions
- Storage architecture (ClickHouse, S3, PostgreSQL)
- Frontend/backend structure
- Query execution flow

### [LLMA_DATA_MODELS.md](./LLMA_DATA_MODELS.md)
Complete data schema reference:
- Event schemas (`$ai_trace`, `$ai_generation`, etc.)
- Property definitions
- PostgreSQL models (Dataset, DatasetItem)
- S3 blob storage format
- ClickHouse optimizations

### [LLMA_CHANGELOG.md](./LLMA_CHANGELOG.md)
Recent evolution and changes (last 3 months):
- New features and improvements
- Performance optimizations
- Bug fixes
- Breaking changes
- Migration notes

### [LLMA_TESTING.md](./LLMA_TESTING.md)
Complete testing guide:
- Test categories (backend, frontend, Rust)
- How to run tests
- Writing new tests
- Test utilities and patterns
- Coverage requirements

### [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md)
Practical developer workflows:
- Local development setup
- Common tasks (add property, add provider, etc.)
- Code patterns and best practices
- Debugging tips
- Performance optimization

## 🚀 Quick Start for New Developers

### 1. Understand the System (30 min)
1. Read [LLMA_OVERVIEW.md](./LLMA_OVERVIEW.md) - Get the big picture
2. Review [LLMA_ARCHITECTURE.md](./LLMA_ARCHITECTURE.md) - Visual understanding
3. Skim [LLMA_DATA_MODELS.md](./LLMA_DATA_MODELS.md) - Event structure

### 2. Set Up Your Environment (15 min)
Follow the setup guide in [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md):
```bash
# Start PostHog
./bin/start

# Access UI
open http://localhost:8000/llm-analytics

# Send test event (Python)
python -c "
import posthog
posthog.project_api_key = 'your-key'
posthog.host = 'http://localhost:8000'
posthog.capture('test-user', '$ai_generation', {
    '\$ai_trace_id': 'test-trace',
    '\$ai_model': 'gpt-4',
})
"
```

### 3. Explore the Codebase (30 min)
Key files to review:
- `products/llm_analytics/frontend/LLMAnalyticsScene.tsx` - Main UI
- `posthog/hogql_queries/ai/traces_query_runner.py` - Query logic
- `rust/capture/docs/llma-capture-overview.md` - Capture architecture

### 4. Run Tests (10 min)
```bash
# Backend
pytest posthog/hogql_queries/ai/test/test_traces_query_runner.py

# Frontend
pnpm --filter=@posthog/frontend jest llmAnalyticsLogic.test.ts

# Rust
cd rust/capture && cargo test
```

## 📂 Codebase Structure

### Backend (Python/Django)
```
posthog/hogql_queries/ai/          # AI-related query runners
├── traces_query_runner.py         # Main trace queries (LLMA)
├── trace_query_runner.py          # Single trace details (LLMA)
├── team_taxonomy_query_runner.py  # Schema/properties (LLMA)
├── suggested_questions_query_runner.py  # AI analysis suggestions
├── session_batch_events_query_runner.py # Session event batching
└── vector_search_query_runner.py  # Semantic search (for actions, not LLMA)

products/llm_analytics/backend/     # Django app
├── api/                           # REST API endpoints
│   ├── proxy.py                   # LLM proxy (playground)
│   └── datasets.py                # Dataset CRUD
├── models/                        # PostgreSQL models
│   └── datasets.py                # Dataset/DatasetItem
└── providers/                     # LLM provider integrations
    ├── openai.py
    ├── anthropic.py
    └── gemini.py
```

### Frontend (React/TypeScript)
```
products/llm_analytics/frontend/
├── LLMAnalyticsScene.tsx          # Main scene (tabs)
├── LLMAnalyticsTraceScene.tsx     # Trace detail view
├── llmAnalyticsLogic.tsx          # Main state/queries
├── llmAnalyticsTraceDataLogic.ts  # Trace data/tree
├── LLMAnalyticsPlaygroundScene.tsx # Playground
└── datasets/                      # Dataset management
```

### Capture (Rust)
```
rust/capture/
├── src/
│   ├── router.rs                  # HTTP routing
│   ├── v0_endpoint.rs             # Event processing
│   └── sinks/                     # Kafka/S3 output
└── docs/
    ├── llma-capture-overview.md   # Architecture
    └── llma-capture-implementation-plan.md
```

## 🔑 Key Concepts

### Trace Hierarchy
```
$ai_trace (top-level workflow)
  ├── $ai_span (sub-operation)
  │   ├── $ai_generation (LLM call)
  │   └── $ai_generation (LLM call)
  ├── $ai_span (another operation)
  │   └── $ai_embedding (vector creation)
  └── $ai_feedback (user feedback)
```

### Data Flow
```
SDK → /ai endpoint → S3 (blobs) → Kafka → ClickHouse
                                              ↓
                              Frontend ← Query Runner
                                              ↓
                                       S3 (fetch blobs)
```

### Event Properties
- **Trace**: `$ai_trace_id`, `$ai_trace_name`
- **Generation**: `$ai_model`, `$ai_input`, `$ai_output_choices`, `$ai_latency`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_total_cost_usd`
- **Span**: `$ai_span_id`, `$ai_parent_span_id`

## 🛠️ Common Tasks

### Add a New Event Property
1. Update schema in `posthog/schema.py`
2. Update query runner mapping
3. Update frontend types
4. Add to UI display
5. Write tests

**See**: [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md#adding-a-new-event-property)

### Add a New LLM Provider
1. Create provider class in `products/llm_analytics/backend/providers/`
2. Add pricing configuration
3. Register in `LLMProxyViewSet`
4. Add to models list
5. Write tests

**See**: [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md#adding-a-new-provider)

### Debug a Query
1. Enable logging in query runner
2. Use Django shell to test query
3. Check HogQL output
4. Verify ClickHouse execution plan

**See**: [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md#debugging-tips)

## 📊 Feature Status

### ✅ Production Ready
- Trace capture and display
- Multi-provider support (OpenAI, Anthropic, Gemini)
- Cost tracking
- Token usage analytics
- Playground for testing
- Datasets for evaluation

### 🚧 In Development
- S3 blob storage for large payloads (capture service)
- Multipart upload protocol
- Evaluation service
- Advanced analytics

### 🔮 Planned
- Multimodal support (images, audio, video)
- Auto-instrumentation SDKs
- A/B testing for prompts
- Anomaly detection

## 🧪 Testing

### Run All Tests
```bash
# Backend
pytest posthog/hogql_queries/ai/ products/llm_analytics/

# Frontend
pnpm --filter=@posthog/frontend test llm

# Rust
cd rust/capture && cargo test
```

### Coverage Requirements
- Backend: >80% for core logic
- Frontend: >60% for UI components
- Rust: >70% for capture service

**See**: [LLMA_TESTING.md](./LLMA_TESTING.md)

## 📈 Performance

### Query Optimization
- Use materialized columns (`mat_$ai_trace_id`)
- Implement pagination (limit/offset)
- Cache expensive queries (Redis)
- Optimize aggregations (ClickHouse)

### Frontend Optimization
- Lazy load S3 blobs
- Virtualize long lists
- Debounce filters
- Memoize computations

**See**: [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md#performance-optimization)

## 🐛 Known Issues & Gotchas

1. **Trace ID consistency**: Must be identical across all events
2. **Event ordering**: Handle out-of-order arrivals
3. **Cost accuracy**: Keep pricing tables updated
4. **S3 permissions**: Verify IAM roles
5. **Cache invalidation**: Clear Redis on schema changes

**See**: [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md#common-gotchas)

## 📝 Recent Changes

### December 2024
- Performance optimizations for traces query
- Updated LLM costs for all providers
- Capture architecture planning (S3 blobs)
- UX improvements (sticky trace tree, back button)

### November 2024
- Datasets feature for evaluation
- Conversation display mode
- Cross-provider tool calling
- Query performance improvements

### October 2024
- Renamed from "LLM Observability" to "LLM Analytics"
- Removed beta tag (general availability)
- Added quota limiting

**See**: [LLMA_CHANGELOG.md](./LLMA_CHANGELOG.md) for details

## 🤝 Contributing

### Before You Start
1. Read this README
2. Review [LLMA_OVERVIEW.md](./LLMA_OVERVIEW.md)
3. Set up local environment
4. Run existing tests

### Making Changes
1. Write tests first (TDD)
2. Update documentation
3. Follow code patterns in [LLMA_DEV_GUIDE.md](./LLMA_DEV_GUIDE.md)
4. Update snapshots if needed
5. Ensure all tests pass

### Code Review Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Snapshots reviewed
- [ ] Performance considered
- [ ] Security implications reviewed

## 📚 Additional Resources

### External Docs
- User documentation: https://posthog.com/docs/llm-analytics
- API reference: https://posthog.com/docs/api
- HogQL guide: https://posthog.com/docs/hogql

### Internal Docs
- `rust/capture/docs/llma-capture-overview.md` - Detailed capture architecture
- `rust/capture/docs/llma-capture-implementation-plan.md` - Implementation roadmap
- `rust/capture/docs/llma-integration-test-suite.md` - Integration test specs

### Related Features
- Session Summaries (uses LLM traces)
- Max AI (AI assistant, uses traces for context)
- Error Tracking (can link to LLM errors)

## 💬 Getting Help

### For PostHog Team Members
- Slack: `#team-llm-analytics`
- GitHub Discussions: Tag `llm-analytics`
- Office Hours: Check team calendar

### For External Contributors
- GitHub Issues: Tag with `llm-analytics`
- Community Forum: https://posthog.com/questions
- Discord: https://posthog.com/discord

## 🎯 Learning Path

### Week 1: Fundamentals
- [ ] Read LLMA_OVERVIEW.md
- [ ] Study LLMA_ARCHITECTURE.md diagrams
- [ ] Understand LLMA_DATA_MODELS.md schemas
- [ ] Set up local environment
- [ ] Send test events and view in UI

### Week 2: Backend Deep Dive
- [ ] Read traces_query_runner.py
- [ ] Understand HogQL queries
- [ ] Study provider integrations
- [ ] Write a simple query test
- [ ] Debug a query in Django shell

### Week 3: Frontend Exploration
- [ ] Review LLMAnalyticsScene.tsx
- [ ] Understand Kea logic patterns
- [ ] Study trace tree building
- [ ] Make a UI change
- [ ] Write a frontend test

### Week 4: Advanced Topics
- [ ] Study Rust capture service
- [ ] Understand S3 blob storage design
- [ ] Review evaluation pipeline plans
- [ ] Optimize a slow query
- [ ] Contribute a feature!

---

**Last Updated**: January 2025  
**Maintained By**: LLM Analytics Team  
**Questions?** Ask in `#team-llm-analytics` on Slack

