import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link, useLocation } from 'react-router-dom';
import { getAnimeDetails } from '../lib/anilist';
import { getProviders, getEpisodes, getStream } from '../lib/anifox';
import { getTmdbData, TmdbEpisode } from '../lib/tmdb';
import Player from '../components/Player';
import { AnimeDetails, Episode, ServerInstance, TmdbShowDetails } from '../types/anifox';
import { PlayCircle, Eye, LayoutGrid, Search, Film, AlertCircle, Download, Share2, Zap, Server, Mic, Command, Lightbulb, ChevronDown, ChevronRight, Check } from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const preloadedState = location.state as { anime?: AnimeDetails, tmdbDetails?: any, audioMode?: string, preloadedEpisodes?: Episode[] };

  const [anime, setAnime] = useState<AnimeDetails | null>(preloadedState?.anime || null);
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [tmdbEpisodes, setTmdbEpisodes] = useState<Record<number, TmdbEpisode>>({});
  const [tmdbDetails, setTmdbDetails] = useState<TmdbShowDetails | null>(preloadedState?.tmdbDetails || null);
  const [skipTimes, setSkipTimes] = useState<{op?: [number, number], ed?: [number, number]} | null>(null);

  const [serversList, setServersList] = useState<ServerInstance[]>([]);
  const [activeServer, setActiveServer] = useState<ServerInstance | null>(null);

  const [audioMode, setAudioMode] = useState(preloadedState?.audioMode || searchParams.get('audio') || 'sub');
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  
  const handleServerSelect = (server: ServerInstance) => {
    setActiveServer(server);
    setShowServerMenu(false);
    if (id) {
      localStorage.setItem(`anifox_pref_provider_${id}`, server.provider);
    }
  };
  
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [hideWatched, setHideWatched] = useState(false);
  const [isGridView, setIsGridView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Throttle save history to avoid spamming localStorage
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('watchedEps');
    if (stored) {
       try { setWatchedEps(new Set(JSON.parse(stored))); } catch {}
    }
  }, []);

  const handleTimeUpdate = (time: number, duration: number) => {
    if (!anime || !selectedEpisode || duration <= 0) return;
    
    // Require at least 15 seconds of watch time before adding to history
    // This prevents "fake" or spam entries from just clicking an episode
    if (time < 15) return;
    
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return; // Save every 5 seconds max
    lastSaveRef.current = now;

    const progress = (time / duration) * 100;
    
    try {
      const historyStr = localStorage.getItem('aniko_watch_history');
      let history: any[] = historyStr ? JSON.parse(historyStr) : [];
      
      const item = {
        animeId: anime.id,
        title: anime.title,
        image: anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large,
        episodeId: selectedEpisode.id,
        episodeNum: selectedEpisode.number,
        progress: progress,
        timestamp: now
      };
      
      // Remove existing entry for this anime if it exists
      history = history.filter((h: any) => h.animeId !== anime.id);
      
      // Add to beginning of array
      history.unshift(item);
      
      // Keep only last 50 items
      if (history.length > 50) history = history.slice(0, 50);
      
      localStorage.setItem('aniko_watch_history', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save watch history', e);
    }
  };

  useEffect(() => {
    if (selectedEpisode) {
       setWatchedEps(prev => {
          if (prev.has(selectedEpisode.id)) return prev;
          const next = new Set(prev);
          next.add(selectedEpisode.id);
          localStorage.setItem('watchedEps', JSON.stringify(Array.from(next)));
          return next;
       });
    }
  }, [selectedEpisode]);

  // Load Anime details and Provider list on mount
  useEffect(() => {
    if (!id) return;
    let isCancelled = false;
    Promise.all([
      (preloadedState?.anime ? Promise.resolve(preloadedState.anime) : getAnimeDetails(id)).then(async (data) => {
         if (!preloadedState?.anime) setAnime(data);
         const query = data.title.english || data.title.romaji;
         if (query) {
            const res = await getTmdbData(query, data.startDate || { year: data.seasonYear });
            if (isCancelled) return;
            setTmdbEpisodes(res.episodes);
            if (!preloadedState?.tmdbDetails) setTmdbDetails(res.details);
         }
      }),
      getProviders().then(provs => {
        // Priority list of providers that return native HLS (m3u8) with SOFT SUBS
        const priority = ['anikoto', '2dhive', 'animegg'];
        
        // Sort providers so soft-sub ones are scraped first in chunks
        const sortedProvs = [...provs].sort((a, b) => {
          const idxA = priority.indexOf(a);
          const idxB = priority.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });

        setProviders(sortedProvs);
        
        const preferredProvider = localStorage.getItem(`anifox_pref_provider_${id}`);
        const bestProvider = preferredProvider && sortedProvs.includes(preferredProvider) ? preferredProvider : (priority.find(p => sortedProvs.includes(p)) || sortedProvs[0]);
        if (bestProvider) {
          setSelectedProvider(bestProvider);
        }
      })
    ]).finally(() => setLoadingContent(false));
  }, [id]);

  // Load Episodes when provider changes
  useEffect(() => {
    if (!id || !selectedProvider) return;
    
    // If the Details page already prefetched the episodes in the background, use them instantly!
    if (selectedProvider === 'anikoto' && preloadedState?.preloadedEpisodes && preloadedState.preloadedEpisodes.length > 0) {
        const eps = preloadedState.preloadedEpisodes;
        setEpisodes(eps);
        
        const urlEp = searchParams.get('ep') || '1';
        const targetEp = eps.find(e => e.number.toString() === urlEp);
        if (targetEp) {
          setSelectedEpisode(targetEp);
        } else if (eps.length > 0) {
          setSelectedEpisode(eps[0]);
        }
        setLoadingEpisodes(false);
        
        // Clear it so we don't accidentally reuse it if the user manually changes providers
        preloadedState.preloadedEpisodes = undefined; 
        return;
    }
    
    setLoadingEpisodes(true);
    setEpisodes([]);
    
    getEpisodes(selectedProvider, id)
      .then(eps => {
        setEpisodes(eps);
        const urlEp = searchParams.get('ep') || '1';
        const targetEp = eps.find(e => e.number.toString() === urlEp);
        if (targetEp) {
          setSelectedEpisode(targetEp);
        } else if (eps.length > 0) {
          setSelectedEpisode(eps[0]);
        }
      })
      .catch(err => {
        console.error(err);
        setError(`Provider ${selectedProvider} failed or has no episodes for this anime.`);
      })
      .finally(() => setLoadingEpisodes(false));
  }, [id, selectedProvider]); // Removed initialEp to prevent infinite fetch loop

  // Sync selected episode with URL changes (e.g. browser back button)
  useEffect(() => {
    if (episodes.length === 0) return;
    const urlEp = searchParams.get('ep');
    if (!urlEp) return;
    
    setSelectedEpisode(prev => {
      if (prev && prev.number.toString() === urlEp) return prev;
      const targetEp = episodes.find(e => e.number.toString() === urlEp);
      return targetEp || prev;
    });
  }, [searchParams, episodes]);

  // Load Stream when episode is clicked
  useEffect(() => {
    if (!selectedEpisode || !id || providers.length === 0) return;

    setLoadingStream(true);
    setError(null);
    setServersList([]);
    setActiveServer(null);
    
    setSearchParams(prev => {
      prev.set('ep', selectedEpisode.number.toString());
      prev.set('audio', audioMode);
      return prev;
    }, { replace: true });

    // Track active server in a closure so concurrent promises know if one is already set
    let isFirstHlsSet = false;
    let completedRequests = 0;
    let isCancelled = false;
    const fetchController = new AbortController();

    const fetchInBatches = async () => {
      const preferredProvider = localStorage.getItem(`anifox_pref_provider_${id}`);
      let orderedProviders = [...providers];
      
      if (preferredProvider && orderedProviders.includes(preferredProvider)) {
        orderedProviders = [
          preferredProvider,
          ...orderedProviders.filter(p => p !== preferredProvider)
        ];
      }

      let heldFallbackServer: ServerInstance | null = null;
      const chunkSize = 3;
      
      for (let i = 0; i < orderedProviders.length; i += chunkSize) {
        if (isCancelled) break;
        
        const chunk = orderedProviders.slice(i, i + chunkSize);
        
        const promises = chunk.map(provider => {
           const watchId = `watch/${provider}/${id}/${audioMode}/${provider}-${selectedEpisode.number}`;
           
           return getStream(watchId, fetchController.signal)
             .then(data => {
                if (isCancelled) return;
                const newServers: ServerInstance[] = [];

                // Helper to determine soft/hard sub
                const checkSoftSub = (streamItem?: any) => {
                   const hasGlobalSubs = data.subtitles && data.subtitles.length > 0;
                   const hasStreamSubs = streamItem && streamItem.subtitles && streamItem.subtitles.length > 0;
                   return hasGlobalSubs || hasStreamSubs;
                };

                const getSubs = (streamItem?: any) => {
                   if (streamItem && streamItem.subtitles && streamItem.subtitles.length > 0) return streamItem.subtitles;
                   if (data.subtitles && data.subtitles.length > 0) return data.subtitles;
                   return [];
                };

                if (data.stream_url && provider !== 'reanime') {
                  const exists = data.streams?.find(s => s.url === data.stream_url);
                  if (!exists) {
                    const isSoft = checkSoftSub();
                    newServers.push({ id: `native-${provider}-main`, name: `${provider} (Main)`, type: 'hls', url: data.stream_url, provider, subType: isSoft ? 'SOFT SUB' : 'HARD SUB', subtitles: getSubs() });
                  }
                }
                
                if (data.streams) {
                  data.streams.forEach((s, idx) => {
                    // Smart Audio Mode Filtering
                    if (s.server) {
                      if (audioMode === 'sub' && /\bdub\b/i.test(s.server)) return;
                      if (audioMode === 'dub' && /\b(sub|raw)\b/i.test(s.server)) return;
                    }

                    const isSoft = checkSoftSub(s);
                    const subType = isSoft ? 'SOFT SUB' : 'HARD SUB';
                    const subtitles = getSubs(s);
                    const name = s.server ? `${provider} (${s.server})` : `${provider} ${idx+1}`;
                    
                    if (s.type === 'hls' || s.type === 'hls-redirect') {
                      if (provider !== 'reanime') {
                        newServers.push({ id: `hls-${provider}-${idx}`, name, type: 'hls', url: s.url, provider, subType, subtitles });
                      }
                    } 
                    if (s.type === 'embed') {
                      newServers.push({ id: `embed-${provider}-${idx}`, name, type: 'embed', url: s.url, provider, subType, subtitles });
                    } 
                    if (s.embedUrl) {
                      newServers.push({ id: `embed-url-${provider}-${idx}`, name, type: 'embed', url: s.embedUrl, provider, subType, subtitles });
                    }
                  });
                }
                
                if (data.allServers) {
                  data.allServers.forEach((s, idx) => {
                     if (!newServers.find(x => x.url === s.embed)) {
                        // Embeds typically don't expose sub tracks to our API, default to HARD SUB
                        newServers.push({ id: `allserver-${provider}-${idx}`, name: s.name ? `${provider} (${s.name})` : `${provider} ${idx+1}`, type: 'embed', url: s.embed, provider, subType: 'HARD SUB', subtitles: [] });
                     }
                  });
                }

                if (newServers.length > 0) {
                   setServersList(prev => {
                     const existingIds = new Set(prev.map(p => p.id));
                     const uniqueNew = newServers.filter(n => !existingIds.has(n.id));
                     return [...prev, ...uniqueNew];
                   });
                   
                   // Smart Preference Auto-Play Logic
                   const anyHls = newServers.find(s => s.type === 'hls');

                   if (anyHls && !isFirstHlsSet) {
                      if (preferredProvider) {
                         if (provider === preferredProvider) {
                            // The preferred provider finished successfully, play it instantly!
                            setActiveServer(anyHls);
                            isFirstHlsSet = true;
                         } else {
                            // A non-preferred provider finished first, hold it in background
                            if (!heldFallbackServer) {
                               heldFallbackServer = anyHls;
                            }
                         }
                      } else {
                         // No preference set, normal race logic
                         setActiveServer(anyHls);
                         isFirstHlsSet = true;
                      }
                   }
                }
             })
             .catch(err => {
                if (!isCancelled) console.error(`Failed fetching stream for ${provider}:`, err);
             })
             .finally(() => {
                completedRequests++;
                if (completedRequests === providers.length && !isCancelled) {
                   setLoadingStream(false);
                }
             });
        });

        // Wait for the current chunk to finish completely before firing the next batch
        await Promise.allSettled(promises);
        
        // Smart Fallback: If the chunk contained the preferred provider but it failed or timed out
        if (preferredProvider && chunk.includes(preferredProvider) && !isFirstHlsSet) {
           if (heldFallbackServer) {
              setActiveServer(heldFallbackServer);
              isFirstHlsSet = true;
           }
        }
      }
    };

    fetchInBatches();

    return () => {
      isCancelled = true;
      fetchController.abort();
    };

  }, [selectedEpisode, id, providers, audioMode, setSearchParams]);

  // Fetch AniSkip Data
  useEffect(() => {
    if (!anime?.idMal || !selectedEpisode) {
       setSkipTimes(null);
       return;
    }
    
    // Clear previous skip times when episode changes
    setSkipTimes(null);

    fetch(`https://api.aniskip.com/v2/skip-times/${anime.idMal}/${selectedEpisode.number}?types[]=op&types[]=ed&episodeLength=0`)
      .then(res => res.json())
      .then(data => {
        if (data.found && data.results) {
          const newSkipTimes: any = {};
          
          const opResult = data.results.find((r: any) => r.skipType === 'op');
          if (opResult?.interval) {
             newSkipTimes.op = [opResult.interval.startTime, opResult.interval.endTime];
          }
          
          const edResult = data.results.find((r: any) => r.skipType === 'ed');
          if (edResult?.interval) {
             newSkipTimes.ed = [edResult.interval.startTime, edResult.interval.endTime];
          }
          
          if (newSkipTimes.op || newSkipTimes.ed) {
             setSkipTimes(newSkipTimes);
          }
        }
      })
      .catch(err => {
        console.warn('Failed to fetch AniSkip data:', err);
      });
  }, [anime?.idMal, selectedEpisode]);



  const allRelatedAnime = useMemo(() => {
    if (!anime?.relations?.edges) return [];
    const map = new Map();
    
    anime.relations.edges.forEach((edge: any) => {
      if (edge.node.type === 'ANIME') {
        map.set(edge.node.id, edge);
      }
      if (edge.node.relations?.edges) {
        edge.node.relations.edges.forEach((subEdge: any) => {
           if (subEdge.node.type === 'ANIME' && subEdge.node.id !== anime.id && !map.has(subEdge.node.id)) {
              map.set(subEdge.node.id, subEdge);
           }
        });
      }
    });
    
    // Convert to array and try to sort SEQUEL/PREQUEL first
    return Array.from(map.values()).sort((a: any, b: any) => {
       const order: Record<string, number> = { 'PREQUEL': 1, 'SEQUEL': 2, 'PARENT': 3, 'SIDE_STORY': 4, 'SPIN_OFF': 5 };
       const aVal = order[a.relationType] || 99;
       const bVal = order[b.relationType] || 99;
       return aVal - bVal;
    });
  }, [anime]);

  if (loadingContent) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-pulse text-gradient" style={{ fontSize: '2rem' }}>Loading Player...</div>
      </div>
    );
  }

  if (!anime) return <div>Anime not found</div>;

  const filteredEpisodes = episodes.filter(ep => {
     if (hideWatched && watchedEps.has(ep.id)) return false;
     if (searchQuery && !ep.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !ep.number.toString().includes(searchQuery)) return false;
     return true;
  });



  return (
    <div className="watch-page-container">
      {/* Player Section Layout */}
      <div className="watch-main-layout">
        
        {/* Left Column: Player & Info */}
        <div className="player-column">
          <div className="video-wrapper">
            {error ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', padding: '2rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
                <p><AlertCircle size={32} style={{ margin: '0 auto 1rem' }} /> {error}</p>
              </div>
            ) : (!activeServer && loadingStream) ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="animate-pulse">Loading Stream...</div>
              </div>
            ) : activeServer ? (
              activeServer.type === 'hls' ? (
                <Player key={activeServer.url} src={activeServer.url} type="hls" subtitles={activeServer.subtitles || []} hasEmbeds={serversList.some(s => s.type === 'embed')} skipTimes={skipTimes} onTimeUpdate={handleTimeUpdate} />
              ) : (
                <iframe 
                  key={activeServer.url}
                  src={activeServer.url} 
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="text-muted">Select an episode to start watching</p>
              </div>
            )}
          </div>
          
          {/* Player Bottom Toolbar */}
          <div className="player-bottom-toolbar">
             <div className="tb-left">
                <button className="tb-btn"><div className="tb-square" style={{background: '#555'}}></div> Autoplay</button>
                <button className="tb-btn active"><div className="tb-square"></div> Auto Skip</button>
                <button className="tb-btn"><div className="tb-square" style={{background: '#555'}}></div> Auto Next</button>
                <button className="tb-btn"><Command size={14} /> Shortcuts</button>
                <button className="tb-btn"><Lightbulb size={14} /> Lights Off</button>
                <button className="tb-btn"><PlayCircle size={14} /> Plyr</button>
             </div>
             <div className="tb-right">
                <button className="tb-btn" onClick={() => {
                   if (selectedEpisode && selectedEpisode.number > 1) {
                       const prev = episodes.find(e => e.number === selectedEpisode.number - 1);
                       if (prev) setSelectedEpisode(prev);
                   }
                }}>&lt;&lt; Episode {selectedEpisode ? selectedEpisode.number - 1 : 0}</button>
                <button className="tb-btn" onClick={() => {
                   if (selectedEpisode) {
                       const next = episodes.find(e => e.number === selectedEpisode.number + 1);
                       if (next) setSelectedEpisode(next);
                   }
                }}>Episode {selectedEpisode ? selectedEpisode.number + 1 : 2} &gt;&gt;</button>
             </div>
          </div>
          
          {/* Episode Info Area */}
          <div className="episode-meta-box">
             <div className="ep-meta-col-left">
                <h1 className="ep-main-title">
                  {selectedEpisode ? `${selectedEpisode.number}. ${selectedEpisode.title || 'Episode ' + selectedEpisode.number}` : anime.title.english || anime.title.romaji}
                </h1>
                
                <div className="ep-meta-tags-row">
                   <span className="ep-pill">
                     {(() => {
                        const tmdbEp = selectedEpisode ? tmdbEpisodes[selectedEpisode.number] : null;
                        if (tmdbEp?.air_date) {
                          return new Date(tmdbEp.air_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                        }
                        if (anime.startDate?.year) {
                          return new Date(anime.startDate.year, (anime.startDate.month || 1) - 1, anime.startDate.day || 1).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                        }
                        return 'Unknown Date';
                     })()}
                   </span>
                   <span className="ep-pill"><span className="cc-box-sm" style={{background: 'white', color: 'black', marginRight: '4px'}}>CC</span> {episodes.length > 0 ? episodes.filter(e => e.hasSub !== false).length : '?'}</span>
                   <span className="ep-pill"><Mic size={14} style={{marginRight: '4px'}}/> {episodes.length > 0 ? episodes.filter(e => e.hasDub !== false).length : '?'}</span>
                </div>
             </div>
             
             <div className="ep-meta-col-right">
                <div className="ep-dropdowns-container">
                   <div className="ep-dropdown-labels">
                      <span className="controls-label"><Mic size={12}/> AUDIO</span>
                      <span className="controls-label"><Server size={12}/> SERVER ({serversList.length})</span>
                   </div>
                   <div className="ep-joined-dropdowns">
                      <div className="dropdown-wrapper">
                         <button className="ep-joined-btn" onClick={() => { setShowAudioMenu(!showAudioMenu); setShowServerMenu(false); }}>
                           <span className="cc-box-sm" style={{background: 'white', color: 'black'}}>CC</span> {audioMode === 'sub' ? 'Sub' : 'Dub'} <ChevronDown size={14} style={{marginLeft: 'auto'}}/>
                         </button>
                         {showAudioMenu && (
                           <div className="custom-dropdown-menu">
                              <button 
                                className={`dropdown-item ${audioMode === 'sub' ? 'active' : ''}`} 
                                onClick={() => { 
                                  if (selectedEpisode?.hasSub !== false) { // Default to true if undefined
                                    setAudioMode('sub'); 
                                    setShowAudioMenu(false); 
                                  }
                                }}
                                style={selectedEpisode?.hasSub === false ? { opacity: 0.5, cursor: 'not-allowed', textDecoration: 'line-through', textDecorationColor: '#ff4444', textDecorationThickness: '2px' } : {}}
                                disabled={selectedEpisode?.hasSub === false}
                              >
                                Sub
                              </button>
                              <button 
                                className={`dropdown-item ${audioMode === 'dub' ? 'active' : ''}`} 
                                onClick={() => { 
                                  if (selectedEpisode?.hasDub !== false) {
                                    setAudioMode('dub'); 
                                    setShowAudioMenu(false); 
                                  }
                                }}
                                style={selectedEpisode?.hasDub === false ? { opacity: 0.5, cursor: 'not-allowed', textDecoration: 'line-through', textDecorationColor: '#ff4444', textDecorationThickness: '2px' } : {}}
                                disabled={selectedEpisode?.hasDub === false}
                              >
                                Dub
                              </button>
                           </div>
                         )}
                      </div>
                      <div className="ep-divider"></div>
                      <div className="dropdown-wrapper">
                         <button className="ep-joined-btn" onClick={() => { setShowServerMenu(!showServerMenu); setShowAudioMenu(false); }}>
                           <Zap size={14}/> 
                           <span style={{maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                             {activeServer ? (activeServer.provider && !activeServer.name.toLowerCase().includes(activeServer.provider.toLowerCase()) ? `${activeServer.provider} (${activeServer.name})` : activeServer.name) : 'Auto'}
                           </span>
                           <ChevronDown size={14} style={{marginLeft: 'auto'}}/>
                         </button>
                         {showServerMenu && (
                           <div className="custom-dropdown-menu custom-dropdown-right" style={{padding: '0.5rem', width: '260px'}}>
                              {serversList.filter(s => s.type === 'hls').map(server => (
                                 <button key={server.id} className={`dropdown-item flat-server-item ${activeServer?.id === server.id ? 'active' : ''}`} onClick={() => handleServerSelect(server)}>
                                    <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                      {server.provider || server.name} {activeServer?.id === server.id && <Check size={14} />}
                                    </span>
                                    <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                                      <span className="server-badge badge-dl">DL</span>
                                      {server.subType && server.subType.toLowerCase().includes('soft') && (
                                        <span className="server-badge badge-ssub">S-SUB</span>
                                      )}
                                      {server.subType && server.subType.toLowerCase().includes('hard') && (
                                        <span className="server-badge badge-hsub">H-SUB</span>
                                      )}
                                    </div>
                                 </button>
                              ))}
                              {serversList.filter(s => s.type === 'embed').map(server => (
                                 <button key={server.id} className={`dropdown-item flat-server-item ${activeServer?.id === server.id ? 'active' : ''}`} onClick={() => handleServerSelect(server)}>
                                    <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                      {server.provider || server.name} {activeServer?.id === server.id && <Check size={14} />}
                                    </span>
                                    <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                                      <span className="server-badge badge-emb">EMBED</span>
                                      {server.subType && server.subType.toLowerCase().includes('soft') && (
                                        <span className="server-badge badge-ssub">S-SUB</span>
                                      )}
                                      {server.subType && server.subType.toLowerCase().includes('hard') && (
                                        <span className="server-badge badge-hsub">H-SUB</span>
                                      )}
                                    </div>
                                 </button>
                              ))}
                           </div>
                         )}
                      </div>
                   </div>
                </div>
                
                <div className="ep-actions-row">
                   <button className="ep-action-btn"><AlertCircle size={14}/> Report</button>
                   <button className="ep-action-btn"><Download size={14}/> Download</button>
                   <button className="ep-action-btn"><Share2 size={14}/> Share</button>
                </div>
             </div>
          </div>


          {/* Anime Details Box */}
          <div className="anime-details-box">
            <div className="details-poster-col">
               <div className="details-poster-wrapper">
                 <img src={anime.coverImage.extraLarge || anime.coverImage.large} alt={anime.title.english || anime.title.romaji} className="details-poster-img" />
               </div>
               <div className="details-poster-actions">
                 <button className="details-action-btn trailer-btn" onClick={() => {
                   if (anime.trailer && anime.trailer.site === 'youtube') {
                     window.open(`https://youtube.com/watch?v=${anime.trailer.id}`, '_blank');
                   }
                 }}>
                   TRAILER
                 </button>
                 <button className="details-action-btn add-btn">+</button>
               </div>
               <div className="details-poster-links">
                 <button className="details-link-btn" onClick={() => window.open(`https://anilist.co/anime/${anime.id}`, '_blank')}>AL</button>
                 {anime.idMal && (
                   <button className="details-link-btn" onClick={() => window.open(`https://myanimelist.net/anime/${anime.idMal}`, '_blank')}>MAL</button>
                 )}
               </div>
            </div>
            <div className="details-info-col">
               {tmdbDetails?.images?.logos && tmdbDetails.images.logos.length > 0 ? (
                 <img src={`https://image.tmdb.org/t/p/w500${tmdbDetails.images.logos[0].file_path}`} alt="Anime Logo" style={{maxHeight: '120px', maxWidth: '350px', objectFit: 'contain', marginBottom: '1rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'}} />
               ) : (
                 <h1 className="details-main-title">{anime.title.english || anime.title.romaji}</h1>
               )}
               {anime.title.romaji && anime.title.english && (
                 <h2 className="details-sub-title">{anime.title.romaji}</h2>
               )}
               
               {anime.genres && anime.genres.length > 0 && (
                 <div className="details-genres">
                   {anime.genres.map(g => (
                     <span key={g} className="details-genre-pill">{g}</span>
                   ))}
                 </div>
               )}
               
               <div className="details-description">
                 <p>{(anime.description || '').replace(/<[^>]*>?/gm, '')}</p>
               </div>
               
               <div className="details-meta-grid">
                  <div className="details-meta-item">
                    <span className="meta-label">Format:</span> <span className="meta-value">{anime.format || 'TV'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Start Date:</span> <span className="meta-value">{anime.startDate ? `${new Date(anime.startDate.year || 0, (anime.startDate.month || 1) - 1, anime.startDate.day || 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Unknown'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Status:</span> <span className="meta-value">{anime.status || 'Unknown'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">End Date:</span> <span className="meta-value">{anime.endDate && anime.endDate.year ? `${new Date(anime.endDate.year || 0, (anime.endDate.month || 1) - 1, anime.endDate.day || 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Unknown'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Episodes:</span> <span className="meta-value">{anime.episodes || '?'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Country:</span> <span className="meta-value">{anime.countryOfOrigin || 'JP'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Rating:</span> <span className="meta-value">{anime.averageScore || '?'} /100</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Adult:</span> <span className="meta-value">{anime.isAdult ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Duration:</span> <span className="meta-value">{anime.duration ? `${anime.duration} min` : '?'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Studios:</span> <span className="meta-value">{anime.studios?.nodes?.[0]?.name || 'Unknown'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Season:</span> <span className="meta-value">{anime.season ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1).toLowerCase() : 'Unknown'}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="meta-label">Official Site:</span> <span className="meta-value">Unknown</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Episodes Panel */}
        <div className="episodes-column">
           <div className="episodes-panel-header">
              <div className="ep-range-box">1 - {episodes.length || 1}</div>
              <div className="ep-search-box">
                 <Search size={14} className="text-muted"/>
                 <input type="text" placeholder="Filter episodes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button className="ep-icon-btn" onClick={() => setHideWatched(!hideWatched)} title="Hide Watched">
                 <Eye size={16} style={{ color: hideWatched ? '#c4b5fd' : '' }}/>
              </button>
              <button className="ep-icon-btn" onClick={() => setIsGridView(!isGridView)} title="Toggle Layout">
                 <LayoutGrid size={16} style={{ color: isGridView ? '#c4b5fd' : '' }}/>
              </button>
           </div>
           
            <div className={`episodes-scroller ${isGridView ? 'grid-mode' : ''}`}>
              {loadingEpisodes ? (
                 <div className="animate-pulse text-muted" style={{ padding: '2rem', textAlign: 'center' }}>Loading episodes...</div>
              ) : filteredEpisodes.length > 0 ? (
                 filteredEpisodes.map(ep => {
                   const tmdbEp = tmdbEpisodes[ep.number];
                   const displayTitle = tmdbEp?.name || ep.title || `Episode ${ep.number}`;
                   const displayDesc = tmdbEp?.overview || ep.description || 'After one hundred years of peace, humanity is suddenly reminded of the terror of being at the Titans\' mercy.';
                   const displayImage = tmdbEp?.still_path || ep.image;
                   const displayDate = tmdbEp?.air_date || 'Unknown Date';

                   return isGridView ? (
                     <div key={ep.id} className={`ep-grid-btn ${selectedEpisode?.id === ep.id ? 'active' : ''}`} onClick={() => setSelectedEpisode(ep)}>
                       {ep.number}
                     </div>
                   ) : (
                     <div key={ep.id} className={`ep-card-item ${selectedEpisode?.id === ep.id ? 'active' : ''}`} onClick={() => setSelectedEpisode(ep)}>
                        <div className="ep-card-thumb">
                          {displayImage ? (
                            <img src={displayImage} alt={`EP ${ep.number}`} loading="lazy" />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
                              <Film size={20} />
                            </div>
                          )}
                          <span className="ep-badge">EP {ep.number}</span>
                        </div>
                        <div className="ep-card-details">
                          <h4 className="ep-card-title">{displayTitle}</h4>
                          <p className="ep-card-desc">{displayDesc}</p>
                          <div className="ep-card-meta">
                            <div className="ep-card-icons">
                              {ep.hasSub !== false ? (
                                <span className="cc-box-sm" style={{background: 'white', color: 'black'}}>CC</span>
                              ) : (
                                <span className="cc-box-sm" style={{opacity: 0.3}}>CC</span>
                              )}
                              
                              {ep.hasDub !== false ? (
                                <Mic size={12} style={{color: 'white'}}/>
                              ) : (
                                <Mic size={12} style={{opacity: 0.3}}/>
                              )}
                            </div>
                            <span className="ep-card-date">{displayDate}</span>
                          </div>
                        </div>
                     </div>
                   );
                 })
              ) : (
                 <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No episodes found.</div>
              )}
            </div>

           {/* Seasons & Related Block (AniList Relations) */}
           {allRelatedAnime.length > 0 && (
             <div className="related-block" style={{marginTop: '1.5rem'}}>
               <h3 className="seasons-heading"><LayoutGrid size={16} style={{marginRight: '8px'}}/> SEASONS & RELATED</h3>
               <div className="related-list">
                  {allRelatedAnime.map((edge: any) => (
                      <Link to={`/watch/${edge.node.id}`} key={edge.node.id} className="related-card">
                        <div className="related-bg-layer" style={{backgroundImage: `url(${edge.node.coverImage?.large || anime.bannerImage})`}}></div>
                        <div className="related-content-layer">
                          <div className="related-thumb">
                            <img src={edge.node.coverImage?.large || anime.coverImage.extraLarge} alt={edge.node.title.english || edge.node.title.romaji} loading="lazy" />
                          </div>
                          <div className="related-info">
                            <h4 className="related-title">
                               <span className="related-bullet" style={{backgroundColor: '#f97316'}}></span>
                               {edge.node.title.english || edge.node.title.romaji}
                            </h4>
                            <div className="related-meta">
                               <span className="related-tag" style={{color: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)'}}>{edge.relationType.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                  ))}
               </div>
             </div>
           )}
           
           {/* Cast Block */}
           {tmdbDetails?.credits?.cast && tmdbDetails.credits.cast.length > 0 && (
             <div className="cast-block" style={{marginTop: '1.5rem'}}>
               <h3 className="seasons-heading"><ChevronRight size={16} style={{marginRight: '8px'}}/> CAST & CHARACTERS</h3>
               <div className="cast-scroller" style={{display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '10px'}}>
                  {tmdbDetails.credits.cast.slice(0, 15).map(actor => (
                     <div key={actor.id} className="cast-card" style={{minWidth: '100px', display: 'flex', flexDirection: 'column', gap: '5px'}}>
                        <img src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : 'https://via.placeholder.com/100x150?text=No+Image'} alt={actor.name} style={{width: '100px', height: '150px', objectFit: 'cover', borderRadius: '8px'}} />
                        <span style={{color: '#fff', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2}}>{actor.name}</span>
                        <span style={{color: '#71717a', fontSize: '0.7rem', lineHeight: 1.1}}>{actor.character}</span>
                     </div>
                  ))}
               </div>
             </div>
           )}
           
           {/* Recommendations Block */}
           {tmdbDetails?.recommendations?.results && tmdbDetails.recommendations.results.length > 0 && (
             <div className="related-block" style={{marginTop: '1.5rem'}}>
               <h3 className="seasons-heading"><ChevronRight size={16} style={{marginRight: '8px'}}/> RECOMMENDATIONS</h3>
               <div className="related-list">
                  {tmdbDetails.recommendations.results.slice(0, 10).map(node => (
                    <div key={node.id} className="related-card">
                       <div className="related-bg-layer" style={{backgroundImage: `url(${node.backdrop_path ? `https://image.tmdb.org/t/p/w780${node.backdrop_path}` : node.poster_path ? `https://image.tmdb.org/t/p/w500${node.poster_path}` : ''})`}}></div>
                       <div className="related-content-layer">
                         <div className="related-thumb">
                           <img src={node.poster_path ? `https://image.tmdb.org/t/p/w342${node.poster_path}` : 'https://via.placeholder.com/150'} alt={node.name} loading="lazy" />
                         </div>
                         <div className="related-info">
                            <h4 className="related-title">
                               <span className="related-bullet" style={{backgroundColor: '#0ea5e9'}}></span>
                               {node.name}
                            </h4>
                            <div className="related-meta">
                               <span className="related-tag" style={{color: '#71717a'}}>★ {node.vote_average ? node.vote_average.toFixed(1) : '?'}</span>
                            </div>
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
             </div>
           )}
        </div>
      </div>
      <style>{`/* General Watch Page Wrapper */
.watch-page-container {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  position: relative;
  min-height: 100vh;
  background-color: #09090b;
}


/* Layout Grid */
.watch-main-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  max-width: 1800px;
  margin: 1.5rem auto 0 auto;
}

@media (min-width: 1024px) {
  .watch-main-layout {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
}
@media (min-width: 1400px) {
  .watch-main-layout {
    grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr);
  }
}

/* ---------------------------------
   LEFT COLUMN: PLAYER & INFO
-----------------------------------*/
.player-column {
  display: flex;
  flex-direction: column;
  gap: 0; /* Tight spacing between player and toolbar */
}

.video-wrapper {
  width: 100%;
  aspect-ratio: 16/9;
  background-color: black;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  border: 1px solid #1a1a1a;
  border-bottom: none;
}

/* Player Toolbar */
.player-bottom-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #0e0e11;
  padding: 0.75rem 1.5rem;
  border: 1px solid #1a1a1a;
  border-radius: 0 0 8px 8px;
  flex-wrap: wrap;
  gap: 1rem;
}

.tb-left, .tb-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: #666;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}

.tb-btn:hover {
  color: #ccc;
}

.tb-btn.active {
  color: #ef4444;
}

.tb-square {
  width: 10px;
  height: 10px;
  background-color: #ef4444;
  border-radius: 2px;
}

/* Episode Meta Box */
.episode-meta-box {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  background-color: #0e0e11;
  border: 1px solid #1f1f22;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1.5rem;
}

.ep-meta-col-left {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.5rem;
  flex: 1;
}

.ep-meta-col-right {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
}

.ep-main-title {
  font-size: 1.35rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  margin: 0;
}

.ep-meta-tags-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ep-pill {
  display: flex;
  align-items: center;
  background-color: #000;
  border: 1px solid #222;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  color: #e5e5e5;
  font-size: 0.8rem;
  font-weight: 600;
}

.cc-box {
  background-color: #a1a1aa;
  color: #000;
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 900;
}
.cc-box-sm {
  background-color: #777;
  color: #000;
  font-size: 0.55rem;
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: 900;
}

.ep-dropdowns-container {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
}

.ep-dropdown-labels {
  display: flex;
  width: 100%;
}

.ep-dropdown-labels .controls-label {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  padding-left: 0.5rem;
  color: #71717a;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  gap: 0.3rem;
  align-items: center;
}

.ep-joined-dropdowns {
  display: flex;
  align-items: center;
  background-color: #000;
  border: 1px solid #222;
  border-radius: 8px;
}

.dropdown-wrapper {
  position: relative;
}

.dropdown-wrapper:first-child .ep-joined-btn {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.dropdown-wrapper:last-child .ep-joined-btn {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.custom-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background-color: #0e0e11;
  border: 1px solid #27272a;
  border-radius: 8px;
  min-width: 150px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  z-index: 100;
  box-shadow: 0 10px 25px rgba(0,0,0,0.8);
}
.custom-dropdown-right {
  left: auto;
  right: 0;
  min-width: 280px;
  max-height: 350px;
  overflow-y: auto;
}

.dropdown-header {
  font-size: 0.7rem;
  color: #71717a;
  font-weight: 700;
  padding: 0.4rem 0.5rem;
  text-transform: uppercase;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  color: #e5e5e5;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}
.dropdown-item:hover {
  background-color: #1a1a1e;
}
.dropdown-item.active {
  background-color: #c4b5fd;
  color: #000;
}
.dropdown-item.active .server-badge {
  background-color: rgba(0,0,0,0.5) !important;
  color: #fff !important;
}

.flat-server-item {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background-color: transparent !important;
}
.flat-server-item:hover {
  background-color: #1a1a1e !important;
}
.flat-server-item.active {
  background-color: transparent !important;
  color: #fb923c !important;
}
.flat-server-item.active .server-badge {
  /* don't override outline styles */
  background-color: inherit;
}

.ep-joined-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: #e5e5e5;
  padding: 0.5rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}
.ep-joined-btn:hover {
  background-color: #1a1a1e;
}

.ep-divider {
  width: 1px;
  height: 20px;
  background-color: #222;
}

.ep-actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ep-action-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background-color: #000;
  border: 1px solid #222;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  color: #e5e5e5;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.ep-action-btn:hover {
  background-color: #1a1a1e;
}

/* ---------------------------------
   RIGHT COLUMN: EPISODES PANEL
-----------------------------------*/
.episodes-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Header toolbar for episodes */
.episodes-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: #0e0e11;
  padding: 0.75rem 0;
  border-radius: 8px;
  margin-bottom: 0.25rem;
}

.ep-range-box {
  background-color: transparent;
  border: 1px solid #333;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #e5e5e5;
}

.ep-search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: transparent;
  border: 1px solid #333;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
}
.ep-search-box input {
  background: none;
  border: none;
  color: #d4d4d8;
  outline: none;
  font-size: 0.85rem;
  width: 100%;
}

.ep-icon-btn {
  background-color: transparent;
  border: 1px solid #333;
  padding: 0.5rem;
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.ep-icon-btn:hover {
  background-color: #27272a;
  color: #fff;
}

/* The List Scroller */
.episodes-scroller {
  background-color: #0e0e11;
  border: 1px solid #1f1f22;
  border-radius: 8px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-height: 415px;
  overflow-y: auto;
}

.episodes-scroller.grid-mode {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
  align-content: start;
}

.ep-grid-btn {
  background-color: #1a1a1e;
  border: 1px solid #27272a;
  color: #a1a1aa;
  padding: 0.5rem;
  border-radius: 6px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.ep-grid-btn:hover {
  background-color: #27272a;
  color: #fff;
}
.ep-grid-btn.active {
  background-color: #fdba74;
  color: #000;
  border-color: #fdba74;
}

/* Scrollbar styling for episodes list */
.episodes-scroller::-webkit-scrollbar {
  width: 12px;
}
.episodes-scroller::-webkit-scrollbar-track {
  background: #111;
  border-radius: 8px;
  margin: 0.5rem 0;
}
.episodes-scroller::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 8px;
  border: 3px solid #111;
}

/* Episode Card Item */
.ep-card-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.4rem;
  border-radius: 8px;
  background-color: #1a1a1e;
  border: 1px solid #27272a;
  cursor: pointer;
  transition: all 0.2s;
}

.ep-card-item:hover {
  background-color: #27272a;
}

.ep-card-item.active {
  background-color: #c4b5fd; /* Soft pastel purple */
  border-color: #c4b5fd;
}

.ep-card-thumb {
  position: relative;
  width: 120px;
  min-width: 120px;
  height: 68px;
  border-radius: 6px;
  overflow: hidden;
  background-color: #111;
}

.ep-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.9;
}

.ep-card-item.active .ep-card-thumb img {
  opacity: 1;
}

.ep-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  color: white;
}

.ep-card-item.active .ep-badge {
  background-color: rgba(0,0,0,0.5);
}

.ep-card-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: hidden;
  padding-right: 0.5rem;
}

.ep-card-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e5e5e5;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ep-card-item.active .ep-card-title {
  color: #fff;
}

.ep-card-desc {
  font-size: 0.75rem;
  color: #71717a;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.4rem;
}

.ep-card-item.active .ep-card-desc {
  color: rgba(255,255,255,0.8);
}

.ep-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.ep-card-icons {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ep-card-item.active .cc-box-sm {
  background-color: rgba(255,255,255,0.8);
  color: #000;
}
.ep-card-item.active .ep-card-icons svg {
  color: #fff !important;
}

.ep-card-date {
  font-size: 0.7rem;
  color: #71717a;
  font-weight: 500;
}

.ep-card-item.active .ep-card-date {
  color: rgba(255,255,255,0.9);
}

/* Seasons Section */
.seasons-block {
  background-color: #0e0e11;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 1.25rem;
}

.seasons-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: #e5e5e5;
  letter-spacing: 0.5px;
  margin-bottom: 1rem;
}

.seasons-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.season-card-item {
  position: relative;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid transparent;
}

.season-card-item.active {
  border-color: #ef4444;
}

.season-bg {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.season-card-item:hover .season-bg {
  opacity: 0.6;
}

.season-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.season-card-item.active .season-overlay {
  color: #ef4444;
}

/* ---------------------------------
   ANIME DETAILS BOX
-----------------------------------*/
.anime-details-box {
  display: flex;
  gap: 1.5rem;
  margin-top: 1.5rem;
  background-color: #0e0e11;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 1.5rem;
}

.details-poster-col {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.details-poster-wrapper {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  aspect-ratio: 2/3;
}

.details-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.details-poster-actions {
  display: flex;
  gap: 0.5rem;
}

.details-action-btn {
  background-color: #1a1a1e;
  border: 1px solid #27272a;
  color: #fff;
  border-radius: 6px;
  padding: 0.5rem;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}
.trailer-btn {
  flex: 1;
}
.add-btn {
  width: 40px;
  font-size: 1.2rem;
  line-height: 1;
}

.details-poster-links {
  display: flex;
  gap: 0.5rem;
}
.details-link-btn {
  flex: 1;
  background-color: #1a1a1e;
  border: 1px solid #27272a;
  color: #fff;
  border-radius: 6px;
  padding: 0.5rem;
  font-weight: 800;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: background-color 0.2s;
}
.details-action-btn:hover, .details-link-btn:hover {
  background-color: #27272a;
}

.details-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.details-main-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
  margin-bottom: 0.2rem;
}
.details-sub-title {
  font-size: 0.95rem;
  color: #a1a1aa;
  font-style: italic;
  font-weight: 400;
  margin: 0;
  margin-bottom: 1rem;
}

.details-genres {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.details-genre-pill {
  background-color: #f59e0b;
  color: #000;
  padding: 0.25rem 0.75rem;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 700;
}

.details-description {
  background-color: #111;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}
.details-description p {
  color: #a1a1aa;
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0;
}

.details-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.details-meta-item {
  display: flex;
  font-size: 0.9rem;
}
.meta-label {
  color: #71717a;
  width: 90px;
  flex-shrink: 0;
}
.meta-value {
  color: #e5e5e5;
  font-weight: 600;
}

.server-badge {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.badge-dl {
  background-color: rgba(74, 222, 128, 0.08) !important;
  color: #4ade80 !important;
  border: 1px solid rgba(74, 222, 128, 0.3);
}
.badge-emb {
  background-color: rgba(161, 161, 170, 0.08) !important;
  color: #a1a1aa !important;
  border: 1px solid rgba(161, 161, 170, 0.3);
}
.badge-ssub {
  background-color: rgba(96, 165, 250, 0.08) !important;
  color: #93c5fd !important;
  border: 1px solid rgba(96, 165, 250, 0.3);
}
.badge-hsub {
  background-color: rgba(248, 113, 113, 0.08) !important;
  color: #fca5a5 !important;
  border: 1px solid rgba(248, 113, 113, 0.3);
}
/* ---------------------------------
   RELATED ANIME BLOCK
-----------------------------------*/
.related-block {
  margin-top: 1.5rem;
  background-color: #0e0e11;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
}
.related-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.related-card {
  position: relative;
  display: flex;
  background-color: #111;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  height: 110px;
  border: 1px solid transparent;
}
.related-card:hover {
  border-color: #27272a;
}
.related-card:hover .related-bg-layer {
  opacity: 0.35;
}

.related-bg-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center 25%;
  opacity: 0.2;
  transition: opacity 0.3s;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 20%, black 50%);
  background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%);
}

/* Cast Block Styles */
.cast-block {
  margin-top: 1.5rem;
}
.cast-scroller::-webkit-scrollbar {
  height: 6px;
}
.cast-scroller::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
.cast-card {
  transition: transform 0.2s ease;
  cursor: pointer;
}
.cast-card:hover {
  transform: translateY(-4px);
}

.related-content-layer {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
}

.related-thumb {
  width: 85px;
  flex-shrink: 0;
  padding: 0.4rem;
}
.related-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.related-info {
  flex: 1;
  padding: 0.6rem 0.8rem 0.6rem 0.2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}
.related-title {
  color: #fff;
  font-size: 1.05rem;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  margin: 0;
}
.related-bullet {
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}
.related-meta {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: #71717a;
  gap: 0.8rem;
}
.related-tag {
  background-color: rgba(255, 255, 255, 0.06);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #a1a1aa;
}
`}</style>

    </div>
  );
}
