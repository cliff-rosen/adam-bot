"""
JavaScript-Enabled Web Retrieval Service

Uses Playwright to fetch pages that require JavaScript rendering.
For pages like Yelp, Google Maps, etc. that return empty shells without JS.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional, TypedDict

from playwright.async_api import async_playwright, Browser, Page, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)


@dataclass
class JSWebpage:
    """Webpage data from JS-rendered fetch."""
    url: str
    title: str
    content: str
    html: Optional[str]
    status_code: int
    load_time_ms: int
    metadata: Dict[str, Any]


class JSWebRetrievalResult(TypedDict):
    """Result from JS web retrieval."""
    webpage: JSWebpage
    status_code: int
    load_time_ms: int
    timestamp: str


class JSWebRetrievalService:
    """
    Service for retrieving web pages that require JavaScript rendering.

    Uses Playwright with headless Chromium to render pages fully before
    extracting content. Useful for:
    - Yelp (reviews hidden behind JS)
    - Google Maps/Business (dynamic content)
    - Single-page applications
    - Sites with anti-bot measures that check for JS execution
    """

    def __init__(self):
        self.default_timeout = 30000  # 30 seconds
        self.default_wait_after_load = 2000  # 2 seconds for dynamic content
        self._browser: Optional[Browser] = None
        self._playwright = None

    async def _ensure_browser(self) -> Browser:
        """Ensure browser is launched, reuse if already running."""
        if self._browser is None or not self._browser.is_connected():
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                ]
            )
            logger.info("Launched Playwright browser")
        return self._browser

    async def close(self):
        """Close the browser and cleanup resources."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("Closed Playwright browser")

    async def retrieve_webpage(
        self,
        url: str,
        timeout: int = None,
        wait_after_load: int = None,
        wait_for_selector: Optional[str] = None,
        extract_html: bool = False
    ) -> JSWebRetrievalResult:
        """
        Retrieve a webpage with full JavaScript rendering.

        Args:
            url: The URL to fetch
            timeout: Max time to wait for page load (ms)
            wait_after_load: Additional time to wait after load for dynamic content (ms)
            wait_for_selector: Optional CSS selector to wait for before considering page ready
            extract_html: Whether to include raw HTML in result

        Returns:
            JSWebRetrievalResult with rendered page content
        """
        if not url:
            raise ValueError("URL is required")

        timeout = timeout or self.default_timeout
        wait_after_load = wait_after_load or self.default_wait_after_load

        browser = await self._ensure_browser()
        page: Optional[Page] = None

        start_time = datetime.utcnow()

        try:
            # Create new page with realistic viewport and user agent
            page = await browser.new_page(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )

            # Navigate to URL
            response = await page.goto(
                url,
                wait_until='networkidle',
                timeout=timeout
            )

            status_code = response.status if response else 0

            # Wait for specific selector if provided
            if wait_for_selector:
                try:
                    await page.wait_for_selector(wait_for_selector, timeout=timeout)
                except PlaywrightTimeout:
                    logger.warning(f"Selector '{wait_for_selector}' not found within timeout")

            # Additional wait for dynamic content
            if wait_after_load > 0:
                await asyncio.sleep(wait_after_load / 1000)

            # Extract content
            title = await page.title()
            content = await page.inner_text('body')

            html = None
            if extract_html:
                html = await page.content()

            end_time = datetime.utcnow()
            load_time_ms = int((end_time - start_time).total_seconds() * 1000)

            # Get final URL (after redirects)
            final_url = page.url

            # Check for rate limiting / blocking
            blocked = False
            block_reason = None
            if status_code == 403:
                blocked = True
                block_reason = "403 Forbidden - likely rate limited or bot detected"
                content = f"[BLOCKED: {block_reason}]"
            elif status_code == 429:
                blocked = True
                block_reason = "429 Too Many Requests - rate limited"
                content = f"[BLOCKED: {block_reason}]"
            elif len(content.strip()) < 100 and 'enable' in title.lower() and 'js' in title.lower():
                blocked = True
                block_reason = "Page requires JavaScript but content not loading"
                content = f"[BLOCKED: {block_reason}]"

            webpage = JSWebpage(
                url=final_url,
                title=title,
                content=content,
                html=html,
                status_code=status_code,
                load_time_ms=load_time_ms,
                metadata={
                    'original_url': url,
                    'js_rendered': True,
                    'wait_after_load_ms': wait_after_load,
                    'blocked': blocked,
                    'block_reason': block_reason
                }
            )

            return JSWebRetrievalResult(
                webpage=webpage,
                status_code=status_code,
                load_time_ms=load_time_ms,
                timestamp=datetime.utcnow().isoformat()
            )

        except PlaywrightTimeout as e:
            raise Exception(f"Page load timed out after {timeout}ms: {str(e)}")
        except Exception as e:
            logger.error(f"JS fetch error for {url}: {e}", exc_info=True)
            raise Exception(f"Failed to fetch page: {str(e)}")
        finally:
            if page:
                await page.close()


# Convenience function for one-off fetches
async def fetch_with_js(
    url: str,
    timeout: int = 30000,
    wait_after_load: int = 2000,
    wait_for_selector: Optional[str] = None
) -> JSWebRetrievalResult:
    """
    Convenience function for one-off JS-rendered page fetches.

    Creates a new browser, fetches the page, and closes the browser.
    For multiple fetches, use JSWebRetrievalService directly to reuse the browser.
    """
    service = JSWebRetrievalService()
    try:
        return await service.retrieve_webpage(
            url=url,
            timeout=timeout,
            wait_after_load=wait_after_load,
            wait_for_selector=wait_for_selector
        )
    finally:
        await service.close()
