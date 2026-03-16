from core.intent_engine import ProtocolIntentEngine
import asyncio
import json

async def main():
    engine = ProtocolIntentEngine('.')
    result = await engine.extract()
    print("Intent Engine Result:")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())