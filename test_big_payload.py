import asyncio
import os
import time
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

async def test():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        print("Missing NVIDIA_API_KEY")
        return

    # Create dummy large prompt (57k chars)
    prompt = "A" * 57000
    
    client = AsyncOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key,
        timeout=20,
        max_retries=0,
    )

    print("About to call big payload...")
    start = time.time()
    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="meta/llama-3.3-70b-instruct",
                messages=[{"role": "user", "content": prompt}]
            ),
            timeout=15.0
        )
        print(f"Success in {time.time() - start:.2f}s: {len(response.choices[0].message.content)} chars")
    except Exception as e:
        print(f"Failed in {time.time() - start:.2f}s: {repr(e)}")

if __name__ == "__main__":
    asyncio.run(test())
