import { Episode, StreamData } from '../types/anifox';

const API_URL = 'http://localhost:4000';

export const getProviders = async (): Promise<string[]> => {
  try {
    // Fetch from an unmatched route to trigger the worker's JSON fallback response
    // instead of the root '/' which serves the HTML landing page.
    const res = await fetch(`${API_URL}/info`);
    const data = await res.json();
    return data.providers || [
      "mkissa", "reanime", "anizone", "animegg", "anikoto", "anineko", 
      "2dhive", "animedunya", "anidbapp"
    ];
  } catch (err) {
    console.error('Failed to fetch providers', err);
    return ["mkissa", "reanime", "anizone", "animegg", "anikoto", "anineko", "2dhive", "animedunya", "anidbapp"];
  }
};

export const getEpisodes = async (provider: string, anilistId: string | number): Promise<Episode[]> => {
  const res = await fetch(`${API_URL}/episodes/${provider}/${anilistId}`);
  if (!res.ok) throw new Error('Failed to fetch episodes');
  const data = await res.json();
  
  if (data.error) throw new Error(data.error);
  
  const providerData = data[provider];
  if (!providerData || !providerData.episodes) {
    throw new Error('No episodes found for this provider');
  }
  
  // Map episodes to include availability flags
  const subEps = providerData.episodes.sub || [];
  const dubEps = providerData.episodes.dub || [];
  
  // Create sets of episode numbers for fast lookup
  const subEpNumbers = new Set(subEps.map((e: any) => e.number));
  const dubEpNumbers = new Set(dubEps.map((e: any) => e.number));
  
  // Return sub episodes by default, or dub if sub doesn't exist
  const baseEpisodes = subEps.length ? subEps : dubEps;
  
  return baseEpisodes.map((ep: any) => ({
    ...ep,
    hasSub: subEpNumbers.has(ep.number),
    hasDub: dubEpNumbers.has(ep.number)
  }));
};

// Cache for stream links to prevent rate limiting (expires after 30 mins)
const streamCache = new Map<string, { data: StreamData, timestamp: number }>();

export const getStream = async (watchId: string, customSignal?: AbortSignal): Promise<StreamData> => {
  // watchId is something like: watch/reanime/16498/sub/reanime-1
  // our API handles it natively via the endpoint
  
  const cached = streamCache.get(watchId);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return cached.data;
  }
  
  // Add a 10-second timeout so a slow provider doesn't block the entire queue
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  if (customSignal) {
    customSignal.addEventListener('abort', () => controller.abort());
  }
  
  try {
    const res = await fetch(`${API_URL}/${watchId}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error('Failed to fetch stream');
    const data = await res.json();
    if (data.error) throw new Error(data.error);

  // Deep fix: Proxy the HLS streams to bypass CORS entirely
  if (data.stream_url) {
    let proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(data.stream_url)}`;
    if (data.headers?.Referer) {
      proxyUrl += `&referer=${encodeURIComponent(data.headers.Referer)}`;
    }
    data.stream_url = proxyUrl;
  }
  // Proxy global subtitles
  if (data.subtitles) {
    data.subtitles = data.subtitles.map((sub: any) => {
       const url = sub.url || sub.file;
       if (url && url.startsWith('http')) {
           let proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(url)}`;
           if (data.headers?.Referer) {
               proxyUrl += `&referer=${encodeURIComponent(data.headers.Referer)}`;
           }
           return { ...sub, url: proxyUrl };
       }
       return sub;
    });
  }

  if (data.streams) {
    data.streams = data.streams.map((s: any) => {
      let ref = s.referer || s.headers?.Referer || data.headers?.Referer;
      
      if (s.type === 'hls' || s.type === 'hls-redirect') {
        let proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(s.url)}`;
        if (ref) {
          proxyUrl += `&referer=${encodeURIComponent(ref)}`;
        }
        s.url = proxyUrl;
      }
      
      // Proxy stream-specific subtitles
      if (s.subtitles) {
         s.subtitles = s.subtitles.map((sub: any) => {
            const url = sub.url || sub.file;
            if (url && url.startsWith('http')) {
                let proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(url)}`;
                if (ref) {
                    proxyUrl += `&referer=${encodeURIComponent(ref)}`;
                }
                return { ...sub, url: proxyUrl };
            }
            return sub;
         });
      }
      
      return s;
    });
  }
  
  streamCache.set(watchId, { data, timestamp: Date.now() });
  return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
