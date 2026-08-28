// spiderWorker.js
const { Worker } = require('bullmq');
const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');

const connection = { url: 'redis://red-da8r09rtqb8s73f1fp7g:6379' }; 

// Tor Proxy setup
const torAgent = new SocksProxyAgent('socks5h://127.0.0.1:9050');

console.log('[Spider Swarm Worker] Active and listening for scraping jobs...');

// Initialize worker to consume jobs from 'search-queue'
const worker = new Worker('search-queue', async (job) => {
    const { query } = job.data;
    console.log(`[Spider Worker ${process.pid}] Executing scrape job for query: "${query}"`);

    // Scrape DuckDuckGo
    const fetchDuckDuckGo = async () => {
        try {
            console.log(`[Spider Worker] Fetching DuckDuckGo...`);
            const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                httpAgent: torAgent,
                httpsAgent: torAgent,
                timeout: 15000
            });
            
            const $ = cheerio.load(res.data);
            const ddgResults = [];
            
            // Increased to 15 results for the "Load More" pool
            $('.result').slice(0, 15).each((i, el) => {
                const title = $(el).find('.result__a').text().trim();
                const rawUrl = $(el).find('.result__a').attr('href');
                const snippet = $(el).find('.result__snippet').text().trim();
                
                if (title && snippet) {
                    let cleanUrl = rawUrl;
                    // Bypass DuckDuckGo's 'uddg' redirect tracking
                    if (rawUrl && rawUrl.includes('uddg=')) {
                        const match = rawUrl.match(/uddg=([^&]+)/);
                        if (match) cleanUrl = decodeURIComponent(match[1]);
                    } else if (rawUrl && rawUrl.startsWith('//')) {
                        cleanUrl = `https:${rawUrl}`;
                    }
                    ddgResults.push({ Source: 'DuckDuckGo', Title: title, URL: cleanUrl, Text: snippet });
                }
            });
            return ddgResults;
        } catch (err) {
            return [];
        }
    };

    // Scrape Wikipedia API
    const fetchWikipedia = async () => {
        try {
            console.log(`[Spider Worker] Fetching Wikipedia...`);
            const res = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`, {
                headers: { 'User-Agent': 'Avatar-Privacy-Engine/1.0' },
                timeout: 4000
            });
            
            // Increased to 10 results
            return (res.data.query.search || []).slice(0, 10).map(item => ({
                Source: 'Wikipedia',
                Title: item.title,
                URL: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
                Text: item.snippet.replace(/<[^>]*>?/gm, '') 
            }));
        } catch (err) {
            return [];
        }
    };

    // Execute concurrent worker fetches
    const results = await Promise.allSettled([fetchDuckDuckGo(), fetchWikipedia()]);
    const unified = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    return unified;
}, { connection });

worker.on('failed', (job, err) => {
    console.error(`[Spider Worker] Job ${job.id} failed:`, err.message);
});