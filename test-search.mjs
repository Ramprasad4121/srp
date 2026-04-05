async function testSearch() {
  const query = "Ethena Labs whitepaper";
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  console.log(`Searching: ${searchUrl}`);
  
  try {
    const res = await fetch(searchUrl, { 
      headers: { 
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" 
      } 
    });
    const html = await res.text();
    console.log(`HTML Length: ${html.length}`);
    if (html.includes("result__a")) {
      console.log("Found results!");
    } else {
      console.log("No results found or bot block.");
      console.log(html.substring(0, 500));
    }
  } catch (err) {
    console.error("Search failed", err);
  }
}

testSearch();
