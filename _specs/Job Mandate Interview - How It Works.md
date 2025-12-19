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

## Summary

| Requirement | How It's Fulfilled |
|-------------|-------------------|
| Conversational feel | LLM acts as a warm career coach, asks one question at a time |
| Capture insights | Structured extraction with duplicate avoidance |
| Real-time progress | Side panel updates as insights are captured |
| Extract vs. clarify | Single LLM decision based on input clarity |
| Natural section flow | LLM determines completion based on quantity + user signals |
