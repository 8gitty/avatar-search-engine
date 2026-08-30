const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// --- OPTIONAL: REDIS QUEUE SETUP ---
let searchQueue = null;
let queueEvents = null;
try {
    const { Queue, QueueEvents } = require('bullmq');
    if (process.env.REDIS_URL) {
        searchQueue = new Queue('scrape-job', { connection: { url: process.env.REDIS_URL } });
        queueEvents = new QueueEvents('scrape-job', { connection: { url: process.env.REDIS_URL } });
    }
} catch (e) {
    console.log("[Queue] BullMQ not configured. Operating in direct-fetch fallback mode.");
}

// --- ROUTE 0: UPTIMEROBOT KEEP-ALIVE ---
app.get('/', (req, res) => {
    res.send('Avatar Private Search Engine API is Live');
});

// --- ROUTE 1: WEB SEARCH ROUTE (Ironclad Multi-Engine) ---
app.get('/search', async (req, res) => {
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    let results = [];

    // ENGINE 1: Wikipedia API (Explicit User-Agent prevents 403 blocks)
    try {
        const wikiRes = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                utf8: 1,
                format: 'json',
                srlimit: 15 // Increased from 5 to 15 to guarantee pagination works
            },
            headers: {
                'User-Agent': 'AvatarPrivateSearchEngine/1.0 (https://avatar-web-chi.vercel.app; student-project)'
            },
            timeout: 5000
        });

        const wikiItems = wikiRes.data.query?.search || [];
        wikiItems.forEach(item => {
            const cleanSnippet = item.snippet.replace(/<\/?[^>]+(>|$)/g, "").trim();
            results.push({
                title: item.title,
                link: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                snippet: cleanSnippet
            });
        });
    } catch (e) {
        console.log("[Search] Wikipedia engine error:", e.message);
    }

    // ENGINE 2: DuckDuckGo Lite Scraper (Optimized for datacenter IPs)
    try {
        const params = new URLSearchParams();
        params.append('q', query);
        
        const ddgRes = await axios.post('https://lite.duckduckgo.com/lite/', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 6000
        });

        const html = ddgRes.data;
        const resultBlocks = html.split('<td class="result-snippet">');

        for (let i = 1; i < resultBlocks.length; i++) {
            const snippetText = resultBlocks[i].split('</td>')[0].replace(/<[^>]+>/g, '').trim();
            const prevBlock = resultBlocks[i - 1];
            const linkMatch = prevBlock.match(/class="result-link" href="([^"]+)">([\s\S]*?)<\/a>/);

            if (linkMatch) {
                let link = linkMatch[1];
                if (link.includes('uddg=')) {
                    link = decodeURIComponent(link.split('uddg=')[1].split('&')[0]);
                }
                const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();

                if (link && title && link.startsWith('http')) {
                    results.push({ title, link, snippet: snippetText });
                }
            }
        }
    } catch (e) {
        console.log("[Search] DDG Lite engine error:", e.message);
    }

    // De-duplicate results by URL and take top 30 (Increased from 15)
    const uniqueResults = Array.from(new Map(results.map(item => [item.link, item])).values());
    res.json({ results: uniqueResults.slice(0, 30) });
});

// --- ROUTE 2: AI ANSWER ENGINE (Wikipedia Context API) ---
app.get('/ai', async (req, res) => {
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        // Fetch context from Wikipedia (100% Datacenter Safe)
        const wikiRes = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: { action: 'query', list: 'search', srsearch: query, utf8: 1, format: 'json', srlimit: 3 },
            headers: { 'User-Agent': 'AvatarPrivateSearchEngine/1.0' },
            timeout: 5000
        });

        const items = wikiRes.data.query?.search || [];
        if (items.length === 0) {
            return res.json({ summary: "No verified data found to synthesize an AI response for this query." });
        }

        // Clean HTML tags and combine the top snippets
        let combinedText = items.map(item => item.snippet.replace(/<\/?[^>]+(>|$)/g, "")).join(" ");
        
        // Extractive synthesis: Format into a clean 2-3 sentence summary
        const sentences = combinedText.split('. ').filter(s => s.length > 15);
        const uniqueSentences = Array.from(new Set(sentences)).slice(0, 3);
        const finalSummary = uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');

        res.json({ summary: finalSummary });
    } catch (error) {
        console.error("[AI Error]:", error.message);
        res.json({ summary: "The AI summary engine is currently synthesizing data. Please try again in a moment." });
    }
});

