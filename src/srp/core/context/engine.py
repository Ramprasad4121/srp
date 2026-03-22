import re
import aiohttp
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class ContextInterceptor:
    """Base class for context interceptors."""
    async def process(self, raw_input: str) -> str:
        raise NotImplementedError

class GitHubPRInterceptor(ContextInterceptor):
    """Detects GitHub PR links and extracts the PR diff/description."""
    GITHUB_PR_REGEX = r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)"
    
    async def process(self, raw_input: str) -> str:
        matches = re.finditer(self.GITHUB_PR_REGEX, raw_input)
        enriched_input = raw_input
        
        for match in matches:
            owner, repo, pr_number = match.groups()
            logger.info(f"ContextEngine: Intercepted GitHub PR {owner}/{repo}#{pr_number}")
            
            # Fetch patch
            patch_url = f"https://patch-diff.githubusercontent.com/raw/{owner}/{repo}/pull/{pr_number}.patch"
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(patch_url, timeout=30) as response:
                        if response.status == 200:
                            patch_data = await response.text()
                            # Truncate if massive
                            if len(patch_data) > 30000:
                                patch_data = patch_data[:30000] + "\n...[TRUNCATED]"
                                
                            injection = f"\n\n--- AUTO-INJECTED CONTEXT: GITHUB PR #{pr_number} ---\n```diff\n{patch_data}\n```\n---"
                            enriched_input += injection
            except Exception as e:
                logger.warning(f"Failed to fetch PR context: {e}")
                
        return enriched_input

class WhitepaperInterceptor(ContextInterceptor):
    """Mock interceptor for fetching whitepapers. In a full system, you'd use PyPDF2 here."""
    async def process(self, raw_input: str) -> str:
        # Placeholder for PDF parsing logic
        return raw_input


class ContextEngine:
    """
    OpenClaw-style Preprocessor.
    Ingests raw user prompts and passes them through a chain of interceptors to expand links,
    fetch external data, and bundle it into the final LLM prompt context.
    """
    
    def __init__(self):
        self.interceptors: List[ContextInterceptor] = [
            GitHubPRInterceptor(),
            WhitepaperInterceptor()
        ]

    async def enrich(self, raw_input: str) -> str:
        """Runs the raw input through all interceptors."""
        if not raw_input:
            return raw_input
            
        current_input = raw_input
        for interceptor in self.interceptors:
            try:
                current_input = await interceptor.process(current_input)
            except Exception as e:
                logger.error(f"Context Engine Interceptor {interceptor.__class__.__name__} failed: {e}")
                
        return current_input
