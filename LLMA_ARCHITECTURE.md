# LLM Analytics Architecture

## High-Level Data Flow

```mermaid
graph TB
    subgraph "Client Application"
        APP[LLM App]
        SDK[PostHog SDK]
    end
    
    subgraph "Capture Layer (Rust)"
        AI_EP["/ai endpoint"]
        PARSE[Multipart Parser]
        S3_UP[S3 Uploader]
        KAFKA_PUB[Kafka Publisher]
    end
    
    subgraph "Storage Layer"
        S3[S3 Blob Storage]
        KAFKA[Kafka Queue]
        CH[ClickHouse Events]
        PG[PostgreSQL Datasets]
    end
    
    subgraph "Processing Layer (Python/Django)"
        INGEST[Event Ingestion]
        QUERY[Query Runners]
        API[REST API]
    end
    
    subgraph "Frontend (React/TypeScript)"
        UI[Web UI]
        LOGIC[Kea Logic]
    end
    
    APP -->|capture events| SDK
    SDK -->|POST multipart| AI_EP
    AI_EP --> PARSE
    PARSE -->|blobs| S3_UP
    PARSE -->|event JSON| KAFKA_PUB
    S3_UP -->|upload| S3
    KAFKA_PUB -->|publish| KAFKA
    KAFKA --> INGEST
    INGEST -->|store| CH
    
    UI -->|query| API
    API --> QUERY
    QUERY -->|read| CH
    QUERY -->|read| PG
    QUERY -->|fetch blobs| S3
    API -->|results| UI
    UI --> LOGIC
```

## Capture Pipeline Detail

```mermaid
sequenceDiagram
    participant SDK as PostHog SDK
    participant Capture as Capture Service (/ai)
    participant S3 as S3 Storage
    participant Kafka as Kafka Queue
    participant CH as ClickHouse
    
    SDK->>Capture: POST /ai (multipart request)
    Note over SDK,Capture: Event JSON + Binary Blobs
    
    Capture->>Capture: Validate API key
    Capture->>Capture: Parse multipart payload
    
    loop For each blob
        Capture->>S3: Upload blob with metadata
        S3-->>Capture: S3 URL with byte range
    end
    
    Capture->>Capture: Replace blob data with S3 URLs
    Capture->>Kafka: Publish modified event
    
    Kafka->>CH: Standard ingestion pipeline
    Note over Kafka,CH: Event stored with S3 references
    
    Capture-->>SDK: 200 OK
```

## Trace Query Flow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Django API
    participant QR as TracesQueryRunner
    participant CH as ClickHouse
    participant S3 as S3 Storage
    
    UI->>API: GET /api/projects/:id/query (TracesQuery)
    API->>QR: Execute query
    
    QR->>QR: Build HogQL query
    Note over QR: Filter by date, properties, trace_id
    
    QR->>CH: Execute HogQL query
    CH-->>QR: Event rows with S3 URLs
    
    QR->>QR: Map results to LLMTrace objects
    QR->>QR: Build event tree hierarchy
    QR-->>API: TracesQueryResponse
    API-->>UI: JSON response
    
    opt User expands trace details
        UI->>S3: Fetch blob (byte range request)
        S3-->>UI: Blob content (input/output)
        UI->>UI: Display in trace view
    end
```

## Event Hierarchy

```mermaid
graph TD
    subgraph "Trace Structure"
        TRACE[$ai_trace<br/>trace_id: abc123]
        
        SPAN1[$ai_span<br/>parent: trace]
        SPAN2[$ai_span<br/>parent: trace]
        
        GEN1[$ai_generation<br/>parent: span1]
        GEN2[$ai_generation<br/>parent: span1]
        GEN3[$ai_generation<br/>parent: span2]
        
        METRIC1[$ai_metric<br/>parent: gen1]
        FEEDBACK1[$ai_feedback<br/>parent: trace]
        
        TRACE --> SPAN1
        TRACE --> SPAN2
        SPAN1 --> GEN1
        SPAN1 --> GEN2
        SPAN2 --> GEN3
        GEN1 --> METRIC1
        TRACE --> FEEDBACK1
    end
    
    style TRACE fill:#4A90E2
    style SPAN1 fill:#7ED321
    style SPAN2 fill:#7ED321
    style GEN1 fill:#F5A623
    style GEN2 fill:#F5A623
    style GEN3 fill:#F5A623
