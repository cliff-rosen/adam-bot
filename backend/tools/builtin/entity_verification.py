"""
Entity Verification Workflow

An orchestrated workflow that verifies a business entity on a platform.
This is NOT an autonomous agent - the code orchestrates, the LLM advises.

Workflow steps:
1. Search for the business
2. Ask LLM for best guess from results
3. Fetch the guessed page
4. Show LLM what we found
5. Loop: LLM says "confirmed" / "not it, try X" / "give up"
"""

import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional, Literal, Generator
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Configuration
LLM_MODEL = "claude-sonnet-4-20250514"
MAX_ITERATIONS = 5


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class SearchResult:
    """A single search result."""
    title: str
    url: str
    snippet: str


@dataclass
class EntityCandidate:
    """A potential entity match suggested by the LLM."""
    name: str
    url: str
    reason: str
    confidence: Literal["high", "medium", "low"]


@dataclass
class VerificationStep:
    """A step in the verification process."""
    iteration: int
    action: Literal["search", "fetch", "llm_guess", "llm_verify"]
    input: str
    output: str
    duration_ms: int


@dataclass
class VerificationResult:
    """Result of entity verification."""
    status: Literal["confirmed", "not_found", "ambiguous", "gave_up", "error"]
    entity: Optional[EntityCandidate]
    page_content: Optional[str]  # The verified page content for downstream use
    steps: List[VerificationStep]
    total_duration_ms: int
    message: str


# =============================================================================
# LLM Prompts (structured, focused)
# =============================================================================

GUESS_PROMPT = """You are identifying a business from search results.

    TARGET BUSINESS: "{business_name}" in "{location}"
    PLATFORM: {source}

    Here are the search results:
    {search_results}

    TASK: Pick the BEST candidate URL for this business, or say none match.

    Respond in this exact JSON format:
    ```json
    {{
        "decision": "found" | "none_match",
        "candidate": {{
            "name": "exact name shown in results",
            "url": "the URL to verify",
            "reason": "why this is likely the right business",
            "confidence": "high" | "medium" | "low"
        }},
        "alternative_search": "if none match, suggest a better search query"
    }}
    ```

    Rules:
    - For Yelp, look for URLs like yelp.com/biz/...
    - Match location carefully - same city/state
    - If multiple good matches, pick the one with strongest signals
    - If none look right, say "none_match" and suggest a better search"""

VERIFY_PROMPT = """You are verifying this is the correct business.

    TARGET BUSINESS: "{business_name}" in "{location}"
    EXPECTED URL: {url}

    Here is the page content:
    ---
    {page_content}
    ---

    TASK: Determine if this page is for the exact target business.

    Respond in this exact JSON format:
    ```json
    {{
        "decision": "confirmed" | "not_it" | "give_up",
        "entity": {{
            "name": "exact business name from page",
            "url": "{url}",
            "reason": "why you're confident (address match, name match, etc)",
            "confidence": "high" | "medium" | "low"
        }},
        "next_search": "if not_it, suggest what to search next",
        "give_up_reason": "if give_up, explain why"
    }}
    ```

    Rules:
    - "confirmed" = definitely the right business (name AND location match)
    - "not_it" = wrong business, but we could try another search
    - "give_up" = can't find this business on this platform
    - Be strict: partial name matches or wrong locations are "not_it" """


# =============================================================================
# Core Functions
# =============================================================================

def _do_search(query: str, db, user_id: int, context: Dict) -> List[SearchResult]:
    """Execute a search and return results."""
    from services.search_service import SearchService
    import asyncio

    search_service = SearchService()
    if not search_service.initialized:
        search_service.initialize()

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            search_service.search(search_term=query, num_results=10)
        )
    finally:
        loop.close()

    results = []
    for r in result.get("search_results", []):
        results.append(SearchResult(
            title=getattr(r, 'title', ''),
            url=getattr(r, 'url', ''),
            snippet=getattr(r, 'snippet', '') or ''
        ))

    return results


def _do_fetch(url: str, needs_js: bool = False) -> tuple[str, bool]:
    """Fetch a page and return (content, was_blocked)."""
    import asyncio

    try:
        if needs_js:
            from services.js_web_retrieval_service import fetch_with_js

            loop = asyncio.new_event_loop()
            try:
                result = loop.run_until_complete(
                    fetch_with_js(url=url, timeout=45000, wait_after_load=3000)
                )
            finally:
                loop.close()

            webpage = result["webpage"]
            content = webpage.content
            was_blocked = webpage.metadata.get('blocked', False)

            if was_blocked:
                return f"[BLOCKED: {webpage.metadata.get('block_reason', 'Unknown')}]", True

            # Truncate for LLM
            if len(content) > 12000:
                content = content[:12000] + "\n\n[Content truncated]"

            return content, False
        else:
            from services.web_retrieval_service import WebRetrievalService

            web_service = WebRetrievalService()
            loop = asyncio.new_event_loop()
            try:
                result = loop.run_until_complete(
                    web_service.retrieve_webpage(url=url, extract_text_only=True)
                )
            finally:
                loop.close()

            content = result["webpage"].content
            if len(content) > 12000:
                content = content[:12000] + "\n\n[Content truncated]"

            return content, False

    except Exception as e:
        logger.error(f"Fetch error for {url}: {e}")
        return f"[FETCH ERROR: {str(e)}]", True


