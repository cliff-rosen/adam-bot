# CMR Bot Implementation Roadmap

## Current State (Completed)

### Core Infrastructure
- [x] Authentication system (JWT, passwordless login)
- [x] Basic two-panel UI (chat left, workspace right)
- [x] Streaming chat with Anthropic API
- [x] Global tool registry system
- [x] Tool execution with agentic loop (up to 10 iterations)

### Tools Implemented
- [x] `web_search` - Google Custom Search API
- [x] `fetch_webpage` - Web page content extraction

### UI Features
- [x] Real-time streaming text display
- [x] Tool status indicators (Running/Completed)
- [x] Tool history viewer in workspace
- [x] Markdown rendering for responses

---

## Phase 1: Memory & Conversation Persistence

### 1.1 Conversation Storage
- [ ] Database schema for conversations and messages
- [ ] API endpoints for conversation CRUD
- [ ] Load conversation history on page load
- [ ] New conversation / clear conversation UI

### 1.2 Working Memory
- [ ] Current conversation context passed to LLM
- [ ] Session state persistence across page refreshes
- [ ] Conversation summarization for long contexts

### 1.3 Long-term Memory Foundation
- [ ] Database schema for memories (facts, preferences, entities)
- [ ] Memory extraction from conversations
- [ ] Memory retrieval and injection into system prompt
- [ ] Memory management UI (view, edit, delete)

---

## Phase 2: Expanded Tool Library

### 2.1 Information Tools
- [ ] `read_file` - Read local/cloud files
- [ ] `write_file` - Create/update files
- [ ] `search_documents` - Search indexed documents

### 2.2 Communication Tools
- [ ] `send_email` - Email composition and sending
- [ ] `read_email` - Email retrieval and search
- [ ] `calendar_read` - Calendar event retrieval
- [ ] `calendar_write` - Calendar event creation

### 2.3 Utility Tools
- [ ] `run_code` - Sandboxed code execution (Python)
- [ ] `create_note` - Quick note creation to workspace
- [ ] `set_reminder` - Simple scheduling

---

## Phase 3: Asset Workspace

### 3.1 Asset Storage
- [ ] Database schema for assets (documents, notes, code, data)
- [ ] Asset CRUD API endpoints
- [ ] Asset versioning (simple history)

### 3.2 Workspace UI
- [ ] Asset list/browser view
- [ ] Asset detail/editor view
- [ ] Asset creation from chat (agent can create assets)
- [ ] Drag-and-drop file upload

### 3.3 Asset Integration
- [ ] Assets accessible as tool context
- [ ] Asset search and retrieval
- [ ] Asset references in conversations

---

## Phase 4: Background Execution & Scheduling

### 4.1 Task Queue
- [ ] Background task execution infrastructure
- [ ] Task status tracking (queued, running, completed, failed)
- [ ] Task result storage and retrieval

### 4.2 Scheduler Service
- [ ] Scheduled task database schema
- [ ] `schedule_task` tool for the agent
- [ ] Recurring task support
- [ ] Schedule management UI

### 4.3 Notifications
- [ ] Notification storage and delivery
- [ ] In-app notification center
- [ ] Optional email/push notifications

---

## Phase 5: Sub-Agents & Delegation

### 5.1 Agent Registry
- [ ] Sub-agent definition schema
- [ ] Agent creation/configuration UI
- [ ] Agent tool/skill assignment

### 5.2 Delegation System
- [ ] Primary agent can spawn sub-agents
- [ ] Context handoff to sub-agents
- [ ] Result aggregation from sub-agents

### 5.3 Persistent Monitors
- [ ] Always-on background agents
- [ ] Monitoring patterns (real estate, news, etc.)
- [ ] Proactive notification triggers

---

## Phase 6: RAG & Large Asset Handling

### 6.1 Document Processing
- [ ] Document chunking strategies
- [ ] Embedding generation and storage
- [ ] Vector search integration

### 6.2 Retrieval
- [ ] Semantic search over assets
- [ ] Hybrid retrieval (semantic + keyword)
- [ ] Context-aware retrieval for conversations

### 6.3 Summarization
- [ ] Hierarchical document summaries
- [ ] Progressive disclosure (summary → detail)
- [ ] Cross-document synthesis

---

## Phase 7: Self-Improvement

### 7.1 Tool Creation
- [ ] Agent can define new tools
- [ ] Tool testing and validation
- [ ] Tool library management

### 7.2 Performance Reflection
- [ ] Outcome tracking for agent actions
- [ ] Reflection prompts for improvement
- [ ] Prompt refinement based on outcomes

---

## Technical Debt & Polish

- [ ] Remove debug console.log statements
- [ ] Error handling improvements
- [ ] Loading states and skeleton UI
- [ ] Mobile responsiveness
- [ ] Comprehensive testing
- [ ] Documentation
