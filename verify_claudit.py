import asyncio
import os

from core.solodit_client import SoloditClient


async def verify():
    client = SoloditClient()

    if not client.available:
        print("⚠️  SOLODIT_API_KEY not set — claudit integration will be skipped")
        print("   Get key at: solodit.cyfrin.io")
        return

    print("✅ SOLODIT_API_KEY found")

    results = await client.search_findings(
        keywords="reentrancy",
        severity=["HIGH", "CRITICAL"],
        page_size=3
    )

    if results:
        print(f"✅ claudit working — found {len(results)} findings for 'reentrancy'")
        for r in results:
            print(f"   → {r.get('title', 'N/A')} [{r.get('severity', 'N/A')}]")
    else:
        print("❌ claudit returned no results — check your API key")


if __name__ == "__main__":
    asyncio.run(verify())