def _call_llm(prompt: str) -> str:
    """Call the LLM and return its response."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=LLM_MODEL,
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text


def _parse_json_response(text: str) -> Optional[Dict]:
    """Extract JSON from LLM response."""
    import re

    # Try code block first
    json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try raw JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    return None


def _needs_js_rendering(url: str) -> bool:
    """Check if URL needs JavaScript rendering."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    js_domains = [
        'yelp.com', 'www.yelp.com',
        'google.com', 'www.google.com', 'maps.google.com',
        'healthgrades.com', 'www.healthgrades.com',
    ]

    return any(domain.endswith(d) or domain == d for d in js_domains)


def _get_site_operator(source: str) -> str:
    """Get the site: operator for a source."""
    if source == "yelp":
        return "site:yelp.com/biz"
    elif source == "google":
        return "site:google.com/maps OR site:maps.google.com"
    elif source == "reddit":
        return "site:reddit.com"
    else:
        return ""


# =============================================================================
# Main Verification Workflow
# =============================================================================

def verify_entity(
    business_name: str,
    location: str,
    source: str,
    db,
    user_id: int,
    context: Dict[str, Any],
    on_progress: Optional[callable] = None
) -> Generator[Dict[str, Any], None, VerificationResult]:
    """
    Orchestrated entity verification workflow.

    Yields progress updates, returns final VerificationResult.

    The workflow:
    1. Search for the business
    2. Ask LLM for best guess
    3. Fetch the page
    4. Ask LLM to verify
    5. Loop until confirmed, gave up, or max iterations
    """
    start_time = time.time()
    steps: List[VerificationStep] = []
    iteration = 0

    site_op = _get_site_operator(source)
    search_query = f'{site_op} "{business_name}" {location}'

    verified_content = None  # Store verified page content

    while iteration < MAX_ITERATIONS:
        iteration += 1
        logger.info(f"Entity verification iteration {iteration}/{MAX_ITERATIONS}")

        # === STEP 1: Search ===
        yield {"stage": "searching", "message": f"Search [{iteration}]: {search_query[:50]}...", "iteration": iteration}

        step_start = time.time()
        search_results = _do_search(search_query, db, user_id, context)
        step_duration = int((time.time() - step_start) * 1000)

        steps.append(VerificationStep(
            iteration=iteration,
            action="search",
            input=search_query,
            output=f"{len(search_results)} results",
            duration_ms=step_duration
        ))

        if not search_results:
            yield {"stage": "no_results", "message": "No search results", "iteration": iteration}
            # LLM might suggest different search
            search_query = f'{site_op} {business_name} {location.split(",")[0]}'
            continue

        # Format results for LLM
        results_text = "\n".join([
            f"{i+1}. {r.title}\n   URL: {r.url}\n   {r.snippet[:200]}"
            for i, r in enumerate(search_results[:8])
        ])

        # === STEP 2: Ask LLM for best guess ===
        yield {"stage": "analyzing", "message": f"Analyzing {len(search_results)} results", "iteration": iteration}

        guess_prompt = GUESS_PROMPT.format(
            business_name=business_name,
            location=location,
            source=source.upper(),
            search_results=results_text
        )

        step_start = time.time()
        guess_response = _call_llm(guess_prompt)
        step_duration = int((time.time() - step_start) * 1000)

        steps.append(VerificationStep(
            iteration=iteration,
            action="llm_guess",
            input=f"{len(search_results)} results",
            output=guess_response[:200],
            duration_ms=step_duration
        ))

        guess_data = _parse_json_response(guess_response)
        if not guess_data:
            logger.warning(f"Could not parse guess response: {guess_response[:200]}")
            yield {"stage": "parse_error", "message": "Could not parse LLM response", "iteration": iteration}
            # Try a different search
            search_query = f'"{business_name}" {location} {source}'
            continue

        if guess_data.get("decision") == "none_match":
            alt_search = guess_data.get("alternative_search", "")
            if alt_search:
                yield {"stage": "no_match", "message": f"No match, trying: {alt_search[:40]}...", "iteration": iteration}
                search_query = f'{site_op} {alt_search}'
                continue
            else:
                # Give up
                total_duration = int((time.time() - start_time) * 1000)
                return VerificationResult(
                    status="not_found",
                    entity=None,
                    page_content=None,
                    steps=steps,
                    total_duration_ms=total_duration,
                    message=f"Could not find {business_name} on {source.upper()}"
                )

        # We have a candidate
        candidate_data = guess_data.get("candidate", {})
        candidate = EntityCandidate(
            name=candidate_data.get("name", business_name),
            url=candidate_data.get("url", ""),
            reason=candidate_data.get("reason", ""),
            confidence=candidate_data.get("confidence", "low")
        )

        if not candidate.url:
            yield {"stage": "no_url", "message": "Candidate has no URL", "iteration": iteration}
            search_query = f'{site_op} "{business_name}" "{location}"'
            continue

        # === STEP 3: Fetch the page ===
        yield {"stage": "fetching", "message": f"Fetching {candidate.url[:50]}...", "iteration": iteration}

        step_start = time.time()
        needs_js = _needs_js_rendering(candidate.url)
        page_content, was_blocked = _do_fetch(candidate.url, needs_js)
        step_duration = int((time.time() - step_start) * 1000)

        steps.append(VerificationStep(
            iteration=iteration,
            action="fetch",
            input=candidate.url,
            output=f"{len(page_content)} chars" + (" [BLOCKED]" if was_blocked else ""),
            duration_ms=step_duration
        ))

        if was_blocked:
            yield {"stage": "blocked", "message": "Page blocked, trying different approach", "iteration": iteration}
            # Try fetching a different result from search
            for r in search_results[1:4]:
                if source in r.url.lower():
                    candidate.url = r.url
                    break
            continue

        # === STEP 4: Ask LLM to verify ===
        yield {"stage": "verifying", "message": "Verifying business identity", "iteration": iteration}

        verify_prompt = VERIFY_PROMPT.format(
            business_name=business_name,
            location=location,
            url=candidate.url,
            page_content=page_content
        )

        step_start = time.time()
        verify_response = _call_llm(verify_prompt)
        step_duration = int((time.time() - step_start) * 1000)

        steps.append(VerificationStep(
            iteration=iteration,
            action="llm_verify",
            input=candidate.url,
            output=verify_response[:200],
            duration_ms=step_duration
        ))

        verify_data = _parse_json_response(verify_response)
        if not verify_data:
            logger.warning(f"Could not parse verify response: {verify_response[:200]}")
            continue

        decision = verify_data.get("decision", "not_it")

        if decision == "confirmed":
            # SUCCESS!
            entity_data = verify_data.get("entity", {})
            confirmed_entity = EntityCandidate(
                name=entity_data.get("name", candidate.name),
                url=entity_data.get("url", candidate.url),
                reason=entity_data.get("reason", ""),
                confidence=entity_data.get("confidence", "medium")
            )

            total_duration = int((time.time() - start_time) * 1000)
            yield {"stage": "confirmed", "message": f"Confirmed: {confirmed_entity.name}", "iteration": iteration}

            return VerificationResult(
                status="confirmed",
                entity=confirmed_entity,
                page_content=page_content,  # Return for artifact collection
                steps=steps,
                total_duration_ms=total_duration,
                message=f"Verified {confirmed_entity.name} on {source.upper()}"
            )

        elif decision == "give_up":
            reason = verify_data.get("give_up_reason", "Could not verify")
            total_duration = int((time.time() - start_time) * 1000)
            yield {"stage": "gave_up", "message": reason, "iteration": iteration}

            return VerificationResult(
                status="gave_up",
                entity=None,
                page_content=None,
                steps=steps,
                total_duration_ms=total_duration,
                message=reason
            )

        else:  # not_it
            next_search = verify_data.get("next_search", "")
            if next_search:
                yield {"stage": "not_it", "message": f"Wrong business, trying: {next_search[:40]}...", "iteration": iteration}
                search_query = f'{site_op} {next_search}'
            else:
                # Modify current search
                search_query = f'{site_op} "{business_name}" exact {location}'

    # Max iterations reached
    total_duration = int((time.time() - start_time) * 1000)
    return VerificationResult(
        status="gave_up",
        entity=None,
        page_content=None,
        steps=steps,
        total_duration_ms=total_duration,
        message=f"Could not verify entity after {MAX_ITERATIONS} attempts"
    )


# =============================================================================
# Synchronous wrapper
# =============================================================================

def verify_entity_sync(
    business_name: str,
    location: str,
    source: str,
    db,
    user_id: int,
    context: Dict[str, Any]
) -> tuple[VerificationResult, List[Dict[str, Any]]]:
    """
    Synchronous wrapper that collects all progress and returns final result.
    Returns (result, progress_events).
    """
    progress_events = []
    result = None

    gen = verify_entity(business_name, location, source, db, user_id, context)

    try:
        while True:
            progress = next(gen)
            progress_events.append(progress)
    except StopIteration as e:
        result = e.value

    return result, progress_events
