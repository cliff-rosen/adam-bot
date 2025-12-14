"""
PubMed Smart Search Tool

A semantic search tool for PubMed that:
1. Takes a natural language description of desired articles
2. Generates optimized keyword searches
3. Runs multiple searches and collects results
4. Filters results using LLM to match semantic intent
5. Returns filtered results with detailed metadata

This is more intelligent than raw pubmed_search because it:
- Translates semantic intent into multiple keyword queries
- Filters out keyword matches that don't match the semantic intent
- Provides transparency into the search process
"""

import json
import logging
import os
import asyncio
from typing import Any, Dict, Generator, List, Optional, Set
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
import anthropic

from tools.registry import ToolConfig, ToolResult, ToolProgress, register_tool

logger = logging.getLogger(__name__)

SMART_SEARCH_MODEL = "claude-sonnet-4-20250514"
MAX_QUERIES = 5
MAX_RESULTS_PER_QUERY = 20
MAX_TOTAL_RESULTS = 50
BATCH_SIZE_FOR_FILTERING = 10


@dataclass
class SearchQueryResult:
    """Result from a single keyword query."""
    query: str
    total_hits: int
    articles_fetched: int
    articles: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SmartSearchMeta:
    """Metadata about the smart search process."""
    semantic_description: str
    generated_queries: List[str]
    query_results: List[Dict[str, Any]]  # Per-query stats
    total_hits_across_searches: int
    total_articles_fetched: int
    total_after_dedup: int
    total_after_filtering: int
    filtered_out_count: int


def _generate_search_queries(
    client: anthropic.Anthropic,
    semantic_description: str,
    max_queries: int = MAX_QUERIES
) -> List[str]:
    """
    Use LLM to generate PubMed keyword queries from a semantic description.
    """
    response = client.messages.create(
        model=SMART_SEARCH_MODEL,
        max_tokens=1024,
        temperature=0.3,
        messages=[{
            "role": "user",
            "content": f"""You are a PubMed search expert. Generate {max_queries} different keyword search queries
            that would help find articles matching this description:

            "{semantic_description}"

            Guidelines:
            - Use PubMed search syntax (AND, OR, field tags like [Title], [MeSH Terms])
            - Each query should approach the topic from a different angle
            - Include both broad and specific queries
            - Use MeSH terms when appropriate for medical/biological concepts
            - Keep queries focused and likely to return relevant results

            Respond with a JSON array of query strings only, no explanation:
            ["query1", "query2", ...]"""
        }]
    )

    response_text = response.content[0].text.strip()

    # Parse JSON array
    try:
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            start_idx = 1
            end_idx = len(lines)
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == "```":
                    end_idx = i
                    break
            response_text = "\n".join(lines[start_idx:end_idx]).strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        queries = json.loads(response_text)
        if isinstance(queries, list):
            return queries[:max_queries]
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse query generation response: {response_text}")

    # Fallback: extract quoted strings
    import re
    quoted = re.findall(r'"([^"]+)"', response_text)
    if quoted:
        return quoted[:max_queries]

    # Last resort: use description as-is
    return [semantic_description]


def _filter_articles_batch(
    client: anthropic.Anthropic,
    articles: List[Dict[str, Any]],
    semantic_description: str
) -> List[Dict[str, Any]]:
    """
    Use LLM to filter a batch of articles based on semantic relevance.
    Returns only the articles that match the semantic intent.
    """
    if not articles:
        return []

    # Build article summaries for evaluation
    article_summaries = []
    for i, article in enumerate(articles):
        summary = f"""Article {i + 1}:
        Title: {article.get('title', 'N/A')}
        Abstract: {(article.get('abstract') or 'No abstract available')[:500]}
        Journal: {article.get('journal', 'N/A')}
        """
        article_summaries.append(summary)

    articles_text = "\n---\n".join(article_summaries)

    response = client.messages.create(
        model=SMART_SEARCH_MODEL,
        max_tokens=1024,
        temperature=0.2,
        messages=[{
            "role": "user",
            "content": f"""You are evaluating PubMed articles for semantic relevance.

            Target: Articles that match this description:
            "{semantic_description}"

            Articles to evaluate:
            {articles_text}

            For each article, determine if it semantically matches the target description.
            A keyword match is NOT sufficient - the article must actually be about the topic described.

            Respond with a JSON array of article numbers (1-indexed) that ARE relevant:
            [1, 3, 5]

            If none are relevant, respond with an empty array: []

            JSON response:"""
        }]
    )

    response_text = response.content[0].text.strip()

    try:
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            start_idx = 1
            end_idx = len(lines)
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == "```":
                    end_idx = i
                    break
            response_text = "\n".join(lines[start_idx:end_idx]).strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        relevant_indices = json.loads(response_text)
        if isinstance(relevant_indices, list):
            # Convert to 0-indexed and filter
            return [
                articles[idx - 1]
                for idx in relevant_indices
                if isinstance(idx, int) and 1 <= idx <= len(articles)
            ]
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse filter response: {response_text}")

    # Fallback: return all articles (conservative)
    return articles


