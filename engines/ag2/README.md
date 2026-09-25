# ag2

> Clean-room architectural extraction of the runtime engine powering [ag2ai/ag2](ag2ai/ag2).
> **License**: Apache-2.0 (Apache License 2.0)

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Build TypeScript to JavaScript
npm run build
```

## Architecture & Components

See [`specification.md`](./specification.md) for full architectural blueprints, dataflow diagrams, and implementation details.

---

## Defensive Runtime Architecture & Features

The `ag2` engine provides a deterministic, secure, and resilient runtime foundation for autonomous multi-agent orchestration:

- **Conversational Patterns**: Supports two-agent chats, sequential hand-offs, group chat managers, and dynamic routing architectures with termination assertions.
- **Defensive Execution Boundaries**: Enforces strict payload verification, boundary sanitization, and execution quotas on all tool/function calls.
- **Human-in-the-Loop (HITL) Controls**: Configurable approval checkpoints, interceptors, and non-blocking asynchronous pauses.
- **Context & State Management**: Immutable message history logging, conversation turn state machines, and fail-safe fallback handlers.
- **Multi-Model Support**: Provider-agnostic LLM client abstraction layer with token tracking, rate-limiting, and automatic retry backoff policies.

## Repository Layout

```text
engines/ag2/
├── src/                    # Core runtime source code
│   ├── agents/             # ConversableAgent, AssistantAgent, UserProxyAgent implementations
│   ├── groupchat/          # GroupChat, GroupChatManager, and speaker selection policies
│   ├── tools/              # Execution sandboxes and tool registration registry
│   └── types/              # Runtime types, interfaces, and state contracts
├── test/                   # Comprehensive test suites and behavioral verifications
├── specification.md        # Architectural blueprint and clean-room specifications
├── package.json            # Engine dependencies and execution scripts
├── tsconfig.json           # Strict TypeScript compilation parameters
└── README.md               # Engine documentation and quickstart guide
```

## Security & Operational Safeguards

- **Input Validation**: All incoming agent prompts and tool arguments undergo schema validation prior to runtime dispatch.
- **Isolation**: Tool execution environments enforce sandboxed I/O, disallowing unvetted child processes or network egress by default.
- **Audit Trails**: Every conversational turn, tool invocation, and state transition emits deterministic telemetry events for debugging and compliance.