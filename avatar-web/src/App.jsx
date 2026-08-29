import { useState, useEffect } from 'react';
import { Search, Loader2, ShieldCheck, Bookmark, Menu, X, Globe, Camera, Video, Lock } from 'lucide-react';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import './index.css';

function App() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('web'); 
  const [results, setResults] = useState([]);
  const [mediaResults, setMediaResults] = useState([]); 
  const [aiSummary, setAiSummary] = useState(null);
const API_BASE_URL = 'https://avatar-search-engine-YOUR-ID.onrender.com';  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5); // Controls the "Load More" limit

  // --- AUTOCOMPLETE STATE ---
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // --- ZERO KNOWLEDGE VAULT STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [vaultKey, setVaultKey] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [userId] = useState(() => {
    let id = localStorage.getItem('avatar_uid');
    if (!id) { 
        id = 'user_' + Math.random().toString(36).substr(2, 9); 
        localStorage.setItem('avatar_uid', id); 
    }
    return id;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery && !hasSearched) {
      setQuery(searchQuery);
      setTimeout(() => executeSearch(searchQuery, 'web'), 100); 
    }
  }, []);

  // --- AUTOCOMPLETE LOGIC ---
  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setActiveSuggestionIndex(-1); 
    
    if (value.trim().length > 1) {
      try {
const response = await axios.get(`${API_BASE_URL}/autocomplete`, { params: { q: value } });        setSuggestions(response.data || []);
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = activeSuggestionIndex < suggestions.length - 1 ? activeSuggestionIndex + 1 : 0;
      setActiveSuggestionIndex(nextIndex);
      setQuery(suggestions[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : suggestions.length - 1;
      setActiveSuggestionIndex(prevIndex);
      setQuery(suggestions[prevIndex]);
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      const selectedQuery = suggestions[activeSuggestionIndex];
      setQuery(selectedQuery);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      executeSearch(selectedQuery, searchType);
    }
  };

  // --- VAULT LOGIC ---
  const unlockVault = async () => {
    const key = prompt("Enter your AES-256 Vault Password. If you lose this, your data is gone forever:");
    if (!key) return;
    setVaultKey(key);

    try {
const res = await axios.get(`${API_BASE_URL}/vault/fetch?userId=${userId}`);      if (res.data.encryptedData) {
        const bytes = CryptoJS.AES.decrypt(res.data.encryptedData, key);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        setBookmarks(decryptedData);
      } else {
        alert("Vault initialized! You can now save encrypted bookmarks.");
      }
    } catch (e) {
      alert("Invalid decryption key or corrupted vault.");
      setVaultKey('');
    }
  };

  const toggleBookmark = async (item) => {
    if (!vaultKey) {
      alert("You must unlock the Vault to save bookmarks.");
      setIsSidebarOpen(true);
      return;
    }

    const updatedBookmarks = [...bookmarks];
    const index = updatedBookmarks.findIndex(b => b.FirstURL === item.FirstURL);
    if (index >= 0) updatedBookmarks.splice(index, 1);
    else updatedBookmarks.push(item);

    setBookmarks(updatedBookmarks);

    try {
      const cipherText = CryptoJS.AES.encrypt(JSON.stringify(updatedBookmarks), vaultKey).toString();
      await axios.post(`${API_BASE_URL}/vault/sync`, { userId, encryptedData: cipherText });
    } catch (e) {
      console.error("Vault sync failed", e);
    }
  };

  // --- CORE SEARCH LOGIC ---
  const executeSearch = async (searchQuery, currentType) => {
    if (!searchQuery.trim()) return;
    document.activeElement.blur();
    setShowSuggestions(false); 
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResults([]);
    setMediaResults([]);
    setAiSummary(null);
    setVisibleCount(5); // Reset pagination on new search
    
    try {
      if (currentType === 'web') {
const res = await axios.get(`${API_BASE_URL}/search`, { params: { q: searchQuery } });        setResults(res.data.results || []);
        setAiSummary(res.data.aiSummary || null);
      } else {
const res = await axios.get(`${API_BASE_URL}/media`, { params: { q: searchQuery, type: currentType } });        setMediaResults(res.data.results || []);
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Is the backend server running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(query, searchType);
  };

  const switchTab = (type) => {
    setSearchType(type);
    if (hasSearched) executeSearch(query, type);
  };

  return (
    <div className={`avatar-container ${hasSearched ? 'layout-top' : 'layout-center'}`}>
      
      <button className="vault-toggle-btn" onClick={() => setIsSidebarOpen(true)}>
        <Menu size={24} />
      </button>

      <div className="header-wrapper">
        <div className="logo-container">
          <svg width={hasSearched ? "32" : "56"} height={hasSearched ? "32" : "56"} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#1a73e8" strokeWidth="8" fill="#f8f9fa"/>
            <path d="M50 20 L25 75 L38 75 L44 58 L56 58 L62 75 L75 75 Z" fill="#1a73e8"/>
            <circle cx="50" cy="50" r="8" fill="#ffffff"/>
          </svg>
          <h1 className="avatar-title">Avatar</h1>
        </div>
      </div>
      
      <form onSubmit={handleSearchSubmit} className="search-wrapper">
        <input 
          type="text" 
          className="search-input"
          placeholder="Search securely with Avatar..." 
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onFocus={() => query.length > 1 && setShowSuggestions(true)}
          autoFocus
        />
        <button type="submit" className="search-btn" disabled={isLoading}>
          {isLoading ? <Loader2 size={20} className="spinner" /> : <Search size={20} />}
        </button>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index} 
                className={`suggestion-item ${index === activeSuggestionIndex ? 'active-suggestion' : ''}`}
                onMouseDown={() => {
                  setQuery(suggestion);
                  setShowSuggestions(false);
                  executeSearch(suggestion, searchType);
                }}
              >
                <Search size={14} className="suggestion-icon" /> {suggestion}
              </div>
            ))}
          </div>
        )}
      </form>

      {hasSearched && (
        <div className="search-tabs">
          <button className={`search-tab ${searchType === 'web' ? 'active' : ''}`} onClick={() => switchTab('web')}>
            <Globe size={16} /> Web
          </button>
          <button className={`search-tab ${searchType === 'images' ? 'active' : ''}`} onClick={() => switchTab('images')}>
            <Camera size={16} /> Images
          </button>
          <button className={`search-tab ${searchType === 'videos' ? 'active' : ''}`} onClick={() => switchTab('videos')}>
            <Video size={16} /> Videos
          </button>
        </div>
      )}

      {error && <div className="error-box" style={{marginTop: '20px', color: 'red'}}><p>{error}</p></div>}

      <div className="results-container">
        
        {/* --- 1. AI SUMMARY BOX --- */}
        {aiSummary && (
            <div className="ai-summary mb-10 p-5 rounded-xl border border-blue-500/30 bg-blue-50/50 shadow-sm" style={{ marginBottom: '2rem', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(239, 246, 255, 0.5)' }}>
                <h4 className="text-xs font-bold text-blue-600 mb-3 tracking-widest uppercase flex items-center gap-2" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#2563eb', marginBottom: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🛡️ Avatar AI Synthesized Result
                </h4>
                <p className="text-gray-800 text-sm leading-relaxed" style={{ color: '#1f2937', fontSize: '0.875rem', lineHeight: '1.625' }}>{aiSummary}</p>
            </div>
        )}

        {/* --- 2. STANDARD WEB RESULTS --- */}
        {searchType === 'web' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '2rem' }}>
            {results.slice(0, visibleCount).map((item, index) => {
              
              // Resolve URL logic between legacy schemas and new spider swarm
              let cleanUrl = item.URL || item.FirstURL;
              if (!cleanUrl) return null; 
              
              // URL Decoding
              if (cleanUrl.includes('uddg=')) {
                try {
                  cleanUrl = decodeURIComponent(cleanUrl.split('uddg=')[1].split('&')[0]);
                } catch (e) {}
              }

              const title = item.Title || item.Text.split(' - ')[0];

              // Strict Ad Firewall
              if (
                cleanUrl.includes('y.js') || 
                cleanUrl.includes('ad_domain') || 
                title.toLowerCase().includes('ad viewing ads')
              ) {
                return null;
              }

              const isBookmarked = bookmarks.some(b => b.FirstURL === cleanUrl);

              return (
                <div key={index} style={{ paddingBottom: '1.5rem', borderBottom: '1px solid #eaeaea' }}>
                  
                  {/* Header: Domain Tag, URL, and Bookmark */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Dynamically extract the clean domain name instead of showing the scraper source */}
                      <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: '#f1f3f4', padding: '2px 8px', borderRadius: '12px', color: '#5f6368' }}>
                        {(() => {
                          try {
                            return new URL(cleanUrl).hostname.replace('www.', '');
                          } catch(e) {
                            return 'WEB';
                          }
                        })()}
                      </span>
                      <span style={{ fontSize: '13px', color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                        {cleanUrl}
                      </span>
                    </div>
                    
                    <button 
                      className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`} 
                      onClick={() => toggleBookmark({ Title: title, FirstURL: cleanUrl, Text: item.Text })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                      <Bookmark size={18} fill={isBookmarked ? '#1a73e8' : 'none'} color={isBookmarked ? '#1a73e8' : '#5f6368'} />
                    </button>
                  </div>
                  
                  {/* Clickable Title */}
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" 
                     style={{ fontSize: '20px', color: '#1a0dab', textDecoration: 'none', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                    {title}
                  </a>
                  
                  {/* Snippet Context */}
                  <p style={{ fontSize: '14px', color: '#4d5156', lineHeight: '1.58', margin: 0, maxWidth: '800px' }}>
                    {item.Text}
                  </p>
                </div>
              );
            })}

            {/* --- LOAD MORE BUTTON --- */}
            {results.length > visibleCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', paddingBottom: '4rem' }}>
                <button 
                  onClick={() => setVisibleCount(prev => prev + 5)}
                  style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600', color: '#1a73e8', backgroundColor: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '24px', cursor: 'pointer' }}
                >
                  Load more results
                </button>
              </div>
            )}
          </div>
        )}

        {searchType === 'images' && (
          <div className="media-grid">
            {mediaResults.map((img, i) => (
              <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="media-card">
                <img src={img.thumbnail || img.image} alt={img.title} loading="lazy" />
                <div className="media-title">{img.title}</div>
              </a>
            ))}
          </div>
        )}

        {searchType === 'videos' && (
          <div className="media-grid">
            {mediaResults.map((vid, i) => (
              <a key={i} href={vid.content || vid.url} target="_blank" rel="noopener noreferrer" className="media-card">
                <div className="video-thumb-wrapper">
                  <img src={vid.images?.medium || vid.images?.small} alt={vid.title} loading="lazy" />
                  <div className="play-badge"><Video size={12} /> {vid.duration}</div>
                </div>
                <div className="media-title">{vid.title}</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className={`vault-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="vault-header">
          <h2><Lock size={18} fill="#1a73e8" color="#1a73e8"/> Encrypted Vault</h2>
          <button className="close-vault-btn" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
        </div>
        <div className="vault-content">
          {!vaultKey ? (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <p className="empty-vault" style={{ marginBottom: '15px' }}>Vault is locked. Decrypt to view bookmarks.</p>
              <button onClick={unlockVault} className="load-more-btn">Unlock Vault</button>
            </div>
          ) : bookmarks.length === 0 ? (
            <p className="empty-vault">Vault is secure. No data saved.</p>
          ) : (
            bookmarks.map((b, i) => (
              <div key={i} className="vault-item">
                <a href={b.FirstURL} target="_blank" rel="noopener noreferrer" className="vault-item-title">{b.Title}</a>
                <button className="remove-bookmark-btn" onClick={() => toggleBookmark(b)}><X size={16} /></button>
              </div>
            ))
          )}
        </div>
      </div>
      
      {isSidebarOpen && <div className="vault-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
}

export default App;