def execute_pubmed_smart_search(
    params: Dict[str, Any],
    db: Session,
    user_id: int,
    context: Dict[str, Any]
) -> Generator[ToolProgress, None, ToolResult]:
    """
    Execute a semantic PubMed search.

    This is a streaming tool that yields progress updates.
    """
    from services.pubmed_service import PubMedService

    description = params.get("description", "")
    max_results = min(params.get("max_results", 20), MAX_TOTAL_RESULTS)
    date_range = params.get("date_range")
    include_no_abstract = params.get("include_no_abstract", False)

    if not description:
        return ToolResult(text="Error: No description provided")

    cancellation_token = context.get("cancellation_token")
    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
    pubmed_service = PubMedService()

    # Calculate date range if specified
    start_date = None
    end_date = None
    if date_range:
        from datetime import datetime, timedelta
        today = datetime.now()
        end_date = today.strftime("%Y/%m/%d")

        if date_range == "last_week":
            start_date = (today - timedelta(days=7)).strftime("%Y/%m/%d")
        elif date_range == "last_month":
            start_date = (today - timedelta(days=30)).strftime("%Y/%m/%d")
        elif date_range == "last_3_months":
            start_date = (today - timedelta(days=90)).strftime("%Y/%m/%d")
        elif date_range == "last_6_months":
            start_date = (today - timedelta(days=180)).strftime("%Y/%m/%d")
        elif date_range == "last_year":
            start_date = (today - timedelta(days=365)).strftime("%Y/%m/%d")

    # Step 1: Generate search queries
    yield ToolProgress(
        stage="generating_queries",
        message="Analyzing description and generating search strategies...",
        data={"description": description[:100]},
        progress=0.1
    )

    if cancellation_token and cancellation_token.is_cancelled:
        return ToolResult(text="Search cancelled")

    queries = _generate_search_queries(client, description)

    yield ToolProgress(
        stage="queries_generated",
        message=f"Generated {len(queries)} search queries",
        data={"queries": queries},
        progress=0.2
    )

    # Step 2: Execute searches
    all_articles: Dict[str, Dict[str, Any]] = {}  # pmid -> article (for dedup)
    query_results: List[SearchQueryResult] = []
    total_hits = 0

    for i, query in enumerate(queries):
        if cancellation_token and cancellation_token.is_cancelled:
            return ToolResult(text="Search cancelled")

        yield ToolProgress(
            stage="searching",
            message=f"Executing search {i + 1}/{len(queries)}: {query[:50]}...",
            data={"query_index": i + 1, "total_queries": len(queries), "query": query},
            progress=0.2 + (0.3 * (i / len(queries)))
        )

        try:
            articles, metadata = pubmed_service.search_articles(
                query=query,
                max_results=MAX_RESULTS_PER_QUERY,
                sort_by="relevance",
                start_date=start_date,
                end_date=end_date
            )

            query_total = metadata.get("total_results", 0)
            total_hits += query_total

            query_result = SearchQueryResult(
                query=query,
                total_hits=query_total,
                articles_fetched=len(articles)
            )

            # Add articles, deduplicating by PMID
            new_count = 0
            for article in articles:
                pmid = article.pmid
                if pmid and pmid not in all_articles:
                    # Skip articles without abstract if not wanted
                    if not include_no_abstract and not article.abstract:
                        continue

                    all_articles[pmid] = {
                        "pmid": pmid,
                        "title": article.title,
                        "authors": article.authors,
                        "authors_display": ", ".join(article.authors[:3]) + (" et al." if len(article.authors) > 3 else "") if article.authors else "",
                        "journal": article.journal,
                        "publication_date": article.publication_date,
                        "abstract": article.abstract,
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                    }
                    new_count += 1

            query_result.articles = [all_articles[a.pmid] for a in articles if a.pmid in all_articles]
            query_results.append(query_result)

            logger.info(f"Query '{query}': {query_total} total, {len(articles)} fetched, {new_count} new unique")

        except Exception as e:
            logger.error(f"Error executing query '{query}': {e}")
            query_results.append(SearchQueryResult(
                query=query,
                total_hits=0,
                articles_fetched=0
            ))

    articles_before_filter = list(all_articles.values())

    yield ToolProgress(
        stage="dedup_complete",
        message=f"Found {len(articles_before_filter)} unique articles from {len(queries)} searches",
        data={
            "unique_articles": len(articles_before_filter),
            "total_hits": total_hits
        },
        progress=0.5
    )

    if not articles_before_filter:
        meta = SmartSearchMeta(
            semantic_description=description,
            generated_queries=queries,
            query_results=[{
                "query": qr.query,
                "total_hits": qr.total_hits,
                "articles_fetched": qr.articles_fetched
            } for qr in query_results],
            total_hits_across_searches=total_hits,
            total_articles_fetched=0,
            total_after_dedup=0,
            total_after_filtering=0,
            filtered_out_count=0
        )

        return ToolResult(
            text="No articles found matching your criteria.",
            data={
                "success": False,
                "reason": "no_results",
                "meta": meta.__dict__
            }
        )

    # Step 3: Filter articles semantically
    yield ToolProgress(
        stage="filtering",
        message="Filtering articles by semantic relevance...",
        data={"articles_to_filter": len(articles_before_filter)},
        progress=0.6
    )

    filtered_articles: List[Dict[str, Any]] = []

    # Process in batches
    for batch_start in range(0, len(articles_before_filter), BATCH_SIZE_FOR_FILTERING):
        if cancellation_token and cancellation_token.is_cancelled:
            return ToolResult(text="Search cancelled")

        batch = articles_before_filter[batch_start:batch_start + BATCH_SIZE_FOR_FILTERING]
        batch_num = batch_start // BATCH_SIZE_FOR_FILTERING + 1
        total_batches = (len(articles_before_filter) + BATCH_SIZE_FOR_FILTERING - 1) // BATCH_SIZE_FOR_FILTERING

        yield ToolProgress(
            stage="filtering",
            message=f"Filtering batch {batch_num}/{total_batches}...",
            data={
                "batch": batch_num,
                "total_batches": total_batches,
                "filtered_so_far": len(filtered_articles)
            },
            progress=0.6 + (0.3 * (batch_start / len(articles_before_filter)))
        )

        relevant = _filter_articles_batch(client, batch, description)
        filtered_articles.extend(relevant)

        # Stop if we have enough
        if len(filtered_articles) >= max_results:
            break

    # Limit to max_results
    filtered_articles = filtered_articles[:max_results]
    filtered_out_count = len(articles_before_filter) - len(filtered_articles)

    yield ToolProgress(
        stage="complete",
        message=f"Found {len(filtered_articles)} relevant articles (filtered out {filtered_out_count})",
        data={
            "relevant_count": len(filtered_articles),
            "filtered_out": filtered_out_count
        },
        progress=1.0
    )

    # Build metadata
    meta = SmartSearchMeta(
        semantic_description=description,
        generated_queries=queries,
        query_results=[{
            "query": qr.query,
            "total_hits": qr.total_hits,
            "articles_fetched": qr.articles_fetched
        } for qr in query_results],
        total_hits_across_searches=total_hits,
        total_articles_fetched=sum(qr.articles_fetched for qr in query_results),
        total_after_dedup=len(articles_before_filter),
        total_after_filtering=len(filtered_articles),
        filtered_out_count=filtered_out_count
    )

    # Build formatted output
    formatted = f"**PubMed Smart Search Results**\n"
    formatted += f"Query: \"{description}\"\n\n"
    formatted += f"**Search Statistics:**\n"
    formatted += f"- Generated {len(queries)} keyword searches\n"
    formatted += f"- Total hits across searches: {total_hits}\n"
    formatted += f"- Unique articles found: {len(articles_before_filter)}\n"
    formatted += f"- After semantic filtering: {len(filtered_articles)}\n"
    formatted += f"- Filtered out (not relevant): {filtered_out_count}\n\n"

    formatted += "**Generated Searches:**\n"
    for i, qr in enumerate(query_results, 1):
        formatted += f"{i}. `{qr.query}` - {qr.total_hits} hits\n"
    formatted += "\n"

    formatted += f"**Relevant Articles ({len(filtered_articles)}):**\n\n"

    for i, article in enumerate(filtered_articles, 1):
        formatted += f"**{i}. {article['title']}**\n"
        if article['authors_display']:
            formatted += f"   Authors: {article['authors_display']}\n"
        if article['journal']:
            formatted += f"   Journal: {article['journal']}"
            if article['publication_date']:
                formatted += f" ({article['publication_date']})"
            formatted += "\n"
        if article['pmid']:
            formatted += f"   PMID: {article['pmid']}\n"
            formatted += f"   URL: {article['url']}\n"
        if article.get('abstract'):
            abstract_preview = article['abstract'][:300]
            if len(article['abstract']) > 300:
                abstract_preview += "..."
            formatted += f"   Abstract: {abstract_preview}\n"
        formatted += "\n"

    # Build table payload
    table_payload = {
        "type": "table",
        "title": f"PubMed Smart Search: {description[:40]}{'...' if len(description) > 40 else ''}",
        "content": f"Found {len(filtered_articles)} relevant articles (filtered from {len(articles_before_filter)} candidates)",
        "table_data": {
            "columns": [
                {"key": "pmid", "label": "PMID", "type": "text", "sortable": True, "width": "80px"},
                {"key": "title", "label": "Title", "type": "text", "sortable": True},
                {"key": "authors_display", "label": "Authors", "type": "text", "sortable": True},
                {"key": "journal", "label": "Journal", "type": "text", "sortable": True, "filterable": True},
                {"key": "publication_date", "label": "Date", "type": "text", "sortable": True, "width": "100px"},
                {"key": "url", "label": "Link", "type": "link", "sortable": False, "width": "60px"},
            ],
            "rows": [
                {
                    "pmid": a["pmid"],
                    "title": a["title"],
                    "authors_display": a["authors_display"],
                    "journal": a["journal"],
                    "publication_date": a["publication_date"],
                    "url": a["url"],
                    "abstract": a["abstract"]
                }
                for a in filtered_articles
            ],
            "source": "pubmed_smart_search"
        }
    }

    return ToolResult(
        text=formatted,
        data={
            "success": True,
            "articles": filtered_articles,
            "meta": meta.__dict__
        },
        workspace_payload=table_payload
    )


