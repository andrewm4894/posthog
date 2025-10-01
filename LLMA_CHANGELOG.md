# LLM Analytics Changelog

## Recent Evolution (Last 3 Months)

This document tracks significant changes to the LLM Analytics (formerly LLM Observability) feature.

---

## December 2024

### Performance Optimizations
- **Optimized Traces Query** ([#38825](https://github.com/PostHog/posthog/pull/38825))
  - Significant performance improvements to TracesQueryRunner
  - Split traces query for better scalability ([#38124](https://github.com/PostHog/posthog/pull/38124))
  - Decreased TraceQueryRunner cache to 1 min ([#38193](https://github.com/PostHog/posthog/pull/38193))

### Cost & Model Updates
- **Updated LLM Costs** ([#38870](https://github.com/PostHog/posthog/pull/38870))
  - Refreshed pricing for OpenAI, Anthropic, Gemini models
  - Added Gemini 2.5 reasoning cost ([#37422](https://github.com/PostHog/posthog/pull/37422))
  - Included Gemini cached tokens in cost calculation ([#37651](https://github.com/PostHog/posthog/pull/37651))

### Capture Pipeline Planning
- **LLM Analytics Capture Plan** ([#38511](https://github.com/PostHog/posthog/pull/38511))
  - Documented `/ai` endpoint architecture
  - Planned S3 blob storage for large payloads
  - Designed multipart upload protocol
  - See: `rust/capture/docs/llma-capture-overview.md`

### UX Improvements
- **Trace View Enhancements**
  - Made trace tree sticky ([#1cce1b9](https://github.com/PostHog/posthog/commit/1cce1b9030))
  - Added back button on trace scene ([#38611](https://github.com/PostHog/posthog/pull/38611))
  - Added timestamp to trace span details ([#38303](https://github.com/PostHog/posthog/pull/38303))
  - Fixed trace view improvements ([#38361](https://github.com/PostHog/posthog/pull/38361))

### Bug Fixes
- **Fixed non-standard AI roles** ([#38716](https://github.com/PostHog/posthog/pull/38716))
  - Normalized role display across providers
- **Fixed Gemini playground parsing error** ([#38255](https://github.com/PostHog/posthog/pull/38255))
- **Fixed cost calculation for proxies** ([#38354](https://github.com/PostHog/posthog/pull/38354))

---

## November 2024

### Major Feature Additions

#### Datasets Feature
- **Datasets & Dataset Items** ([#36991](https://github.com/PostHog/posthog/pull/36991), [#37437](https://github.com/PostHog/posthog/pull/37437))
  - New Dataset and DatasetItem models in PostgreSQL
  - API for dataset CRUD operations ([#37433](https://github.com/PostHog/posthog/pull/37433))
  - Add traces to datasets ([#37705](https://github.com/PostHog/posthog/pull/37705))
  - Dataset scopes and documentation ([#37753](https://github.com/PostHog/posthog/pull/37753))
  - Scene UI for dataset management ([#38204](https://github.com/PostHog/posthog/pull/38204))

#### Trace Features
- **Mark Traces as Reviewed** ([#85e1bf7](https://github.com/PostHog/posthog/commit/85e1bf72de))
- **Show LLM Events as Conversation** ([#38416](https://github.com/PostHog/posthog/pull/38416))
  - Conversation-style display for chat traces
  - Improved readability of message flows

### HogQL Enhancements
- **Added exception for $ai_trace_id in HogQL** ([#38399](https://github.com/PostHog/posthog/pull/38399))
  - Special handling for trace ID property
- **Added bloom filter to mat_$ai_trace_id** ([#38308](https://github.com/PostHog/posthog/pull/38308))
  - Performance optimization for trace queries

### Playground Improvements
- **Cross-provider tool definitions** ([#37633](https://github.com/PostHog/posthog/pull/37633))
  - Unified tool calling across OpenAI, Anthropic, Gemini
- **Enforce valid models** ([#37675](https://github.com/PostHog/posthog/pull/37675))
  - Validation for supported models
- **Format litellm output** ([#38226](https://github.com/PostHog/posthog/pull/38226))

### Query & Data Fixes
- **Fixed queries comparing numbers and strings** ([#37583](https://github.com/PostHog/posthog/pull/37583))
- **Fixed lookup window for exceptions** ([#37501](https://github.com/PostHog/posthog/pull/37501))
- **Fixed inconsistent LLMA tile ranges** ([#37309](https://github.com/PostHog/posthog/pull/37309))
- **Fixed unsafe string generation** ([#37311](https://github.com/PostHog/posthog/pull/37311))

### UX Polish
- **Fallback for trace names** ([#37228](https://github.com/PostHog/posthog/pull/37228))
  - Better default naming when trace name not provided
- **Fixed scene reloads when opening tab** ([#37989](https://github.com/PostHog/posthog/pull/37989))

---

## October 2024

### Branding & Naming
- **Renamed LLM Observability to LLM Analytics** ([#37001](https://github.com/PostHog/posthog/pull/37001))
  - Updated all references from "LLMO" to "LLMA"
  - Changed product name to "LLM Analytics"
  - Updated docs paths ([#37136](https://github.com/PostHog/posthog/pull/37136))

### Product Maturity
- **Removed Beta Tag** ([#37135](https://github.com/PostHog/posthog/pull/37135))
  - LLM Analytics graduated from beta
  - General availability for all users

### Integration & Monitoring
- **Added quota limiting for LLMA** ([#37042](https://github.com/PostHog/posthog/pull/37042))
  - Rate limiting for LLM proxy endpoints
  - Burst and sustained rate throttles

- **Removed AI events from product analytics** ([#37067](https://github.com/PostHog/posthog/pull/37067))
  - Separated AI events from general product analytics
  - Cleaner event filtering

- **Added LLM events to usage/spend dashboards** ([#37092](https://github.com/PostHog/posthog/pull/37092))
  - Track LLM Analytics usage
  - Monitor costs and volume

### Max AI Integration
- **Added Temporal workflow ID to LLM traces** ([#eff38e6](https://github.com/PostHog/posthog/commit/eff38e6f7b))
  - Link traces to Max AI workflows
  - Better debugging and observability

---

## Architecture Evolution Timeline

### Phase 1: Initial Release (Pre-October)
- Basic trace and generation tracking
- OpenAI integration
- Simple UI for viewing traces

### Phase 2: Multi-Provider Support (October)
- Anthropic/Claude integration
- Google Gemini support
- Cross-provider tool calling

### Phase 3: Advanced Features (November)
- Datasets for evaluation
- Conversation display mode
- Trace review workflow
- Enhanced query performance

### Phase 4: Capture Architecture (December)
- Designed `/ai` endpoint for blob storage
- S3 integration for large payloads
- Multipart upload protocol
- Separation of capture and processing

### Phase 5: Optimization & Scale (Ongoing)
- Query performance improvements
- Caching strategies
- Cost tracking accuracy
- UI/UX refinements

---

## Breaking Changes

### October 2024
- **Renamed all "llmo" to "llma"** in codebase
  - Frontend routes changed: `/llm-observability/*` → `/llm-analytics/*`
  - API endpoints unchanged (still use `/api/query`)
  - Event names unchanged (still `$ai_*`)

---

## Upcoming Features (Roadmap Items in Discussion)

Based on recent commits and planning docs:

1. **Evaluation Service**
   - Automated quality scoring
   - Toxicity detection
   - Accuracy validation
   - See: Architecture docs mention evaluation pipeline

2. **Advanced Blob Storage**
   - Multimodal support (images, audio, video)
   - Improved compression
   - Retention policies

3. **Enhanced Analytics**
   - A/B testing for prompts
   - Anomaly detection
   - Cost optimization suggestions

4. **SDK Improvements**
   - Auto-instrumentation
   - Framework-specific helpers
   - Streaming support

---

## Migration Notes

### For Users Upgrading

If you used LLM Analytics before November 2024:

1. **Frontend URLs**: Bookmarks with `/llm-observability/` will redirect to `/llm-analytics/`
2. **Feature Flags**: 
   - `LLM_OBSERVABILITY_*` flags still work (backward compatible)
   - New `LLM_ANALYTICS_*` flags available
3. **Event Schema**: No changes to event structure or properties
4. **Datasets**: New feature - no migration needed

### For Developers

If you're working on LLMA code:

1. **Imports**: Use `products.llm_analytics.*` (not `products.llm_observability.*`)
2. **Query Runners**: Prefer `TracesQueryRunnerV2` for new code (better performance)
3. **Blob Storage**: Large payloads will move to S3 (see capture docs)
4. **Testing**: New integration test suite in `rust/capture/docs/llma-integration-test-suite.md`

