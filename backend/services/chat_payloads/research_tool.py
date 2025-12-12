"""
Deep Research Tool

A high-level research tool that orchestrates search-fetch-analyze loops
with built-in strategy. Instead of the LLM manually calling web_search
and fetch_webpage repeatedly, it calls this once with a research goal.

The workflow is hardcoded but uses LLMs at decision points:
1. Break goal into checklist of information needs
2. Loop until satisfied:
   - Generate targeted search queries for unfilled items
   - Execute searches
   - Evaluate which URLs to fetch
   - Fetch and extract relevant information
   - Update checklist with findings
3. Synthesize into final output
"""

import logging
import asyncio
import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
import anthropic

from .registry import ToolConfig, ToolResult, register_tool

logger = logging.getLogger(__name__)

# Use a fast model for the inner LLM calls
RESEARCH_MODEL = "claude-sonnet-4-20250514"
MAX_RESEARCH_ITERATIONS = 5
MAX_URLS_PER_ITERATION = 3
MAX_SEARCH_RESULTS = 8


@dataclass
class ChecklistItem:
    """An item of information we need to find."""
    question: str
    status: str = "unfilled"  # unfilled, partial, complete
    findings: List[str] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)


@dataclass
class ResearchState:
    """Current state of the research process."""
    goal: str
    checklist: List[ChecklistItem] = field(default_factory=list)
    all_sources: List[str] = field(default_factory=list)
    search_queries_used: List[str] = field(default_factory=list)
    iteration: int = 0


class DeepResearchEngine:
    """Orchestrates the research workflow."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    def run(self, topic: str, goal: str, db: Session, user_id: int) -> ToolResult:
        """Execute the full research workflow."""
        state = ResearchState(goal=goal)

        try:
            # Step 1: Break goal into checklist
            logger.info(f"Research: Creating checklist for '{goal}'")
            self._create_checklist(state, topic)

            if not state.checklist:
                return ToolResult(text="Failed to create research checklist")

            # Step 2: Research loop
            while state.iteration < MAX_RESEARCH_ITERATIONS:
                state.iteration += 1
                logger.info(f"Research iteration {state.iteration}")

                # Check if we're done
                unfilled = [c for c in state.checklist if c.status != "complete"]
                if not unfilled:
                    logger.info("Research complete - all items filled")
                    break

                # Generate and execute searches
                queries = self._generate_queries(state, unfilled)
                if not queries:
                    logger.info("No more queries to try")
                    break

                search_results = self._execute_searches(queries)
                if not search_results:
                    continue

                # Evaluate and fetch promising URLs
                urls_to_fetch = self._evaluate_urls(state, search_results, unfilled)
                if not urls_to_fetch:
                    continue

                # Fetch pages and extract info
                page_contents = self._fetch_pages(urls_to_fetch)
                if page_contents:
                    self._extract_and_update(state, page_contents, unfilled)

            # Step 3: Synthesize findings
            logger.info("Research: Synthesizing findings")
            return self._synthesize(state, topic)

        except Exception as e:
            logger.error(f"Research error: {e}", exc_info=True)
            return ToolResult(text=f"Research failed: {str(e)}")

    def _create_checklist(self, state: ResearchState, topic: str):
        """Use LLM to break the goal into specific information needs."""
        response = self.client.messages.create(
            model=RESEARCH_MODEL,
            max_tokens=1024,
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": f"""Break this research goal into 3-6 specific questions/information needs.

Topic: {topic}
Goal: {state.goal}

Return ONLY a JSON array of strings, each a specific question to answer.
Example: ["What is X?", "When did Y happen?", "Who are the key people in Z?"]

JSON array:"""
            }]
        )

        import json
        text = response.content[0].text.strip()
        # Handle markdown code blocks
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        try:
            questions = json.loads(text)
            state.checklist = [ChecklistItem(question=q) for q in questions]
            logger.info(f"Created checklist with {len(state.checklist)} items")
        except json.JSONDecodeError:
            logger.error(f"Failed to parse checklist: {text}")
            # Fallback: single item
            state.checklist = [ChecklistItem(question=state.goal)]

    def _generate_queries(self, state: ResearchState, unfilled: List[ChecklistItem]) -> List[str]:
        """Generate search queries for unfilled checklist items."""
        unfilled_text = "\n".join(f"- {c.question}" for c in unfilled[:3])
        used_queries = "\n".join(f"- {q}" for q in state.search_queries_used[-10:]) or "None yet"

        response = self.client.messages.create(
            model=RESEARCH_MODEL,
            max_tokens=512,
            temperature=0.5,
            messages=[{
                "role": "user",
                "content": f"""Generate 2-3 search queries to find information for these questions:

