# Job Mandate Interview - How It Works

## Requirements

The job mandate interview helps job seekers articulate what they want in their next role. The system must:

1. **Conduct a conversational interview** - Feel like talking to a career coach, not filling out a form
2. **Capture insights across four areas**:
   - What energizes you
   - Your strengths
   - Must-haves (non-negotiables)
   - Deal-breakers
3. **Show progress in real-time** - As insights are captured, they appear in a side panel
4. **Know when to extract vs. ask** - If user input is clear, capture it; if vague, ask follow-up questions
5. **Advance sections naturally** - Move to the next section when enough has been captured (3-10 items)

---

## How the System Works

### Single Decision Per Message

When the user sends a message, the system makes **one unified decision**:

```
User says something
        ↓
   LLM evaluates
        ↓
┌───────┴───────┐
│               │
▼               ▼
EXTRACT      CLARIFY
(clear)      (vague)
```

- **Extract**: The user said something concrete. Capture 1-4 insights, then respond.
- **Clarify**: The user was vague or off-topic. Ask a focused follow-up question. Capture nothing.

This happens in a single LLM call, not two separate steps.

---

### How We Get Structured Output (Tool Use)

The LLM needs to return both a conversational response AND structured data (insights, decisions). We use Claude's **tool use** feature to achieve this reliably.

#### What is Tool Use?

Normally, LLMs return free-form text. But we need structured data we can process programmatically. Tool use lets us define a "tool" that the LLM must call with specific parameters.

Think of it like giving someone a form to fill out instead of asking them to write a letter. The form guarantees you get the fields you need in the format you expect.

#### The Interview Response Tool

We define a tool called `interview_response` with this structure:

```
interview_response
├── action: "extract" or "clarify" (required)
├── insights: list of captured insights (optional)
├── section_complete: true/false (optional)
└── response: the message to show the user (required)
```

We tell Claude: "You MUST use this tool to submit your response." Claude then returns its answer by "calling" this tool with the appropriate values.

#### Why Not Just Ask for JSON?

We could ask the LLM to include JSON in its text response, but:

| Approach | Problem |
|----------|---------|
| "Include JSON in your response" | LLM might forget, format it wrong, or mix it with text |
| "Return only JSON" | Loses the conversational feel; harder to stream |
| **Tool use** | Guarantees structure; LLM fills in the form correctly every time |

Tool use is the most reliable way to get structured data from an LLM while still allowing natural language in the response field.

---

### What the LLM Sees

Each time the user sends a message, the LLM receives:

1. **Current section being worked on** (e.g., "What Energizes You")
2. **Items already captured** in that section (to avoid duplicates)
3. **Suggested areas to explore** (e.g., "What tasks make them lose track of time?")
4. **Instructions** on when to extract vs. clarify

Example context the LLM sees:

```
## Current Section: What Energizes You

**Items captured so far (2):**
- Solving complex technical problems
- Building things from scratch

**Target:** 3-10 insights per section

For each user message, you must decide:
1. If clear → extract insights, determine if section complete
2. If vague → ask a follow-up question, extract nothing
```

---

### What the LLM Returns

The LLM must respond using a structured format:

| Field | Purpose |
|-------|---------|
| `action` | "extract" or "clarify" |
| `insights` | List of captured insights (only if extracting) |
| `section_complete` | Should we move to the next section? |
| `response` | The message shown to the user |

Example when extracting:
```json
{
  "action": "extract",
  "insights": [
    {"content": "Collaborating with small, focused teams"},
    {"content": "Whiteboarding sessions with smart colleagues"}
  ],
  "section_complete": false,
  "response": "Small teams and collaborative problem-solving - that's a clear pattern. **What about the problems themselves?** Are you drawn more to technical puzzles, strategic challenges, or something else?"
}
```

Example when clarifying:
```json
{
  "action": "clarify",
  "response": "That's interesting! When you say you like 'interesting work,' **can you give me an example** of a project or task that felt really engaging to you?"
}
```

---

### Section Advancement

The LLM marks `section_complete: true` when:
- At least 3 good insights have been captured, AND
- The user's response suggests they've covered the topic

When a section completes:
1. Current section is marked complete and collapses
2. Next section becomes active and expands
3. The LLM's response acknowledges the transition

After all four sections complete, the mandate is finalized.

---

### State Management and Continuity

A key question: when the user sends a new message, how does the system know what's already been captured? Where does the state live?

#### What's Stored Where

| Location | What's Stored | Why |
|----------|---------------|-----|
| **Backend Database** | Mandate record, all captured items, section statuses, conversation history | Permanent storage; survives page refreshes |
| **Frontend (React)** | Current view of sections and items, UI state (which sections expanded) | Fast display; updates in real-time |

The **backend is the source of truth**. The frontend mirrors it for display purposes.

#### The Flow: How Continuity Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. USER SENDS MESSAGE                                                    │
│    Frontend sends: message + mandate_id + conversation_id                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. BACKEND LOADS STATE FROM DATABASE                                     │
│    - Fetches mandate record (current section, section statuses)          │
│    - Fetches all items already captured                                  │
│    - Fetches conversation history                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. BACKEND BUILDS PROMPT WITH CURRENT STATE                              │
│    - Includes: "Items captured so far: [list from database]"             │
│    - Includes: "Current section: [from database]"                        │
│    - Includes: Full conversation history                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. LLM RESPONDS (via tool use)                                           │
│    - Decides: extract or clarify                                         │
│    - Returns: insights (if any), section_complete, response text         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. BACKEND UPDATES DATABASE                                              │
│    - Saves new items to database                                         │
│    - Updates section status if advancing                                 │
│    - Saves assistant message to conversation                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. BACKEND STREAMS UPDATES TO FRONTEND                                   │
│    - Sends: mandate_update event (new items, updated sections)           │
│    - Sends: text chunks (the response to display)                        │
│    - Sends: complete event (final state)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND UPDATES ITS VIEW                                             │
│    - Adds new items to section panel                                     │
│    - Collapses completed section, expands new one                        │
│    - Displays the response message                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Point: Backend Fetches Its Own State

The frontend does **not** send the current mandate state with each message. It only sends:
- The user's message
- The mandate ID
- The conversation ID

The backend then **looks up everything it needs from the database**. This means:
- The frontend can't get out of sync
- If the user refreshes the page, the backend still has everything
- Multiple devices would see the same state

#### What the Frontend Receives Back

After each message, the backend streams events to the frontend:

1. **`mandate_update`** - Contains the new state of all sections and any new items
2. **`text_delta`** - Chunks of the response text (for streaming display)
3. **`complete`** - Final confirmation with conversation ID

The frontend uses these events to update its local view, but it never needs to "remember" anything—it just reflects what the backend tells it.

---

## Summary

| Requirement | How It's Fulfilled |
|-------------|-------------------|
| Conversational feel | LLM acts as a warm career coach, asks one question at a time |
| Capture insights | Structured extraction via tool use with duplicate avoidance |
| Real-time progress | Side panel updates as insights are captured |
| Extract vs. clarify | Single LLM decision returned through `interview_response` tool |
| Natural section flow | LLM determines completion based on quantity + user signals |
| Reliable structure | Tool use guarantees we get data in the expected format every time |
| State continuity | Backend fetches state from database; frontend just displays what it receives |
