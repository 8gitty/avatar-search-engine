const axios = require('axios');
const cheerio = require('cheerio');
const URL = require('url').URL;
const mongoose = require('mongoose');

// --- DATABASE SETUP ---
// Define the Schema for our Search Engine Index
const pageSchema = new mongoose.Schema({
    url: { type: String, required: true, unique: true },
    title: String,
    content: String,
    crawledAt: { type: Date, default: Date.now }
});

const Page = mongoose.model('Page', pageSchema);

// --- SPIDER CONFIGURATION ---
const queue = ['https://en.wikipedia.org/wiki/Open-source_software']; 
const visited = new Set();
const MAX_PAGES = 15; 
let pagesScraped = 0;

async function crawl() {
    if (queue.length === 0 || pagesScraped >= MAX_PAGES) {
        console.log(`\n[Spider] Crawl complete. Indexed ${pagesScraped} new pages.`);
        process.exit(0); // Shuts down the script cleanly
    }

    const currentUrl = queue.shift();

    if (visited.has(currentUrl)) {
        return crawl(); 
    }

    try {
        visited.add(currentUrl);
        console.log(`[Spider] Visiting: ${currentUrl}`);

        // DB Check: Skip this page if we already scraped it in a previous run
        const exists = await Page.findOne({ url: currentUrl });
        if (exists) {
            console.log(`[MongoDB] Skipping -> Already in Index`);
            return setTimeout(crawl, 500); 
        }

        const response = await axios.get(currentUrl, {
            headers: { 'User-Agent': 'AvatarBot/1.0 (+http://avatar-search.local)' }
        });

        const $ = cheerio.load(response.data);
        const title = $('title').text().trim();
        const textSnippet = $('p').slice(0, 3).text().replace(/\s+/g, ' ').trim().substring(0, 400) + '...';

        if (title && textSnippet.length > 20) {
            // Write the data directly to MongoDB
            const newPage = new Page({ 
                url: currentUrl, 
                title: title, 
                content: textSnippet 
            });
            await newPage.save();
            pagesScraped++;
            console.log(`[MongoDB] SAVED -> ${title}`);
        }

        // Find new links, stripping anchor tags and filtering out Wikipedia admin junk
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            if (href) {
                try {
                    let absoluteUrl = new URL(href, currentUrl).href;
                    absoluteUrl = absoluteUrl.split('#')[0]; // FIX: Strip anchor tags

                    if (
                        absoluteUrl.startsWith('http') && 
                        !visited.has(absoluteUrl) &&
                        !absoluteUrl.includes('Wikipedia:') && 
                        !absoluteUrl.includes('Special:') &&
                        !absoluteUrl.includes('Help:')
                    ) {
                        queue.push(absoluteUrl);
                    }
                } catch (err) {}
            }
        });

    } catch (error) {
        console.log(`[Spider Error]: ${error.message}`);
    }

    setTimeout(crawl, 1000); 
}

// --- ENGINE IGNITION ---
console.log("Waking up MongoDB...");
mongoose.connect('mongodb://127.0.0.1:27017/avatar_index')
  .then(() => {
      console.log('[MongoDB] Avatar Index Connected successfully.');
      console.log("Initializing Avatar Spider v2...");
      crawl(); // ONLY start the spider if the brain is online
  })
  .catch(err => {
      console.error('[MongoDB Error] Database connection failed:', err.message);
      process.exit(1);
  });