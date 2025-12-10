# Design: Conversation & Memory System

## Overview

This document outlines the design for conversation persistence and the foundation of the memory system. The goal is to:
1. Persist conversations so they survive page refresh
2. Enable loading previous conversations
3. Lay groundwork for the tiered memory system

---

## Database Schema

### Conversations Table

```sql
CREATE TABLE conversations (
    conversation_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255),                    -- Auto-generated or user-set
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    metadata JSON,                          -- Flexible storage for future needs
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### Messages Table

```sql
CREATE TABLE messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Tool usage tracking
    tool_calls JSON,                        -- Array of {tool_name, input, output}

    -- Rich response data
    suggested_values JSON,
    suggested_actions JSON,
    custom_payload JSON,

    FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
);
```

### Memories Table (Foundation for Long-term Memory)

```sql
CREATE TABLE memories (
    memory_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,

    -- Memory classification
    memory_type ENUM('fact', 'preference', 'entity', 'project', 'decision') NOT NULL,
    category VARCHAR(100),                  -- e.g., "work", "personal", "health"

    -- Content
    content TEXT NOT NULL,                  -- The actual memory
    source_conversation_id INT,             -- Where this memory came from
    source_message_id INT,

    -- Temporal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,
    access_count INT DEFAULT 0,

    -- Control
    is_pinned BOOLEAN DEFAULT FALSE,        -- Always include in context
    is_archived BOOLEAN DEFAULT FALSE,
    confidence FLOAT DEFAULT 1.0,           -- For inferred memories

    -- Search
    embedding BLOB,                         -- For semantic search (future)

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (source_conversation_id) REFERENCES conversations(conversation_id),
    FOREIGN KEY (source_message_id) REFERENCES messages(message_id)
);
```

---

## API Endpoints

### Conversations

```
GET    /api/conversations              - List user's conversations (paginated)
POST   /api/conversations              - Create new conversation
GET    /api/conversations/:id          - Get conversation with messages
PUT    /api/conversations/:id          - Update conversation (title, archive)
DELETE /api/conversations/:id          - Delete conversation

GET    /api/conversations/current      - Get or create current active conversation
```

### Messages

Messages are created through the chat stream endpoint, but we need:

```
GET    /api/conversations/:id/messages - Get messages for conversation (paginated)
```

### Memories (Phase 1.3)

```
GET    /api/memories                   - List user's memories (filterable)
POST   /api/memories                   - Create memory manually
PUT    /api/memories/:id               - Update memory
DELETE /api/memories/:id               - Delete memory
POST   /api/memories/extract           - Extract memories from conversation
```

---

## Frontend Changes

### State Management

```typescript
// New state in useGeneralChat or separate hook
interface ConversationState {
    conversationId: string | null;
    title: string;
    messages: GeneralChatMessage[];
    isLoading: boolean;
}

// Actions
- loadConversation(id: string)
- createNewConversation()
- updateConversationTitle(title: string)
```

### UI Components

1. **Conversation Sidebar** (or dropdown)
   - List of recent conversations
   - "New conversation" button
   - Search/filter conversations

2. **Conversation Header**
   - Editable title
   - Conversation actions (archive, delete)

3. **Memory Panel** (Phase 1.3, in workspace)
   - List of memories
   - Filter by type/category
   - Edit/delete actions
   - "Extract memories" button

---

## Backend Service Changes

### GeneralChatService

Modify to:
1. Accept `conversation_id` in request
2. Create conversation if not provided
3. Save messages after streaming completes
4. Return `conversation_id` in response

```python
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None  # NEW
    context: Dict[str, Any]
    # ... rest unchanged
```

### New Services

```python
# services/conversation_service.py
class ConversationService:
    def create_conversation(user_id: int, title: str = None) -> Conversation
    def get_conversation(conversation_id: int, user_id: int) -> Conversation
    def list_conversations(user_id: int, limit: int, offset: int) -> List[Conversation]
    def update_conversation(conversation_id: int, user_id: int, updates: dict) -> Conversation
    def delete_conversation(conversation_id: int, user_id: int) -> bool
    def add_message(conversation_id: int, message: MessageCreate) -> Message
    def get_messages(conversation_id: int, limit: int, offset: int) -> List[Message]

# services/memory_service.py (Phase 1.3)
class MemoryService:
    def create_memory(user_id: int, memory: MemoryCreate) -> Memory
    def get_memories(user_id: int, filters: MemoryFilters) -> List[Memory]
    def update_memory(memory_id: int, user_id: int, updates: dict) -> Memory
    def delete_memory(memory_id: int, user_id: int) -> bool
    def extract_memories(conversation_id: int) -> List[Memory]
    def get_context_memories(user_id: int) -> List[Memory]  # For system prompt
```

---

## System Prompt Integration

### Current Approach (Phase 1.1-1.2)

Include recent conversation context in system prompt:

```python
def _build_system_prompt(self, context: Dict[str, Any], conversation_history: List[Message]) -> str:
    # ... existing prompt ...

    # Add conversation summary if long
    if len(conversation_history) > 20:
        summary = self._summarize_conversation(conversation_history[:-10])
        prompt += f"\n\n## Conversation Summary\n{summary}"
```

### With Memories (Phase 1.3)

```python
def _build_system_prompt(self, context: Dict[str, Any], memories: List[Memory]) -> str:
    # ... existing prompt ...

    # Add relevant memories
    pinned = [m for m in memories if m.is_pinned]
    recent = [m for m in memories if not m.is_pinned][:10]

    if pinned or recent:
        prompt += "\n\n## What You Know About the User\n"
        for memory in pinned + recent:
            prompt += f"- {memory.content}\n"
```

---

## Implementation Order

### Step 1: Database Setup
1. Create migration for `conversations` table
2. Create migration for `messages` table
3. Add SQLAlchemy models

### Step 2: Backend Services
1. Create `ConversationService`
2. Create conversation router with endpoints
3. Modify `GeneralChatService` to save messages

### Step 3: Frontend Integration
1. Add conversation API client
2. Modify `useGeneralChat` to work with conversation IDs
3. Load messages on page load

### Step 4: UI Polish
1. Add conversation list/selector
2. Add new conversation button
3. Add conversation title editing

### Step 5: Memory Foundation (Phase 1.3)
1. Create `memories` table migration
2. Create `MemoryService`
3. Add memory endpoints
4. Integrate memories into system prompt
5. Add memory UI in workspace

---

## Open Questions

1. **Conversation title generation** - Auto-generate from first message? Use LLM to summarize?

2. **Message storage timing** - Save after each message pair, or after stream completes?

3. **Tool call storage** - Store full input/output or just summary?

4. **Memory extraction** - Manual trigger, automatic after each conversation, or background job?

5. **Context window management** - When conversation gets long, how to summarize/compress?
