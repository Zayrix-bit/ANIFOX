const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '85c0c9c03af878253af71c2ef787eb32';

export interface TmdbEpisode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
}

export const getTmdbData = async (query: string, startDate?: { year?: number, month?: number, day?: number }): Promise<{ episodes: Record<number, TmdbEpisode>, details: any | null }> => {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API Key is missing. Skipping TMDB fetch.');
    return { episodes: {}, details: null };
  }

  try {
    // Clean the query: remove "Season X", "Part X", "Cour X", "2nd Season", etc.
    let cleanQuery = query.replace(/\s*(Season|Part|Cour)\s*\d+/i, '');
    cleanQuery = cleanQuery.replace(/\s*\d+(st|nd|rd|th)\s*Season/i, '');
    cleanQuery = cleanQuery.replace(/\s*-\s*$/, '').trim();

    // 1. Search for the TV show
    const searchRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}`);
    if (!searchRes.ok) return { episodes: {}, details: null };
    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) return { episodes: {}, details: null };
    const tvId = searchData.results[0].id;

    // 2. Fetch TV show details to get seasons and appended metadata
    const detailsRes = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&append_to_response=recommendations,similar,credits,images&include_image_language=en,ja,null`);
    if (!detailsRes.ok) return { episodes: {}, details: null };
    const detailsData = await detailsRes.json();

    const seasons = detailsData.seasons || [];
    const episodeMap: Record<number, TmdbEpisode> = {};

    // 3. Fetch each season and flatten episodes
    const seasonPromises = seasons
      .filter((s: any) => s.season_number > 0) // Skip specials
      .map((s: any) => fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${s.season_number}?api_key=${TMDB_API_KEY}`).then(res => res.json()));

    const seasonDataArray = await Promise.all(seasonPromises);
    
    // Flatten all episodes chronologically
    let allTmdbEpisodes: any[] = [];
    for (const seasonData of seasonDataArray) {
      if (seasonData.episodes) {
          allTmdbEpisodes = allTmdbEpisodes.concat(seasonData.episodes);
      }
    }
    
    // Sort chronologically (just in case)
    allTmdbEpisodes.sort((a, b) => new Date(a.air_date || '2099-01-01').getTime() - new Date(b.air_date || '2099-01-01').getTime());
    
    let offsetIndex = 0;

    if (startDate && startDate.year) {
        const startMonth = startDate.month ? startDate.month.toString().padStart(2, '0') : '01';
        const startDay = startDate.day ? startDate.day.toString().padStart(2, '0') : '01';
        const aniStartDateStr = `${startDate.year}-${startMonth}-${startDay}`;
        const aniStartDate = new Date(aniStartDateStr).getTime();
        
        // If we have month/day, 14 days margin. If just year, 365 days margin.
        const margin = startDate.month ? (14 * 24 * 60 * 60 * 1000) : (365 * 24 * 60 * 60 * 1000);
        
        const matchIndex = allTmdbEpisodes.findIndex(ep => {
            if (!ep.air_date) return false;
            const epDate = new Date(ep.air_date).getTime();
            return Math.abs(epDate - aniStartDate) <= margin;
        });
        
        if (matchIndex !== -1) {
            offsetIndex = matchIndex;
        } else {
            // Fallback to regex on season number
            const seasonMatch = query.match(/Season\s*(\d+)/i) || query.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
            const targetSeason = seasonMatch ? parseInt(seasonMatch[1]) : 1;
            const seasonFirstEpIndex = allTmdbEpisodes.findIndex(ep => ep.season_number === targetSeason);
            if (seasonFirstEpIndex !== -1) offsetIndex = seasonFirstEpIndex;
        }
    } else {
        const seasonMatch = query.match(/Season\s*(\d+)/i) || query.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
        const targetSeason = seasonMatch ? parseInt(seasonMatch[1]) : 1;
        const seasonFirstEpIndex = allTmdbEpisodes.findIndex(ep => ep.season_number === targetSeason);
        if (seasonFirstEpIndex !== -1) offsetIndex = seasonFirstEpIndex;
    }

    // Map episodes starting from offsetIndex as relative episode 1, 2, 3...
    for (let i = 0; i < allTmdbEpisodes.length - offsetIndex; i++) {
        const ep = allTmdbEpisodes[offsetIndex + i];
        episodeMap[i + 1] = {
            episode_number: i + 1,
            name: ep.name,
            overview: ep.overview,
            still_path: ep.still_path ? `https://image.tmdb.org/t/p/w780${ep.still_path}` : null,
            air_date: ep.air_date
        };
    }

    return { episodes: episodeMap, details: detailsData };

  } catch (err) {
    console.error('Failed to fetch TMDB data:', err);
    return { episodes: {}, details: null };
  }
};