{unfilled_text}

Previously used queries (avoid repeating):
{used_queries}

Return ONLY a JSON array of search query strings. Be specific and varied.
JSON array:"""
            }]
        )

        import json
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        try:
            queries = json.loads(text)
            # Filter out already-used queries
            new_queries = [q for q in queries if q not in state.search_queries_used]
            state.search_queries_used.extend(new_queries)
            return new_queries[:3]
        except json.JSONDecodeError:
            logger.error(f"Failed to parse queries: {text}")
            return []

    def _execute_searches(self, queries: List[str]) -> List[Dict[str, Any]]:
        """Execute search queries and collect results."""
        from services.search_service import SearchService

        all_results = []
        search_service = SearchService()
        if not search_service.initialized:
            search_service.initialize()

        for query in queries:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(
                        search_service.search(search_term=query, num_results=MAX_SEARCH_RESULTS)
                    )
                finally:
                    loop.close()

                for item in result.get("search_results", []):
                    all_results.append({
                        "title": item.title,
                        "url": item.url,
                        "snippet": item.snippet,
                        "query": query
                    })
            except Exception as e:
                logger.error(f"Search error for '{query}': {e}")

        # Dedupe by URL
        seen_urls = set()
        deduped = []
        for r in all_results:
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                deduped.append(r)

        return deduped

    def _evaluate_urls(
        self,
        state: ResearchState,
        search_results: List[Dict[str, Any]],
        unfilled: List[ChecklistItem]
    ) -> List[str]:
        """Use LLM to pick which URLs are worth fetching."""
        if not search_results:
            return []

        # Format search results
        results_text = ""
        for i, r in enumerate(search_results[:15]):
            results_text += f"{i+1}. {r['title']}\n   URL: {r['url']}\n   {r['snippet']}\n\n"

        unfilled_text = "\n".join(f"- {c.question}" for c in unfilled[:3])
        already_fetched = "\n".join(f"- {u}" for u in state.all_sources[-10:]) or "None"

        response = self.client.messages.create(
            model=RESEARCH_MODEL,
            max_tokens=256,
            temperature=0.2,
            messages=[{
                "role": "user",
                "content": f"""Which search results are most likely to contain useful information?

Information needed:
{unfilled_text}

Already fetched (skip these):
{already_fetched}

Search results:
{results_text}

Return ONLY a JSON array of result numbers (1-indexed) to fetch. Pick up to {MAX_URLS_PER_ITERATION} most promising.
Example: [1, 3, 5]
JSON array:"""
            }]
        )

        import json
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        try:
            indices = json.loads(text)
            urls = []
            for idx in indices[:MAX_URLS_PER_ITERATION]:
                if 1 <= idx <= len(search_results):
                    url = search_results[idx - 1]["url"]
                    if url not in state.all_sources:
                        urls.append(url)
            return urls
        except (json.JSONDecodeError, TypeError):
            logger.error(f"Failed to parse URL indices: {text}")
            return []

    def _fetch_pages(self, urls: List[str]) -> List[Dict[str, str]]:
        """Fetch content from URLs."""
        from services.web_retrieval_service import WebRetrievalService

        pages = []
        service = WebRetrievalService()

        for url in urls:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(
                        service.retrieve_webpage(url=url, extract_text_only=True)
                    )
                finally:
                    loop.close()

                webpage = result["webpage"]
                content = webpage.content[:6000]  # Limit per page
                pages.append({
                    "url": url,
                    "title": webpage.title,
                    "content": content
                })
            except Exception as e:
                logger.error(f"Fetch error for {url}: {e}")

        return pages

    def _extract_and_update(
        self,
        state: ResearchState,
        pages: List[Dict[str, str]],
        unfilled: List[ChecklistItem]
    ):
        """Extract relevant info from pages and update checklist."""
        for page in pages:
            state.all_sources.append(page["url"])

        # Build context of what we're looking for
        questions_text = "\n".join(f"{i+1}. {c.question}" for i, c in enumerate(unfilled))

        # Build page contents
        pages_text = ""
        for p in pages:
            pages_text += f"=== {p['title']} ({p['url']}) ===\n{p['content']}\n\n"

        response = self.client.messages.create(
            model=RESEARCH_MODEL,
            max_tokens=2048,
            temperature=0.2,
            messages=[{
                "role": "user",
                "content": f"""Extract information from these pages that answers our questions.

