<div align="center">
  
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-check.svg" alt="Avatar Logo" width="80" height="80">

  # Avatar Search Engine
  **A Zero-Knowledge, Anti-Tracking Private Search Engine**

  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
  [![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](#)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](#)
  [![Cybersecurity](https://img.shields.io/badge/Security-AES--256-red?style=for-the-badge)](#)

  **[Live MVP Demo](https://avatar-web-chi.vercel.app/)** • **[Report Bug](#)** • **[Request Feature](#)**
</div>

<br>

Avatar is a high-performance, full-stack metasearch engine engineered with a strict privacy-first architecture. Designed to bypass aggressive cloud datacenter firewalls without relying on fragile paid API keys, Avatar aggregates high-quality web, image, and video results while keeping user data mathematically hidden.

It features a custom AI Answer Engine and a client-side AES-256 encrypted bookmarking vault, wrapped in a sleek, cinematic UI built for speed.

---

## ⚡ Core Architecture & Features

### 🛡️ Zero-Knowledge Encrypted Vault
Your bookmarks are encrypted directly in the browser using AES-256 (`crypto-js`) before ever touching the database. The server routes blind ciphertexts to MongoDB. The database administrator has zero visibility into your saved links or vault password. If you lose your key, the data is unrecoverable.

### 🧠 Key-Free AI Synthesizer
Instead of relying on rate-limited LLM APIs, Avatar utilizes an extractive AI engine. It dynamically pulls verified encyclopedic context from Open APIs, cleans the HTML payload, and synthesizes accurate, readable summaries at the top of your web results.

### 🌐 Datacenter-Safe Dual Web Engine
Cloud environments (like Render and Vercel) are routinely IP-blocked by major search engines. Avatar bypasses these firewalls using an intelligent dual-fallback architecture, layering Wikipedia's Open API with heavily optimized, datacenter-safe DuckDuckGo Lite scrapers to guarantee 100% uptime.

### 📸 Deep Async Media Scraper
Traditional image scrapers fail under cloud IPs. Avatar leverages a direct async image endpoint to stream 40+ high-resolution images instantly per query, paired with Dailymotion's Open API for HD video thumbnails.

---

## 🛠️ Tech Stack

| Domain | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) | Hosted on Vercel. Manages UI state, local storage tracking, and AES-256 client-side cryptography. |
| **Backend API** | Node.js / Express | Hosted on Render. Handles request proxying, multi-engine data normalization, and firewall evasion. |
| **Database** | MongoDB | Stores serialized, encrypted user bookmark payloads natively. |
| **Styling** | Custom CSS | Responsive, dark-mode cinematic aesthetic. |

---

## 🚀 Local Deployment

### Prerequisites
* **Node.js** (v18 or higher)
* **MongoDB URI** (For the Encrypted Vault cluster)
* **Git**

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone [https://github.com/8gitty/avatar-search-engine.git](https://github.com/8gitty/avatar-search-engine.git)
   cd avatar-search-engine
   ```

2. **Initialize the Backend**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the backend directory:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   ```
   Start the API:
   ```bash
   npm start
   ```

3. **Initialize the Frontend**
   Open a new terminal window:
   ```bash
   cd frontend
   npm install
   ```
   Open `src/App.jsx` and ensure the API base URL points to your local server during development:
   ```javascript
   const API_BASE_URL = 'http://localhost:5000';
   ```
   Start the React development server:
   ```bash
   npm run dev
   ```

---

## 🔒 Security Statement

Avatar is built on the principle of **Zero Trust**. 
* **No IP Logging:** The Express backend does not log or store originating client IP addresses.
* **No Tracking Pixels:** The web and media scrapers actively strip tracking parameters (e.g., `uddg=`) and invisible 1x1 ad pixels before delivering the JSON payload to the client.
* **Client-Side Cryptography:** Data is transformed into unreadable ciphertext on your local machine. A compromised database yields zero actionable intelligence.

---

## 🤝 Contributing

Avatar is an open-source initiative aimed at proving that high-quality search does not require sacrificing privacy. Contributions, issues, and feature requests are highly encouraged.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<div align="center">
  <p>Engineered with privacy and performance in mind.</p>
</div>
