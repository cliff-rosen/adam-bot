# Orchestration Analysis

## Current Orchestration Layers

| Layer | What it is | Control | Example |
|-------|-----------|---------|---------|
| **1. Chat Agent Loop** | LLM decides what to do next, calls tools, repeats | Agentic | User asks question → agent reasons → calls tools → responds |
| **2. Tools** | Discrete capabilities agent can invoke | Fixed interface, varies inside | `web_search`, `create_asset`, `design_workflow` |
| **3. Tool Internals - Fixed** | Hardcoded logic inside a tool | Fixed | Search tool: query → fetch → parse → return |
| **4. Tool Internals - Agentic** | LLM loop inside a tool | Agentic | Research tool: LLM decides what to search, evaluates results, loops |
| **5. Workflow Engine** | Graph of steps with checkpoints | Fixed structure, agentic steps | Vendor finder: understand → find → research → analyze |
| **6. Workflow Steps** | Individual step execution | Can be fixed or agentic | `build_vendor_list` uses LLM; `find_reviews` is mostly fixed |

---

## The Nesting Problem

```
User Request
    └── Agent Loop (agentic)
            └── Tool Call
                    └── Tool Internal Loop (agentic or fixed)
                            └── Sub-tool calls
                                    └── ...

OR

User Request
    └── Agent Loop (agentic)
            └── design_workflow tool
                    └── Workflow Engine (fixed graph)
                            └── Step execution (agentic)
                                    └── Tool calls within step
```

---

## When to Use What

| Use agentic when... | Use fixed when... |
|---------------------|-------------------|
| Problem space is open-ended | Steps are well-understood |
| User intent needs interpretation | Process is repeatable |
| Adaptation to results is needed | Predictability matters |
| Discovery is the goal | Throughput/cost matters |

---

## The UX Challenge

Right now, the user sees:
- **Chat** (clearly agentic - they're talking to an agent)
- **Workflows** (feels more structured - stages, checkpoints)

But internally, both can spawn sub-agents, call tools, loop...

**The confusion risk**: User doesn't know what's happening where. Is the agent thinking? Is a workflow running? Is a tool doing something complex?

---

## Opportunity: A Clearer Mental Model

The UI should consistently expose **two modes**:

### Mode 1: Conversation (Agent-Driven)
- The agent is in charge
- User talks, agent responds
- Agent can use tools (quick, mostly invisible)
- Agent can *launch* workflows (hands off to structured process)

### Mode 2: Workflow (Process-Driven)
- A defined process is in charge
- Clear stages, visible progress
- Checkpoints for human input
- Agent helps *within* steps, but the *graph* controls flow

**The key insight**: The agent is always available as the "glue" - interpreting user intent, handling edge cases, synthesizing results. But *control* can be delegated to a workflow when structure helps.

---

## Open Questions

1. Should workflows be "first-class" in the UI (separate panel) or embedded in chat?
2. How do we show "agent is working inside a workflow step" vs "workflow is between steps"?
3. When a workflow completes, does control return to the agent or does the conversation end?
4. Should users be able to interrupt workflows and talk to the agent mid-process?

---

## Next Steps

- Inventory all tools and classify as fixed vs agentic internally
- Map the actual nesting depth in common use cases
- Design UI patterns that make the current "mode" clear without overwhelming