Questions we need to answer:
{questions_text}

Page contents:
{pages_text}

For each question, extract relevant facts found. Return JSON:
{{
  "extractions": [
    {{"question_index": 1, "findings": ["fact 1", "fact 2"], "complete": true/false}},
    ...
  ]
}}

Only include questions where you found relevant information.
JSON:"""
            }]
        )

        import json
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        try:
            data = json.loads(text)
            for ext in data.get("extractions", []):
                idx = ext.get("question_index", 0) - 1
                if 0 <= idx < len(unfilled):
                    item = unfilled[idx]
                    item.findings.extend(ext.get("findings", []))
                    item.sources.extend(p["url"] for p in pages)
                    if ext.get("complete", False):
                        item.status = "complete"
                    elif item.findings:
                        item.status = "partial"
        except json.JSONDecodeError:
            logger.error(f"Failed to parse extractions: {text}")

    def _synthesize(self, state: ResearchState, topic: str) -> ToolResult:
        """Synthesize all findings into a final output."""
        # Build summary of what we found
        findings_text = ""
        for item in state.checklist:
            status_icon = {"complete": "✓", "partial": "◐", "unfilled": "○"}.get(item.status, "?")
            findings_text += f"\n{status_icon} {item.question}\n"
            if item.findings:
                for f in item.findings:
                    findings_text += f"  - {f}\n"
            else:
                findings_text += "  (No information found)\n"

        response = self.client.messages.create(
            model=RESEARCH_MODEL,
            max_tokens=3000,
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": f"""Synthesize these research findings into a comprehensive summary.

Topic: {topic}
Goal: {state.goal}

Findings by question:
{findings_text}

Write a well-organized summary that addresses the research goal. Include key facts and insights.
Be thorough but concise. Note any gaps where information couldn't be found."""
            }]
        )

        synthesis = response.content[0].text

        # Add sources
        if state.all_sources:
            synthesis += "\n\n**Sources:**\n"
            for url in state.all_sources[:10]:
                synthesis += f"- {url}\n"

        # Build structured data for potential UI use
        return ToolResult(
            text=synthesis,
            data={
                "type": "research_result",
                "topic": topic,
                "goal": state.goal,
                "checklist": [
                    {
                        "question": c.question,
                        "status": c.status,
                        "findings": c.findings,
                        "sources": c.sources
                    }
                    for c in state.checklist
                ],
                "sources": state.all_sources,
                "iterations": state.iteration
            }
        )


def execute_deep_research(
    params: Dict[str, Any],
    db: Session,
    user_id: int,
    context: Dict[str, Any]
) -> ToolResult:
    """Execute deep research on a topic."""
    topic = params.get("topic", "")
    goal = params.get("goal", "")

    if not topic:
        return ToolResult(text="Error: No research topic provided")
    if not goal:
        goal = f"Comprehensive research on {topic}"

    engine = DeepResearchEngine()
    return engine.run(topic, goal, db, user_id)


DEEP_RESEARCH_TOOL = ToolConfig(
    name="deep_research",
    description="""Conduct comprehensive research on a topic. This tool automatically:
1. Breaks your goal into specific questions
2. Generates varied search queries
3. Evaluates and fetches promising sources
4. Extracts relevant information
5. Synthesizes findings into a summary

Use this instead of manual web_search + fetch_webpage loops when you need thorough research.""",
    input_schema={
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "The topic to research"
            },
            "goal": {
                "type": "string",
                "description": "Specific research goal or questions to answer (optional - defaults to comprehensive research)"
            }
        },
        "required": ["topic"]
    },
    executor=execute_deep_research,
    category="research"
)


def register_research_tools():
    """Register research tools."""
    register_tool(DEEP_RESEARCH_TOOL)
    logger.info("Registered deep_research tool")
