"""Domain Detector — Automatically detects protocol domain from Solidity signals."""
from __future__ import annotations

import glob
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class DetectionResult:
    """Result of domain detection."""
    primary: str
    secondary: str | None
    confidence: float
    secondary_confidence: float
    signals_found: dict[str, list[str]]


class DomainDetector:
    """Detects protocol domain by scanning Solidity files for domain-specific signals."""

    DOMAIN_SIGNALS = {
        "lending": [
            "borrow", "repay", "liquidate", "collateral", "healthFactor",
            "interestRate", "supplyRate", "utilizationRate", "LTV", "flashLoan",
            "ILendingPool", "IAToken", "IERC4626", "debtToken", "aToken",
            "getUserAccountData", "getReserveData", "liquidationCall",
        ],
        "amm": [
            "swap", "addLiquidity", "removeLiquidity", "mint", "burn",
            "reserve0", "reserve1", "sqrtPrice", "tick", "pool",
            "IUniswapV2", "IUniswapV3", "balancerPool", "curvePool",
            "getAmountsOut", "getAmountsIn", "exactInput", "exactOutput",
            "swapExactTokensForTokens", "swapTokensForExactTokens",
        ],
        "bridge": [
            "bridge", "relay", "crossChain", "messageHash", "guardian",
            "finalize", "sendMessage", "receiveMessage", "IBridge",
            "LayerZero", "Wormhole", "Connext", "Axelar",
        ],
        "staking": [
            "stake", "unstake", "withdraw", "slash", "delegate",
            "epoch", "reward", "validator", "IStaking", "rebase",
            "sharePrice", "exchangeRate", "stakingToken", "rewardsToken",
        ],
        "governance": [
            "propose", "vote", "execute", "timelock", "quorum",
            "Governor", "IGovernor", "TimelockController", "Ownable2Step",
            "AccessControl", "veto", "guardian", "proposalThreshold",
        ],
        "perpetuals": [
            "openPosition", "closePosition", "liquidate", "margin",
            "funding", "markPrice", "indexPrice", "perpetual",
            "IPerp", "IPerpetual", "leverage", "pnl", "fundingRate",
        ],
        "crosschain": [
            "ccip", "LayerZero", "Wormhole", "Axelar", "Connext",
            "IRouterClient", "EVM2AnyMessage", "ccipReceive",
            "sourceChain", "destChain", "selector", "messageId",
        ],
    }

    def __init__(self, project_root: str | Path) -> None:
        """Initialize detector with project root."""
        self.project_root = Path(project_root).resolve()
        self._file_contents: dict[str, str] = {}

    def detect(self, contract_paths: list[str] | None = None) -> DetectionResult:
        """Run domain detection on project.

        Args:
            contract_paths: Optional list of specific contract paths to analyze.
                          If None, will scan all .sol files in project.

        Returns:
            DetectionResult with primary domain, secondary domain, and confidence scores.
        """
        # Collect file contents
        if contract_paths:
            self._collect_specific_files(contract_paths)
        else:
            self._collect_all_solidity_files()

        # Score each domain
        scores: dict[str, int] = {}
        signals_found: dict[str, list[str]] = {}

        for domain, signals in self.DOMAIN_SIGNALS.items():
            score = 0
            found_signals = []
            for signal in signals:
                signal_lower = signal.lower()
                for content in self._file_contents.values():
                    content_lower = content.lower()
                    # Count occurrences but cap at 3 per signal per file
                    count = min(content_lower.count(signal_lower), 3)
                    if count > 0:
                        score += count
                        found_signals.append(signal)
            scores[domain] = score
            signals_found[domain] = list(set(found_signals))

        # Determine primary and secondary domains
        sorted_domains = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        primary = "generic"
        secondary = None
        confidence = 0.0
        secondary_confidence = 0.0

        if sorted_domains:
            primary = sorted_domains[0][0]
            primary_score = sorted_domains[0][1]
            total_score = sum(scores.values()) or 1
            confidence = min(primary_score / max(total_score, 10), 1.0)

            # Check for secondary domain (must have >30% of primary score)
            if len(sorted_domains) > 1:
                secondary_candidate = sorted_domains[1][0]
                secondary_score = sorted_domains[1][1]
                if secondary_score > primary_score * 0.3 and secondary_score > 0:
                    secondary = secondary_candidate
                    secondary_confidence = min(secondary_score / max(total_score, 10), 1.0)

        return DetectionResult(
            primary=primary,
            secondary=secondary,
            confidence=confidence,
            secondary_confidence=secondary_confidence,
            signals_found=signals_found,
        )

    def _collect_specific_files(self, paths: list[str]) -> None:
        """Collect contents of specific file paths."""
        for path_str in paths:
            path = Path(path_str).resolve()
            if path.is_file() and path.suffix == ".sol":
                try:
                    content = path.read_text(encoding="utf-8", errors="replace")
                    self._file_contents[str(path)] = content
                except OSError:
                    continue

    def _collect_all_solidity_files(self) -> None:
        """Collect all Solidity files in the project."""
        patterns = [
            os.path.join(str(self.project_root), "**", "*.sol"),
        ]

        seen: set[str] = set()
        for pattern in patterns:
            for sol_path in glob.glob(pattern, recursive=True):
                abs_path = os.path.abspath(sol_path)
                if abs_path in seen:
                    continue
                seen.add(abs_path)

                # Skip vendor/lib directories
                if any(skip in abs_path for skip in ["/node_modules/", "/lib/", "/forge-std/"]):
                    continue

                try:
                    content = Path(abs_path).read_text(encoding="utf-8", errors="replace")
                    self._file_contents[abs_path] = content
                except OSError:
                    continue

    def get_stats(self) -> dict[str, Any]:
        """Return detection stats."""
        return {
            "files_analyzed": len(self._file_contents),
            "total_chars": sum(len(c) for c in self._file_contents.values()),
        }