```

## Frontend Component Architecture

```mermaid
graph TB
    subgraph "LLM Analytics UI"
        SCENE[LLMAnalyticsScene]
        
        subgraph "Tabs"
            DASH[Dashboard Tab]
            TRACES[Traces Tab]
            GENS[Generations Tab]
            USERS[Users Tab]
            PLAY[Playground Tab]
            DATASETS[Datasets Tab]
        end
        
        subgraph "Trace Detail View"
            TRACE_SCENE[LLMAnalyticsTraceScene]
            SIDEBAR[TraceSidebar]
            CONTENT[EventContent]
            TREE[TraceTree]
        end
        
        subgraph "State Management (Kea)"
            MAIN_LOGIC[llmAnalyticsLogic]
            TRACE_LOGIC[llmAnalyticsTraceLogic]
            DATA_LOGIC[llmAnalyticsTraceDataLogic]
            PLAY_LOGIC[llmAnalyticsPlaygroundLogic]
        end
    end
    
    SCENE --> DASH
    SCENE --> TRACES
    SCENE --> GENS
    SCENE --> USERS
    SCENE --> PLAY
    SCENE --> DATASETS
    
    TRACES -->|navigate| TRACE_SCENE
    TRACE_SCENE --> SIDEBAR
    TRACE_SCENE --> CONTENT
    SIDEBAR --> TREE
    
    SCENE --> MAIN_LOGIC
    TRACE_SCENE --> TRACE_LOGIC
    TRACE_SCENE --> DATA_LOGIC
    PLAY --> PLAY_LOGIC
