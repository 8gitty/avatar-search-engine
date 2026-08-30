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

// --- ROUTE 1: WEB SEARCH (With Instant Fallback) ---
app.get('/search', async (req, res) => {
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        // 1. Try the Redis Worker first, but ONLY wait 5 seconds
        if (searchQueue && queueEvents) {
            const job = await searchQueue.add('scrape-job', { query });
            const unifiedResults = await job.waitUntilFinished(queueEvents, 5000); 
            if (unifiedResults && unifiedResults.length > 0) {
                return res.json({ results: unifiedResults });
            }
        }
    } catch (queueError) {
        console.log("[Search] Worker busy/offline. Engaging instant fallback...");
    }

    // 2. Direct Web Fallback (Executes instantly if the worker fails or times out)
    try {
        const htmlRes = await axios.get('https://html.duckduckgo.com/html/', {
            params: { q: query },
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 8000
        });

        const results = [];
        const resultBlocks = htmlRes.data.split('class="result__body"'); 
        
        for (let i = 1; i < resultBlocks.length; i++) {
            const block = resultBlocks[i];
            
            const urlMatch = block.match(/<a class="result__url" href="([^"]+)"/);
            const titleMatch = block.match(/<a class="result__a"[^>]*>([\s\S]*?)<\/a>/);
            const snippetMatch = block.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/);
            
            if (urlMatch && titleMatch) {
                let link = urlMatch[1];
                if (link.includes('uddg=')) {
                    link = decodeURIComponent(link.split('uddg=')[1].split('&')[0]);
                }
                
                const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
                const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                
                if (link && title) {
                    results.push({ title, link, snippet });
                }
            }
        }

        res.json({ results: results.slice(0, 15) }); 
    } catch (fallbackError) {
        console.error("[Search Fallback Error]:", fallbackError.message);
        res.json({ results: [] }); 
    }
});

// --- ROUTE 2: AI ANSWER ENGINE (Key-Free Synthesis) ---
app.get('/ai', async (req, res) => {
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        // Fetch top search results for context
        const htmlRes = await axios.get('https://html.duckduckgo.com/html/', {
            params: { q: query },
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 6000
        });

        const resultBlocks = htmlRes.data.split('class="result__body"'); 
        let combinedContext = [];
        
        // Extract the text from the top 3 snippets
        for (let i = 1; i < Math.min(4, resultBlocks.length); i++) {
            const snippetMatch = resultBlocks[i].match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/);
            if (snippetMatch) {
                combinedContext.push(snippetMatch[1].replace(/<[^>]+>/g, '').trim());
            }
        }

        if (combinedContext.length === 0) {
            return res.json({ summary: "I couldn't find enough verified information to generate an AI summary for this query." });
        }

        // Clean up the text to sound like a cohesive AI response
        const rawText = combinedContext.join(" ").replace(/\.\.\./g, '.');
        const sentences = rawText.split('. ').filter(s => s.length > 20);
        
        // Remove duplicates and synthesize a 3-sentence summary
        const uniqueSentences = Array.from(new Set(sentences)).slice(0, 3);
        const finalSummary = uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');

        res.json({ summary: finalSummary });
    } catch (error) {
        console.error("[AI Error]:", error.message);
        res.json({ summary: "The AI summary engine is currently synthesizing data. Please try again in a moment." });
    }
});

// --- ROUTE 3: DEEP MEDIA SCRAPER (Google Images + Dailymotion HD) ---
app.get('/media', async (req, res) => {
    const { q: query, type } = req.query; 
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        let formattedResults = [];

        if (type === 'videos') {
            // Dailymotion API with explicit 480p thumbnail URLs
            const response = await axios.get('https://api.dailymotion.com/videos', {
                params: { search: query, limit: 24, fields: 'id,title,thumbnail_480_url,url' },
                timeout: 6000
            });
            formattedResults = (response.data.list || []).map(item => ({
                image: item.thumbnail_480_url || '',
                thumbnail: item.thumbnail_480_url || '',
                title: item.title || query,
                url: item.url || `https://www.dailymotion.com/video/${item.id}`
            }));
        } else {
            // Direct Google Images Scraper (No IP blocks, highly relevant results)
            const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                timeout: 6000
            });

            // Extract direct image URLs from embedded Google data
            const fullImageMatches = [...response.data.matchAll(/\["(https?:\/\/[^"]+?\.(?:jpg|jpeg|png|webp))",\s*\d+,\s*\d+\]/g)];
            const thumbMatches = [...response.data.matchAll(/(https?:\/\/encrypted-tbn[0-9]\.gstatic\.com\/images\?q=[^"&\s]+)/g)];

            if (fullImageMatches.length > 0) {
                formattedResults = fullImageMatches.map(m => ({
                    image: m[1], thumbnail: m[1], title: query, url: m[1]
                }));
            } else if (thumbMatches.length > 0) {
                formattedResults = thumbMatches.map(m => ({
                    image: m[1], thumbnail: m[1], title: query, url: m[1]
                }));
            }
        }

        const unique = Array.from(new Map(formattedResults.map(item => [item.image, item])).values());
        res.json({ results: unique.slice(0, 24) });
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
