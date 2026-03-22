const getFindings = require("@lyuboslavlyubenov/solodit-mcp/dist/get-findings.js").default;
const getFinding = require("@lyuboslavlyubenov/solodit-mcp/dist/get-finding.js").default;

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        if (command === 'search') {
            const keyword = args[1];
            const limit = parseInt(args[2] || "5", 10);
            const findings = await getFindings(keyword);
            const limited = findings.slice(0, limit).map(f => ({
                title: f.title,
                slug: f.slug,
                first_seen: f.date,
                vulnerability_details: f.content
            }));
            console.log(JSON.stringify(limited));
        } else if (command === 'get') {
            const slug = args[1];
            const finding = await getFinding(slug);
            console.log(JSON.stringify(finding));
        } else {
            console.error("Unknown command");
            process.exit(1);
        }
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
