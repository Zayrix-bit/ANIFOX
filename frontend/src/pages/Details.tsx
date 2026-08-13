import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnimeDetails } from '../lib/anilist';
import { getTmdbData } from '../lib/tmdb';
import { getEpisodes } from '../lib/anifox';
import { Play, Star, PlayCircle } from 'lucide-react';
import { AnimeDetails } from '../types/anifox';

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [tmdbDetails, setTmdbDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioMode, setAudioMode] = useState('sub');
  const [preloadedEpisodes, setPreloadedEpisodes] = useState<any[] | null>(null);

  useEffect(() => {
    if (id) {
      // Prefetch episodes in the background for a faster transition to the Watch page
      getEpisodes('anikoto', id)
        .then(eps => setPreloadedEpisodes(eps))
        .catch(() => {}); // Silent fail, Watch page will retry if needed

      getAnimeDetails(id).then(async (data) => {
        setAnime(data);
        const tmdbRes = await getTmdbData(data.title.english || data.title.romaji || '');
        if (tmdbRes.details) {
          setTmdbDetails(tmdbRes.details);
        }
      }).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        <h2 className="animate-pulse text-muted">Loading Anime Details...</h2>
      </div>
    );
  }

  if (!anime) return <div>Anime not found</div>;

  const totalEpisodesCount = anime.nextAiringEpisode 
    ? anime.nextAiringEpisode.episode - 1 
    : (anime.episodes || 12); 

  const episodeNumbers = Array.from({ length: totalEpisodesCount }, (_, i) => i + 1);

  return (
    <div className="details-page">
      {/* Banner & Hero Info */}
      <div className="details-hero">
        <div 
          className="hero-banner-bg" 
          style={{ backgroundImage: `url(${tmdbDetails?.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbDetails.backdrop_path}` : anime.bannerImage || anime.coverImage.extraLarge})` }}
        ></div>
        <div className="hero-gradient"></div>
        
        <div className="container hero-content-layout">
          <div className="poster-container">
            <img 
              src={anime.coverImage.extraLarge} 
              alt={anime.title.romaji} 
              className="poster-img"
            />
          </div>
          
          <div className="info-container">
            {tmdbDetails?.images?.logos && tmdbDetails.images.logos.length > 0 ? (
               <img src={`https://image.tmdb.org/t/p/w500${tmdbDetails.images.logos[0].file_path}`} alt="Anime Logo" className="hero-anime-logo-details" style={{maxHeight: '120px', maxWidth: '400px', objectFit: 'contain', objectPosition: 'left', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))', marginBottom: '1rem'}} />
            ) : (
               <h1 className="anime-title">{anime.title.english || anime.title.romaji}</h1>
            )}
            <p className="anime-subtitle">{anime.title.native} &bull; {anime.title.romaji}</p>
            
            <div className="meta-badges">
              <span className="meta-badge score"><Star size={14} fill="currentColor" /> {(anime.averageScore ? anime.averageScore / 10 : 0).toFixed(1)}</span>
              <span className="meta-badge">{anime.status}</span>
              <span className="meta-badge">{anime.format || 'TV'}</span>
              <span className="meta-badge">{anime.duration ? `${anime.duration}m` : '?'}</span>
              <span className="meta-badge">{totalEpisodesCount} EPS</span>
            </div>

            <p className="anime-description" dangerouslySetInnerHTML={{ __html: anime.description || '' }} />

            <div className="action-buttons">
            <button 
              className="watch-btn btn-primary"
              onClick={() => navigate(`/watch/${id}?ep=1&audio=${audioMode}`, { state: { anime, tmdbDetails, audioMode, preloadedEpisodes } })}
            >
              <Play fill="currentColor" size={20} /> Watch Episode 1
            </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container details-main-content">
        {/* Left Side: Additional Info */}
        <aside className="sidebar-info">
          <div className="info-block">
            <h4>Studios</h4>
            <p>{anime.studios?.nodes?.map(s => s.name).join(', ') || 'N/A'}</p>
          </div>
          <div className="info-block">
            <h4>Producers</h4>
            <p>{anime.producers?.nodes?.map(s => s.name).join(', ') || 'N/A'}</p>
          </div>
          <div className="info-block">
            <h4>Aired</h4>
            <p>{anime.startDate?.year ? `${anime.startDate.year}-${anime.startDate.month}-${anime.startDate.day}` : 'N/A'}</p>
          </div>
          <div className="info-block">
            <h4>Season</h4>
            <p>{anime.season || 'N/A'} {anime.seasonYear || ''}</p>
          </div>
          
          <div className="genres-block">
            <h4>Genres</h4>
            <div className="genres-list">
              {anime.genres?.map(g => (
                <span key={g} className="genre-tag">{g}</span>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Episodes Grid */}
        <main className="episodes-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <PlayCircle className="text-primary" size={24} /> 
              All Episodes ({totalEpisodesCount})
            </h2>
            <div className="audio-toggle">
              <button className={audioMode === 'sub' ? 'active' : ''} onClick={() => setAudioMode('sub')}>SUB</button>
              <button className={audioMode === 'dub' ? 'active' : ''} onClick={() => setAudioMode('dub')}>DUB</button>
            </div>
          </div>
          
          <div className="episodes-grid">
            {episodeNumbers.map(num => (
              <button
                key={num}
                onClick={() => navigate(`/watch/${id}?ep=${num}&audio=${audioMode}`, { state: { anime, tmdbDetails, audioMode, preloadedEpisodes } })}
                className="ep-btn"
              >
                {num}
              </button>
            ))}
          </div>
        </main>
      </div>
      <style>{`
        .details-page { min-height: 100vh; padding-bottom: 4rem; }
        .details-hero { position: relative; min-height: 50vh; padding-bottom: 2rem; display: flex; align-items: flex-end; }
        .hero-banner-bg { position: absolute; inset: 0; background-size: cover; background-position: center 30%; opacity: 0.3; z-index: -1; }
        .hero-gradient { position: absolute; inset: 0; background: linear-gradient(0deg, var(--bg-main) 10%, rgba(9, 9, 11, 0.4) 100%); z-index: 0; }
        .hero-content-layout { position: relative; z-index: 1; display: flex; gap: 2.5rem; align-items: flex-end; width: 100%; }
        @media (max-width: 768px) { .hero-content-layout { flex-direction: column; align-items: center; text-align: center; } }
        .poster-container { flex-shrink: 0; }
        .poster-img { width: 220px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--radius-lg); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); border: 1px solid var(--border); }
        .info-container { flex: 1; padding-bottom: 1rem; }
        .anime-title { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 0.5rem; }
        .anime-subtitle { color: var(--text-muted); font-size: 1rem; margin-bottom: 1.5rem; font-style: italic; }
        .meta-badges { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem; }
        @media (max-width: 768px) { .meta-badges { justify-content: center; } }
        .meta-badge { background-color: var(--bg-hover); padding: 0.25rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; color: var(--text-muted); border: 1px solid var(--border); display: flex; align-items: center; gap: 0.25rem; }
        .meta-badge.score { background-color: var(--primary); color: white; border-color: var(--primary); }
        .anime-description { color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; max-width: 800px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 2rem; }
        .action-buttons { display: flex; gap: 1rem; }
        @media (max-width: 768px) { .action-buttons { justify-content: center; } }
        .watch-btn { padding: 0.75rem 2rem; font-size: 1rem; border-radius: 99px; font-weight: 700; }
        .details-main-content { margin-top: 3rem; display: grid; grid-template-columns: 1fr; gap: 2rem; }
        @media (min-width: 1024px) { .details-main-content { grid-template-columns: 250px 1fr; } }
        .sidebar-info { background-color: var(--bg-card); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); height: fit-content; }
        .info-block { margin-bottom: 1.5rem; }
        .info-block h4 { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem; }
        .info-block p { font-size: 0.9rem; color: var(--text-main); font-weight: 500; }
        .genres-block h4 { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.75rem; }
        .genres-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .genre-tag { background-color: var(--bg-hover); color: var(--text-main); padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.8rem; font-weight: 500; }
        .episodes-section { padding: 1.5rem; background-color: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border); }
        .section-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1.25rem; }
        .text-primary { color: var(--primary); }
        
        .audio-toggle { display: flex; background-color: var(--bg-hover); border-radius: var(--radius-sm); border: 1px solid var(--border); overflow: hidden; }
        .audio-toggle button { background: transparent; color: var(--text-muted); border: none; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 700; transition: all 0.2s; cursor: pointer; }
        .audio-toggle button:hover { color: var(--text-main); }
        .audio-toggle button.active { background-color: var(--primary); color: white; }

        .episodes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.75rem; }
        .ep-btn { background-color: var(--bg-hover); border: 1px solid var(--border); color: var(--text-main); padding: 0.75rem 0; border-radius: var(--radius-sm); font-weight: 600; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .ep-btn:hover { background-color: var(--primary); color: white; border-color: var(--primary); transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
