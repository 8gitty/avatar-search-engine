const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { Queue, QueueEvents } = require('bullmq');
const app = express();
app.use(cors());
app.use(express.json());



// 2. Connect to MongoDB Atlas (Replace with your actual Cloud String)
mongoose.connect('mongodb+srv://webuser:runavatarmongo@avatar.b1dkuzp.mongodb.net/avatar_index?appName=avatar')
  .then(() => console.log('Avatar Core Server connected to MongoDB Index'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// 3. Zero-Knowledge Vault Schema 
const VaultSchema = new mongoose.Schema({
    userId: String,
    encryptedData: String
});
const Vault = mongoose.model('Vault', VaultSchema);

// --- ROUTE 1: AVATAR AGGREGATOR & AI ENGINE ---
const connection = { url: 'redis://red-da8r09rtqb8s73f1fp7g:6379' }; 
const searchQueue = new Queue('search-queue', { connection });
const queueEvents = new QueueEvents('search-queue', { connection });

app.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    try {
        // 1. Push search job into Redis queue
        const job = await searchQueue.add('scrape-job', { query: q });

        // 2. Wait for worker process to complete the job
const unifiedResults = await job.waitUntilFinished(queueEvents, 30000);
        // 3. Pass results to local hardware-accelerated LLM (Llama 3.2 3B)
        let aiSummary = null;
        if (unifiedResults && unifiedResults.length > 0) {
            try {
                const context = unifiedResults.slice(0, 3).map(r => r.Text).join(" | ");
                const prompt = `You are Avatar, an elite private search engine. The user searched for: "${q}". Write a concise, factual 2-sentence summary answering their query using strictly this context: ${context}. Do not use outside knowledge. 
                CRITICAL RULE: Do not include any introductory phrases like "Here is a summary". Output ONLY the final 2 sentences of the summary.`;
                // Cloud API Swap (e.g., Mistral AI)
                const aiRes = await axios.post('https://api.mistral.ai/v1/chat/completions', {
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 150
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` // Stored in Render environment variables
                    }
                });
                
                let rawSummary = aiRes.data.choices[0].message.content;
                aiSummary = rawSummary.replace(/^(Here is a|Here's a|Here is the|Here's the|Summary:|Here is a concise).*?:/gi, '').trim();
            } catch (aiErr) {
                console.error("[Avatar Core] Local AI Generation Skipped:", aiErr.message);
            }
        }

        res.json({
            query: q,
            aiSummary: aiSummary,
            results: unifiedResults
        });

    } catch (err) {
        console.error('[Avatar Core] Queue processing timed out or failed:', err.message);
        res.status(500).json({ error: 'Search aggregation failed' });
    }
});

// --- ROUTE 2: DEEP MEDIA SCRAPER (Multi-Engine Dependency-Free) ---
app.get('/media', async (req, res) => {
    const { q: query, type } = req.query; 
    if (!query) return res.status(400).json({ error: 'Search query required' });

    try {
        let formattedResults = [];

        if (type === 'videos') {
            // Dailymotion Open API
            const response = await axios.get('https://api.dailymotion.com/videos', {
                params: { search: query, limit: 24, fields: 'title,thumbnail_360_url,url,id' },
                timeout: 8000
            });
            formattedResults = (response.data.list || []).map(item => ({
                image: item.thumbnail_360_url || '',
                title: item.title || '',
                url: `https://www.dailymotion.com/video/${item.id}` || '',
                thumbnail: item.thumbnail_360_url || ''
            }));
        } else {
            // STRATEGY 1: BING IMAGES (Advanced Regex)
            try {
                const bingRes = await axios.get(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 5000
                });
                
                // Smart Regex: Matches both "murl":"..." and &quot;murl&quot;:&quot;...&quot; formats
                const urlMatches = [...bingRes.data.matchAll(/(&quot;|")murl\1:\1(.*?)\1/g)];
                const titleMatches = [...bingRes.data.matchAll(/(&quot;|")t\1:\1(.*?)\1/g)];

                formattedResults = urlMatches.map((match, i) => ({
                    image: match[2],
                    title: titleMatches[i] ? titleMatches[i][2] : query,
                    url: match[2],
                    thumbnail: match[2]
                }));
            } catch (e) {
                console.log("[Media] Bing timed out or changed HTML structure.");
            }

            // STRATEGY 2: YAHOO IMAGES FALLBACK
            if (formattedResults.length === 0) {
                console.log("[Media] Bing empty, engaging Yahoo Fallback...");
                const yahooRes = await axios.get(`https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 5000
                });
                
                // Extract original image URLs hidden in Yahoo's link parameters
                const yahooUrls = [...yahooRes.data.matchAll(/imgurl=([^&]+)/g)];
                
                formattedResults = yahooUrls.map(match => {
                    try {
                        const cleanUrl = decodeURIComponent(match[1]);
                        return { image: cleanUrl, title: query, url: cleanUrl, thumbnail: cleanUrl };
                    } catch (e) { return null; }
                }).filter(item => item !== null);
            }
        }

        // Filter duplicates and return top 24 results
        const uniqueResults = Array.from(new Map(formattedResults.map(item => [item.image, item])).values());
        res.json({ results: uniqueResults.slice(0, 24) });
    } catch (error) {
        console.error("[Media API Error]:", error.message);
        res.json({ results: [] }); 
    }
});

// --- ROUTE 3: ZERO-KNOWLEDGE VAULT ---
app.post('/vault/sync', async (req, res) => {
    const { userId, encryptedData } = req.body;
    await Vault.findOneAndUpdate({ userId }, { encryptedData }, { upsert: true });
    res.json({ status: 'synced' });
});

app.get('/vault/fetch', async (req, res) => {
    const vault = await Vault.findOne({ userId: req.query.userId });
    res.json({ encryptedData: vault ? vault.encryptedData : null });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Avatar Server running on port ${PORT}`);
});

// --- ROUTE 4: AUTOCOMPLETE API ---
app.get('/autocomplete', async (req, res) => {
    try {
        // Swapped to Google Suggest API because DDG blocks Render IPs
        const response = await axios.get(`http://suggestqueries.google.com/complete/search`, {
            params: { 
                client: 'chrome', 
                q: req.query.q 
            }
        });
        
        // Google returns data in the format: ["query", ["suggestion1", "suggestion2"]]
        res.json(response.data[1] || []);
    } catch (error) {
        console.error('[Autocomplete Error]:', error.message);
        res.json([]);
    }
});
