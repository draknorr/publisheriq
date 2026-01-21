# Streaming API

The chat system uses Server-Sent Events (SSE) for real-time streaming responses.

**Endpoint**: `POST /api/chat/stream`

**Source File**: `apps/admin/src/app/api/chat/stream/route.ts`

---

## Request Format

```bash
POST /api/chat/stream
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "What are the top games by CCU?"}
  ]
}
```

---

## Event Types

The stream emits JSON events in `data: {...}\n\n` format:

| Event | Description |
|-------|-------------|
| `text_delta` | Incremental text chunk from LLM |
| `tool_start` | Tool call initiated |
| `tool_result` | Tool execution completed |
| `message_end` | Response complete with timing/debug info |
| `error` | Error occurred |

---

## Event Schemas

**Type Definitions**: `apps/admin/src/lib/llm/streaming-types.ts`

### TextDeltaEvent

Incremental text from LLM:

```typescript
interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;  // Text chunk
}
```

### ToolStartEvent

Tool call started:

```typescript
interface ToolStartEvent {
  type: 'tool_start';
  toolCallId: string;
  name: string;  // e.g., "query_analytics", "find_similar"
  arguments: Record<string, unknown>;
}
```

### ToolResultEvent

Tool execution complete:

```typescript
interface ToolResultEvent {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: { success: boolean; error?: string; [key: string]: any };
  timing: { executionMs: number };
}
```

### MessageEndEvent

Stream complete:

```typescript
interface MessageEndEvent {
  type: 'message_end';
  timing: {
    llmMs: number;    // Total LLM processing time
    toolsMs: number;  // Total tool execution time
    totalMs: number;  // Total request time
  };
  debug?: {
    iterations: number;        // LLM call count (max 5)
    textDeltaCount: number;    // Text chunks received
    totalChars: number;        // Total characters streamed
    toolCallCount: number;     // Tools called
    lastIterationHadText: boolean;
  };
}
```

### ErrorEvent

Error occurred:

```typescript
interface ErrorEvent {
  type: 'error';
  message: string;
}
```

---

## Tool Iteration Loop

The streaming API uses a tool loop with a maximum of 5 iterations:

1. Send user message to LLM
2. If LLM requests tool calls, execute them
3. Send tool results back to LLM
4. Repeat until LLM produces final text response or max iterations reached
5. Emit `message_end` with timing and debug stats

**Constant**: `MAX_TOOL_ITERATIONS = 5`

If max iterations reached without final response, a fallback message is generated.

---

## Entity Link Pre-Formatting

Before tool results are sent back to the LLM, `formatResultWithEntityLinks()` transforms entity names into markdown links:

```
{gameName: "Half-Life 2", appid: 220}
  → {gameName: "[Half-Life 2](game:220)", appid: 220}
```

This ensures the LLM copies links directly into responses without needing to format them.

### Link Formats

| Entity Type | Format |
|-------------|--------|
| Game | `[Name](game:APPID)` |
| Developer | `[Name](/developers/ID)` |
| Publisher | `[Name](/publishers/ID)` |

**Source File**: `apps/admin/src/lib/llm/format-entity-links.ts`

---

## Example Client

```javascript
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Top games by CCU' }]
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      switch (event.type) {
        case 'text_delta':
          console.log(event.delta);
          break;
        case 'tool_start':
          console.log(`Calling ${event.name}...`);
          break;
        case 'message_end':
          console.log(`Done in ${event.timing.totalMs}ms`);
          break;
      }
    }
  }
}
```

---

## Related Documentation

- [Chat Data System](../developer-guide/architecture/chat-data-system.md) - Full chat system architecture
- [Chat Interface Guide](../user-guide/chat-interface.md) - How to use the chat
- [Internal API](./internal-api.md) - Other API endpoints
