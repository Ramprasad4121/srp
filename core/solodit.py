import asyncio
import json
import urllib.parse

class SolodItClient:
    def __init__(self):
        pass

    async def search(self, keyword: str, limit: int = 5) -> list[dict]:
        input_url = f'{{"0":"[{{\\"filters\\":1,\\"page\\":20}},{{\\"keywords\\":2,\\"firms\\":3,\\"tags\\":4,\\"forked\\":5,\\"impact\\":6,\\"user\\":-1,\\"protocol\\":-1,\\"reported\\":10,\\"reportedAfter\\":-1,\\"protocolCategory\\":13,\\"minFinders\\":14,\\"maxFinders\\":15,\\"rarityScore\\":16,\\"qualityScore\\":16,\\"bookmarked\\":17,\\"read\\":17,\\"unread\\":17,\\"sortField\\":18,\\"sortDirection\\":19}},\\"{keyword}\\",[],[],[],[7,8,9],\\"HIGH\\",\\"MEDIUM\\",\\"LOW\\",{{\\"label\\":11,\\"value\\":12}},\\"All time\\",\\"alltime\\",[],\\"1\\",\\"100\\",1,true,\\"Recency\\",\\"Desc\\",1]"}}'
        encoded = urllib.parse.quote(input_url)
        url = f"https://solodit.cyfrin.io/api/trpc/findings.get?batch=1&input={encoded}"
        
        js_code = f"""
        fetch('{url}', {{
            headers: {{
                'accept': '*/*',
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'referer': 'https://solodit.cyfrin.io/',
                'origin': 'https://solodit.cyfrin.io',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }}
        }}).then(res => res.json()).then(json => {{
            const content = json[0].result.data;
            const obj = eval('(' + content + ')');
            const limited = obj.findings.slice(0, {limit}).map(f => ({{
                title: f.title,
                slug: f.slug,
                first_seen: f.date,
                vulnerability_details: f.content
            }}));
            console.log(JSON.stringify(limited));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        """
        
        proc = await asyncio.create_subprocess_exec(
            "node", "-e", js_code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            return []
        
        try:
            return json.loads(stdout.decode().strip("\n"))
        except Exception:
            return []

    async def get_by_title(self, title: str) -> str:
        slug = title
        input_url = f'{{"0":"[{{\\"slug\\":1}},\\"{slug}\\"]"}}'
        encoded = urllib.parse.quote(input_url)
        url = f"https://solodit.cyfrin.io/api/trpc/findings.getFindingBySlug?batch=1&input={encoded}"
        
        js_code = f"""
        fetch('{url}', {{
            headers: {{
                'accept': '*/*',
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'referer': 'https://solodit.cyfrin.io/',
                'origin': 'https://solodit.cyfrin.io',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }}
        }}).then(res => res.json()).then(json => {{
            const content = json[0].result.data;
            const obj = eval('(' + content + ')');
            console.log(JSON.stringify(obj.content || ""));
        }}).catch(e => {{ console.error(e); process.exit(1); }});
        """
        proc = await asyncio.create_subprocess_exec(
            "node", "-e", js_code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            return ""
        try:
            return json.loads(stdout.decode().strip("\n"))
        except:
            return ""

    def search_sync(self, keyword: str, limit: int = 5) -> list[dict]:
        return asyncio.run(self.search(keyword, limit))

    def get_by_title_sync(self, title: str) -> str:
        return asyncio.run(self.get_by_title(title))

# Singleton
solodit = SolodItClient()
