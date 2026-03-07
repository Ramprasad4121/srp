import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        print("Missing NVIDIA_API_KEY")
        return

    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [{"role": "user", "content": "Hi! Say 'yes'."}],
        "max_tokens": 10
    }

    try:
        print("Testing NVIDIA API...")
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=20.0)
            print(f"Status: {resp.status_code}")
            print("Response:", resp.text)
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    asyncio.run(test())