// --- ROUTE 3: DEEP MEDIA SCRAPER (Bing Async HD Engine + Dailymotion) ---
app.get('/media', async (req, res) => {
    const { q: query, type } = req.query; 
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        let formattedResults = [];

        if (type === 'videos') {
            const response = await axios.get('https://api.dailymotion.com/videos', {
                params: { search: query, limit: 30, fields: 'id,title,thumbnail_480_url,url' },
                timeout: 6000
            });
            formattedResults = (response.data.list || []).map(item => ({
                image: item.thumbnail_480_url || '',
                thumbnail: item.thumbnail_480_url || '',
                title: item.title || query,
                url: item.url || `https://www.dailymotion.com/video/${item.id}`
            }));
        } else {
            // Bing Async Engine (Streams 40+ HD image results, immune to datacenter IP blocks)
            try {
                const bingRes = await axios.get('https://www.bing.com/images/async', {
                    params: { q: query, first: 1, count: 40, scenario: 'ImageHover' },
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 7000
                });

                // Extract all m="{...}" attributes containing direct full-resolution URLs
                const matches = [...bingRes.data.matchAll(/m="{([^"]+)}"/g)];
                matches.forEach(m => {
                    try {
                        const rawJson = '{' + m[1].replace(/&quot;/g, '"') + '}';
                        const data = JSON.parse(rawJson);
                        if (data.murl) {
                            formattedResults.push({
                                image: data.murl,
                                thumbnail: data.turl || data.murl,
                                title: data.t || query,
                                url: data.purl || data.murl
                            });
                        }
                    } catch (e) {}
                });
            } catch (e) {
                console.log("[Media] Bing Async engine error:", e.message);
            }

            // Fallback to Wikipedia PageImages if under 5 items are found
            if (formattedResults.length < 5) {
                try {
                    const wikiRes = await axios.get('https://en.wikipedia.org/w/api.php', {
                        params: { action: 'query', generator: 'search', gsrsearch: query, gsrlimit: 10, prop: 'pageimages', piprop: 'original|thumbnail', pithumbsize: 600, format: 'json' },
                        headers: { 'User-Agent': 'AvatarPrivateSearchEngine/1.0' },
                        timeout: 4000
                    });
                    const pages = wikiRes.data.query?.pages;
                    if (pages) {
                        Object.values(pages).forEach(page => {
                            const imgUrl = page.original?.source || page.thumbnail?.source;
                            if (imgUrl) formattedResults.push({ image: imgUrl, thumbnail: page.thumbnail?.source || imgUrl, title: page.title, url: imgUrl });
                        });
                    }
                } catch (e) {}
            }
        }

        const unique = Array.from(new Map(formattedResults.map(item => [item.image, item])).values());
        res.json({ results: unique });
    } catch (error) {
        console.error("[Media API Error]:", error.message);
        res.json({ results: [] }); 
    }
});

// --- ROUTE 4: AUTOCOMPLETE API (Google Suggest) ---
app.get('/autocomplete', async (req, res) => {
    try {
        const response = await axios.get(`http://suggestqueries.google.com/complete/search`, {
            params: { client: 'chrome', q: req.query.q },
            timeout: 3000
        });
        res.json(response.data[1] || []);
    } catch (error) {
        res.json([]);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Avatar Server] Initialized and listening on port ${PORT}`);
});