```

## Data Models

```mermaid
erDiagram
    EVENTS {
        uuid uuid
        string event
        jsonb properties
        timestamp timestamp
        int team_id
    }
    
    AI_TRACE_EVENTS {
        string ai_trace_id
        string ai_input_state_url
        string ai_output_state_url
        float ai_latency
        int ai_input_tokens
        int ai_output_tokens
        float ai_total_cost_usd
    }
    
    AI_GENERATION_EVENTS {
        string ai_trace_id
        string ai_parent_span_id
        string ai_input_url
        string ai_output_choices_url
        string ai_model
        float ai_latency
        int ai_input_tokens
        int ai_output_tokens
        float ai_total_cost_usd
    }
    
    S3_BLOBS {
        string path
        bytes content
        string content_type
        jsonb metadata
    }
    
    DATASETS {
        uuid id
        string name
        text description
        jsonb metadata
        int team_id
        timestamp created_at
    }
    
    DATASET_ITEMS {
        uuid id
        uuid dataset_id
        jsonb input
        jsonb output
        jsonb metadata
        string ref_trace_id
        timestamp ref_timestamp
    }
    
    EVENTS ||--o{ AI_TRACE_EVENTS : "where event = $ai_trace"
    EVENTS ||--o{ AI_GENERATION_EVENTS : "where event = $ai_generation"
    AI_TRACE_EVENTS ||--o{ S3_BLOBS : "references via URLs"
    AI_GENERATION_EVENTS ||--o{ S3_BLOBS : "references via URLs"
    DATASETS ||--o{ DATASET_ITEMS : "has many"
    DATASET_ITEMS }o--|| AI_TRACE_EVENTS : "references by trace_id"
```

## Playground Architecture

```mermaid
graph LR
    subgraph "Frontend"
        PLAY_UI[Playground UI]
        PLAY_LOGIC[playgroundLogic]
    end
    
    subgraph "Backend Proxy"
        PROXY[LLMProxyViewSet]
        
        subgraph "Providers"
            OPENAI[OpenAIProvider]
            ANTHROPIC[AnthropicProvider]
            GEMINI[GeminiProvider]
            CODESTRAL[CodestralProvider]
        end
    end
    
    subgraph "External LLMs"
        OPENAI_API[OpenAI API]
        ANTHROPIC_API[Anthropic API]
        GEMINI_API[Gemini API]
    end
    
    PLAY_UI -->|POST /api/llm_proxy/completion| PROXY
    PLAY_LOGIC -->|stream events| PLAY_UI
    
    PROXY -->|route| OPENAI
    PROXY -->|route| ANTHROPIC
    PROXY -->|route| GEMINI
    PROXY -->|route| CODESTRAL
    
    OPENAI -->|API call| OPENAI_API
    ANTHROPIC -->|API call| ANTHROPIC_API
    GEMINI -->|API call| GEMINI_API
    
    OPENAI_API -->|stream| OPENAI
    ANTHROPIC_API -->|stream| ANTHROPIC
    GEMINI_API -->|stream| GEMINI
    
    OPENAI -->|SSE| PROXY
    ANTHROPIC -->|SSE| PROXY
    GEMINI -->|SSE| PROXY
    PROXY -->|Server-Sent Events| PLAY_UI
```

## S3 Blob Storage Structure

```mermaid
graph TD
    BUCKET[S3 Bucket: posthog-llm-analytics]
    
    BUCKET --> LLMA[llma/]
    
    LLMA --> RETENTION1[30d/ - 30 day retention]
    LLMA --> RETENTION2[90d/ - 90 day retention]
    LLMA --> RETENTION3[1y/ - 1 year retention]
    
    RETENTION1 --> TEAM1[team_123/]
    TEAM1 --> DATE1[2024-01-15/]
    DATE1 --> FILE1[event_456_x7y9z.multipart]
    
    FILE1 --> BLOB1[Blob 1: $ai_input<br/>Range: 0-50000<br/>Type: application/json]
    FILE1 --> BLOB2[Blob 2: $ai_output_choices<br/>Range: 50001-75000<br/>Type: application/json]
    
    style BUCKET fill:#E8F4F8
    style FILE1 fill:#FFF4E6
    style BLOB1 fill:#E8F5E9
    style BLOB2 fill:#E8F5E9
```

## Query Runner Architecture

```mermaid
graph TB
    subgraph "Query Execution Flow"
        FRONTEND[Frontend Query]
        
        ROUTER[Query Router]
        
        subgraph "Query Runners"
            TRACES_V1[TracesQueryRunner]
            TRACES_V2[TracesQueryRunnerV2]
            TRACE[TraceQueryRunner]
            TAXONOMY[TeamTaxonomyQueryRunner]
            VECTOR[VectorSearchQueryRunner]
        end
        
        subgraph "HogQL Layer"
            HOGQL[HogQL Parser]
            OPTIMIZER[Query Optimizer]
        end
        
        CH_QUERY[ClickHouse Query]
        CACHE[Redis Cache]
    end
    
    FRONTEND --> ROUTER
    ROUTER --> TRACES_V1
    ROUTER --> TRACES_V2
    ROUTER --> TRACE
    ROUTER --> TAXONOMY
    ROUTER --> VECTOR
    
    TRACES_V1 --> HOGQL
    TRACES_V2 --> HOGQL
    TRACE --> HOGQL
    
    HOGQL --> OPTIMIZER
    OPTIMIZER --> CH_QUERY
    
    CH_QUERY -->|check| CACHE
    CACHE -->|miss| CH_QUERY
    CH_QUERY -->|store| CACHE
```

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant SDK as Client SDK
    participant Capture as Capture Service
    participant Redis as Redis Cache
    participant PG as PostgreSQL
    participant S3 as S3 Storage
    
    SDK->>Capture: POST /ai with API key
    
    Capture->>Capture: Extract API key from headers
    
    Capture->>Redis: Check cached team ID
    
    alt Cache hit
        Redis-->>Capture: Return team_id
    else Cache miss
        Capture->>PG: Lookup team by API key
        PG-->>Capture: Return team data
        Capture->>Redis: Cache team_id
    end
    
    alt Invalid key
        Capture-->>SDK: 401 Unauthorized
    else Valid key
        Capture->>Capture: Process multipart data
        Capture->>S3: Upload to team-specific path
        Note over Capture,S3: s3://bucket/llma/{team_id}/...
        Capture-->>SDK: 200 OK
    end
```

## Evaluation Pipeline (Future)

```mermaid
graph LR
    subgraph "Event Pipeline"
        KAFKA_OUT[Kafka: events_plugin_ingestion]
    end
    
    subgraph "Evaluation Service (Planned)"
        EVAL[Evaluation Consumer]
        
        subgraph "Evaluators"
            QUALITY[Quality Scorer]
            TOXICITY[Toxicity Detector]
            ACCURACY[Accuracy Checker]
        end
        
        RESULTS[Results Publisher]
    end
    
    subgraph "Storage"
        S3_BLOBS[S3 Blob Storage]
        KAFKA_EVAL[Kafka: ai_evaluations]
    end
    
    KAFKA_OUT -->|consume| EVAL
    EVAL -->|fetch blobs| S3_BLOBS
    EVAL --> QUALITY
    EVAL --> TOXICITY
    EVAL --> ACCURACY
    
    QUALITY --> RESULTS
    TOXICITY --> RESULTS
    ACCURACY --> RESULTS
    
    RESULTS -->|publish| KAFKA_EVAL
    KAFKA_EVAL -->|ingest| KAFKA_OUT
    
    style EVAL fill:#FFECB3
    style QUALITY fill:#C8E6C9
    style TOXICITY fill:#C8E6C9
    style ACCURACY fill:#C8E6C9
```