PUBMED_SMART_SEARCH_TOOL = ToolConfig(
    name="pubmed_smart_search",
    description="""Semantic search for PubMed articles using natural language.

Use this when you need to:
- Find articles matching a conceptual/semantic description rather than specific keywords
- Search for articles where the exact terminology is unknown or variable
- Filter out keyword matches that aren't actually about the topic
- Get high-quality, relevant results with transparency into the search process

This tool is SMARTER than pubmed_search because it:
1. Translates your natural language description into multiple optimized keyword searches
2. Runs those searches and deduplicates results
3. Uses AI to filter out articles that match keywords but don't match your semantic intent
4. Provides detailed metadata about the search process

For simple keyword searches, use pubmed_search instead.""",
    input_schema={
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "Natural language description of the articles you're looking for. Be specific about the topic, context, and what makes an article relevant."
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of relevant articles to return (default: 20, max: 50)",
                "default": 20
            },
            "date_range": {
                "type": "string",
                "enum": ["last_week", "last_month", "last_3_months", "last_6_months", "last_year"],
                "description": "Optional date range filter for publication date"
            },
            "include_no_abstract": {
                "type": "boolean",
                "description": "Include articles without abstracts (default: false, as filtering is less accurate)",
                "default": False
            }
        },
        "required": ["description"]
    },
    executor=execute_pubmed_smart_search,
    category="research",
    streaming=True
)


def register_pubmed_smart_search_tools():
    """Register the pubmed_smart_search tool."""
    register_tool(PUBMED_SMART_SEARCH_TOOL)
    logger.info("Registered pubmed_smart_search tool")
