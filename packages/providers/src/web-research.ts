import type { WebResearchRequest, WebSearchResult } from "@srp/shared-types";
import { isHostnameAllowed, type InternetPolicy } from "@srp/security";

export class WebResearchService {
  constructor(private readonly policy: InternetPolicy) {}

  async search(request: WebResearchRequest): Promise<readonly WebSearchResult[]> {
    if (this.policy.mode === "local-only") {
      return [];
    }

    // In a real implementation, this would call a search engine API (e.g., Brave Search, Serper, etc.)
    // For this vertical slice, we provide deterministic mock results based on the query
    // and filter them through the security policy.

    const allResults: WebSearchResult[] = [
      {
        url: "https://docs.soliditylang.org/en/v0.8.24/security-considerations.html",
        title: "Security Considerations — Solidity documentation",
        snippet: "While it is usually possible to write code that is free from reentrancy vulnerabilities...",
        hostname: "docs.soliditylang.org",
        source: "documentation"
      },
      {
        url: "https://ethereum.org/en/developers/docs/smart-contracts/security/",
        title: "Smart contract security | ethereum.org",
        snippet: "Smart contract security is one of the most important considerations for developers...",
        hostname: "ethereum.org",
        source: "documentation"
      },
      {
        url: "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/security/ReentrancyGuard.sol",
        title: "ReentrancyGuard.sol - OpenZeppelin",
        snippet: "Contract module that helps prevent reentrant calls to a function.",
        hostname: "github.com",
        source: "approved-domain"
      }
    ];

    const filteredResults = allResults.filter(result => 
      isHostnameAllowed(this.policy, result.hostname)
    );

    // Filter by includeDocumentation flag
    let finalResults = filteredResults;
    if (request.includeDocumentation === false) {
      finalResults = finalResults.filter(r => r.source !== "documentation");
    }

    return finalResults.slice(0, request.limit ?? 5);
  }
}
