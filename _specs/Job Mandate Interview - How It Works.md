# Job Mandate Interview - How It Works

## What We're Building

The job mandate interview helps job seekers articulate what they want in their next role. It feels like talking to a career coach, not filling out a form. The system captures insights across four areas:

- What energizes you
- Your strengths
- Must-haves (non-negotiables)
- Deal-breakers

As the conversation progresses, insights appear in a side panel in real-time.

---

## Why This Is Hard (And How We Solve It)

Building a reliable LLM-powered interview requires solving two fundamental problems:

### Problem 1: Large Context Is Dilutive

Every token you send competes for the LLM's attention. The more you send, the less focus on what matters. A 10,000-token context with your key instruction buried in the middle performs worse than a 500-token context where that instruction is front and center.

This is expensive in two ways:
- **Monetary**: More tokens = higher API costs
- **Performance**: More noise = worse signal. The LLM's attention gets diluted.

**Solution:** Store state in the database. Each turn, send only what the LLM needs to make *this specific decision* — a compressed summary, not the full history.

### Problem 2: LLMs Don't Follow Complex Instructions Reliably

If you tell an LLM "conduct a 4-part interview, capture insights, know when to move on" — it will eventually drift, forget sections, or go off-script.

**Solution:** Don't ask the LLM to manage the workflow. Give it *one small job per turn*: evaluate this message, fill out a form. Your code handles everything else.

---

## Core Principle: Compress Everything

Every LLM call = **instructions** + **context**

Both should be maximally compressed. Maximum signal, minimum noise. The goal is not "send everything we have" — it's "send exactly what's needed for *this* decision."

### The Prompt Is Built Fresh Each Turn

Basic thinking: "Here's my system prompt, I wrote it once."

Better: The prompt is *generated* each turn based on current state. We pull the current section and captured items from the database, and build a focused prompt containing only what's relevant right now.

Why explain all four sections when we're only working on one? Why include the tool calls and responses from previous turns? Strip out the internal machinery; keep the conversation and a focused state summary.

### The Mental Shift

Don't think: "Here's my prompt and the conversation."

Think: "What's the *minimum* I need to send for the LLM to make *this specific decision* correctly?"

Engineer backward from there.

---

## The Pattern: One Decision Per Turn

When the user sends a message, the LLM makes **one decision**:

```
User says something
        |
   LLM evaluates
        |
   +---------+
   |         |
   v         v
EXTRACT   CLARIFY
(clear)   (vague)
```

- **Extract**: User said something concrete. Capture 1-4 insights, respond.
- **Clarify**: User was vague. Ask a follow-up question. Capture nothing.

This happens in a single LLM call. The LLM doesn't manage the interview — it just evaluates one message and fills out a form.

---

## Tool Use: Forcing Structured Output

The LLM needs to return both a conversational response AND structured data. We use **tool use** to guarantee this.

### What Is Tool Use?

Normally, LLMs return free-form text. But we need structured data we can process. Tool use lets us define a "form" that the LLM *must* fill out.

Think of it like giving someone a form instead of asking them to write a letter. The form guarantees you get the fields you need in the format you expect.

### The Interview Response Tool

```
interview_response
+-- action: "extract" or "clarify" (required)
+-- insights: list of captured insights (optional)
+-- section_complete: true/false (optional)
+-- response: the message to show the user (required)
```

We tell Claude: "You MUST use this tool." Claude returns its answer by "calling" this tool with the values filled in.

### Why Not Just Ask for JSON?

| Approach | Problem |
|----------|---------|
| "Include JSON in your response" | LLM might forget, format wrong, or mix with text |
| "Return only JSON" | Loses conversational feel; harder to stream |
| **Tool use** | Guarantees structure every time |

---

## What the LLM Sees (Example)

Each turn, we build a focused prompt. Here's what the LLM might receive:

```
## Current Section: What Energizes You

**Items captured so far (2):**
- Solving complex technical problems
- Building things from scratch

**Target:** 3-10 insights per section

For this user message, decide:
1. If clear -> extract insights, determine if section complete
2. If vague -> ask a follow-up question, extract nothing
```

The full conversation history is included (so the LLM has context), but notice what's *not* there: the tool calls and responses from prior turns, the other three sections, completed items from previous sections. The internal machinery is stripped out; only the state summary and the conversation itself.

---

## What the LLM Returns (Examples)

**When extracting:**
```json
{
  "action": "extract",
  "insights": [
    {"content": "Collaborating with small, focused teams"},
    {"content": "Whiteboarding sessions with smart colleagues"}
  ],
  "section_complete": false,
  "response": "Small teams and collaborative problem-solving - that's a clear pattern. What about the problems themselves? Are you drawn more to technical puzzles, strategic challenges, or something else?"
}
```

**When clarifying:**
```json
{
  "action": "clarify",
  "response": "That's interesting! When you say you like 'interesting work,' can you give me an example of a project or task that felt really engaging?"
}
```

---

## Section Advancement

The LLM marks `section_complete: true` when:
- At least 3 insights have been captured, AND
- The user's response suggests they've covered the topic

When a section completes:
1. Current section collapses in the UI
2. Next section becomes active
3. The LLM's response acknowledges the transition

After all four sections complete, the mandate is finalized.

---

## State Lives in the Database

The LLM is stateless. It doesn't remember previous turns. So where does state live?

| Location | What's Stored | Why |
|----------|---------------|-----|
| **Database** | Mandate record, captured items, section statuses, conversation | Permanent; survives refreshes |
| **Frontend** | Current view, UI state (expanded sections) | Fast display; mirrors backend |

The **backend is the source of truth**. The frontend just displays what it receives.

### The Flow

```
1. USER SENDS MESSAGE
   Frontend sends: message + mandate_id + conversation_id

2. BACKEND LOADS STATE FROM DATABASE
   Fetches: mandate, items, section statuses

3. BACKEND BUILDS COMPRESSED PROMPT
   Injects only: current section, items so far, relevant instructions

4. LLM RESPONDS (via tool use)
   Returns: action, insights (if any), section_complete, response

5. BACKEND UPDATES DATABASE
   Saves: new items, updated statuses, assistant message

6. BACKEND STREAMS TO FRONTEND
   Sends: mandate_update, text chunks, complete event

7. FRONTEND UPDATES VIEW
   Displays: new items, section transitions, response
```

### Why This Matters

The frontend sends only:
- The user's message
- The mandate ID
- The conversation ID

The backend looks up everything else from the database. This means:
- Frontend can't get out of sync
- Page refresh doesn't lose state
- Multiple devices see the same data

---

## Summary

| Challenge | Solution |
|-----------|----------|
| Large context is dilutive (cost + performance) | Store state in DB; send compressed context each turn |
| LLMs drift on complex instructions | One small job per turn; code manages workflow |
| Need structured data | Tool use forces the LLM to fill out a form |
| Need conversational feel | Response field in tool allows natural language |
| State continuity | Backend fetches from DB; frontend just displays |
| Reliable section flow | LLM decides completion; backend enforces transitions |
