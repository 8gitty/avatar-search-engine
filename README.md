# Avatar. | Privacy-First Metasearch Engine

Avatar is a custom-built, privacy-centric metasearch engine designed to completely anonymize user search queries. It acts as an intermediary shield, routing search requests through the Tor network to strip IP data and sanitize tracking parameters before delivering deep-web search results to a clean, cinematic UI.

## 🚀 Architecture
* **Frontend:** React.js + Vite (Dark/Cyberpunk UI aesthetic)
* **Backend Proxy:** Node.js + Express
* **Anonymity Layer:** Native Tor Network routing (`socks-proxy-agent`)
* **Data Parsing:** Cheerio (Server-side HTML scraping)

## 🛡️ Core Security Features
1. **Zero Logging:** Browser never communicates directly with upstream search providers.
2. **Tor Ghosting:** All backend proxy traffic is routed via a local SOCKS5 Tor tunnel (`127.0.0.1:9050`), masking the server's true IP.
3. **Tracker Scrubbing:** Custom utility functions intercept and delete `utm_*`, `gclid`, and `fbclid` parameters from target URLs before sending them to the client.

## 💻 Local Setup
1. Ensure the **Tor service** is installed and running natively on your machine (Port 9050).
2. Clone the repository.
3. Open two terminals.
4. **Backend:** `cd privacy-search-engine` -> `npm install` -> `node index.js`
5. **Frontend:** `cd avatar-web` -> `npm install` -> `npm run dev`