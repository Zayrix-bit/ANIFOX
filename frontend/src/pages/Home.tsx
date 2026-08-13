import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTrendingAnime } from '../lib/anilist';
import { Play, Star, ChevronLeft, ChevronRight, Calendar, Tv, Anchor, Plus, Mic, Flame } from 'lucide-react';
import { AnimeDetails } from '../types/anifox';
import { getTmdbData } from '../lib/tmdb';

export default function Home() {
  const [trending, setTrending] = useState<AnimeDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroList, setHeroList] = useState<AnimeDetails[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroAnime, setHeroAnime] = useState<AnimeDetails | null>(null);
  const [tmdbHeroData, setTmdbHeroData] = useState<any | null>(null);

  useEffect(() => {
    getTrendingAnime()
      .then(async data => {
        setTrending(data);
        if (data.length > 0) {
          const top6 = data.slice(0, 6);
          setHeroList(top6);
        }
        setLoading(false);
      })
      .catch(console.error);
      

  }, []);

  // Fetch TMDB data when heroIndex changes
  useEffect(() => {
    if (heroList.length > 0) {
       const currentAnime = heroList[heroIndex];
       setHeroAnime(currentAnime);
       setTmdbHeroData(null); // Clear previous to prevent layout jump with old image
       getTmdbData(currentAnime.title.english || currentAnime.title.romaji || '', currentAnime.startDate || { year: currentAnime.seasonYear }).then(tmdbRes => {
          if (tmdbRes.details) setTmdbHeroData(tmdbRes.details);
       });
    }
  }, [heroIndex, heroList]);

  // Auto-slide hero
  useEffect(() => {
    if (heroList.length === 0) return;
    const interval = setInterval(() => {
       setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [heroList]);

  const handlePrevHero = () => setHeroIndex(prev => prev === 0 ? heroList.length - 1 : prev - 1);
  const handleNextHero = () => setHeroIndex(prev => (prev + 1) % heroList.length);

  return (
    <div className="home-page">
      {/* Hero Section */}
      {!loading && heroAnime && (
        <div className="hero-banner">
          <div className="hero-backdrop" style={{ backgroundImage: `url(${tmdbHeroData?.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbHeroData.backdrop_path}` : heroAnime.bannerImage || heroAnime.coverImage.extraLarge})` }}>
            <div className="hero-overlay"></div>
          </div>
          <div className="container hero-content">
            <div className="hero-content-inner">
              <div className="hero-top-badge">
                <span className="hero-rank-badge">#1</span> Top Airing This Week
              </div>
              
              {tmdbHeroData?.images?.logos && tmdbHeroData.images.logos.length > 0 ? (
                 <img src={`https://image.tmdb.org/t/p/w500${tmdbHeroData.images.logos[0].file_path}`} alt="Anime Logo" className="hero-anime-logo-home" style={{maxHeight: '160px', maxWidth: '500px', objectFit: 'contain', objectPosition: 'left', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))', marginBottom: '1.5rem'}} />
              ) : (
                 <h1 className="hero-title">{heroAnime.title.english || heroAnime.title.romaji}</h1>
              )}
              
              <div className="hero-actions">
                <Link to={`/watch/${heroAnime.id}`} className="btn btn-primary hero-btn">
                  <Play size={18} fill="currentColor" /> Play Now
                </Link>
                <button className="btn btn-outline hero-btn">
                  <Plus size={18} /> Add to List
                </button>
              </div>

              <p className="hero-description" dangerouslySetInnerHTML={{ __html: heroAnime.description || '' }}></p>
              
              <div className="hero-meta-boxes">
                <div className="meta-box">
                   <div className="meta-box-icon"><Star size={16} fill="#fbbf24" color="#fbbf24" /></div>
                   <div className="meta-box-text">
                      <span className="meta-box-val">{(heroAnime.averageScore ? heroAnime.averageScore / 10 : 0).toFixed(1)}</span>
                      <span className="meta-box-lbl">Rating</span>
                   </div>
                </div>
                <div className="meta-box">
                   <div className="meta-box-icon"><Calendar size={16} color="#a1a1aa" /></div>
                   <div className="meta-box-text">
                      <span className="meta-box-val">{heroAnime.seasonYear || '2024'}</span>
                      <span className="meta-box-lbl">Year</span>
                   </div>
                </div>
                <div className="meta-box">
                   <div className="meta-box-icon"><Tv size={16} color="#a1a1aa" /></div>
                   <div className="meta-box-text">
                      <span className="meta-box-val">{heroAnime.format}</span>
                      <span className="meta-box-lbl">Type</span>
                   </div>
                </div>
                <div className="meta-box">
                   <div className="meta-box-icon"><Anchor size={16} color="#a1a1aa" /></div>
                   <div className="meta-box-text">
                      <span className="meta-box-val">{heroAnime.episodes || '?'}</span>
                      <span className="meta-box-lbl">Episodes</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pagination Controls */}
          {heroList.length > 1 && (
             <>
             <div className="hero-pagination-dots">
                {heroList.map((_, i) => (
                   <div key={i} className={`hero-dot ${i === heroIndex ? 'active' : ''}`} onClick={() => setHeroIndex(i)}></div>
                ))}
             </div>
             <div className="hero-pagination-arrows">
                <button className="hero-page-arrow" onClick={handlePrevHero}><ChevronLeft size={24} /></button>
                <button className="hero-page-arrow" onClick={handleNextHero}><ChevronRight size={24} /></button>
             </div>
             </>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="container main-content-layout">
        <div className="main-feed">
          <div className="section-header">
            <h2><span style={{marginRight: '8px', color: '#f97316'}}><Flame size={20} /></span> Trending Now</h2>
            <Link to="/trending" className="view-all-link">View all <ChevronRight size={16} /></Link>
          </div>
          
          <div className="anime-grid">
            {loading ? (
              [...Array(12)].map((_, i) => <div key={i} className="anime-card skeleton"></div>)
            ) : (
              trending.map((anime) => (
                <Link key={anime.id} to={`/anime/${anime.id}`} className="anixo-card">
                  <div className="anixo-card-image-wrapper">
                    <img src={anime.coverImage.large} alt={anime.title.romaji} loading="lazy" />
                    <div className="anixo-card-overlay">
                       <div className="anixo-card-top">
                          <span className="anixo-badge dark-badge">E {anime.episodes || '?'}</span>
                          <span className="anixo-badge purple-badge"><Star size={12} fill="currentColor" /> {(anime.averageScore ? anime.averageScore / 10 : 0).toFixed(1)}</span>
                       </div>
                       <div className="anixo-card-bottom">
                          <h3 className="anixo-card-title">{anime.title.english || anime.title.romaji}</h3>
                          <div className="anixo-card-sub" style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                             <span style={{background: 'white', color: 'black', fontSize: '9px', padding: '0px 3px', borderRadius: '2px', fontWeight: 'bold', display: 'flex', alignItems: 'center', letterSpacing: '0.5px'}}>CC</span>
                             <Mic size={12} style={{color: 'white'}}/>
                          </div>
                       </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>



        </div>
      </div>
      <style>{`
        .home-page { padding-bottom: 4rem; }
        .hero-banner { position: relative; min-height: 80vh; margin-bottom: 3rem; display: flex; align-items: flex-end; padding-bottom: 5rem; }
        .hero-backdrop { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-size: cover; background-position: center 20%; z-index: -1; }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(11, 10, 21, 1) 0%, rgba(11, 10, 21, 0.6) 50%, rgba(11, 10, 21, 0.1) 100%), linear-gradient(to top, rgba(11, 10, 21, 1) 0%, rgba(11, 10, 21, 0) 40%); }
        .hero-content { position: relative; z-index: 1; width: 100%; }
        .hero-content-inner { max-width: 600px; }
        
        .hero-top-badge { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.85rem; font-weight: 500; margin-bottom: 1rem; }
        .hero-rank-badge { background-color: #431407; color: #fdba74; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem; }
        
        .hero-title { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 900; line-height: 1; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: -1px; text-shadow: 0 4px 12px rgba(0,0,0,0.5); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .hero-actions { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .hero-btn { padding: 0.8rem 1.8rem; font-size: 1rem; border-radius: 99px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
        .btn-outline { background: transparent; border: 2px solid rgba(255, 255, 255, 0.2); color: white; }
        .btn-outline:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.4); }
        
        .hero-description { font-size: 0.95rem; color: #a1a1aa; margin-bottom: 2rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; }
        
        .hero-meta-boxes { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
        .meta-box { background-color: #171526; border: 1px solid #431407; border-radius: 12px; padding: 0.6rem 1rem; display: flex; align-items: center; gap: 0.75rem; min-width: 110px; }
        .meta-box-icon { display: flex; align-items: center; justify-content: center; }
        .meta-box-text { display: flex; flex-direction: column; }
        .meta-box-val { font-size: 0.9rem; font-weight: 700; color: #fff; line-height: 1.2; }
        .meta-box-lbl { font-size: 0.7rem; font-weight: 500; color: #8a8898; text-transform: uppercase; }

        .hero-pagination-dots { position: absolute; bottom: 2.5rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; z-index: 10; }
        .hero-dot { width: 12px; height: 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.2); cursor: pointer; transition: all 0.3s; }
        .hero-dot.active { width: 24px; background: var(--primary); }
        
        .hero-pagination-arrows { position: absolute; bottom: 2.5rem; right: 2rem; display: flex; gap: 0.5rem; z-index: 10; }
        .hero-page-arrow { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .hero-page-arrow:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
        
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .section-header h2 { font-size: 1.25rem; display: flex; align-items: center; font-weight: 700; color: #fff; }
        .view-all-link { display: flex; align-items: center; gap: 0.25rem; color: #a1a1aa; font-size: 0.85rem; font-weight: 500; transition: color 0.2s; }
        .view-all-link:hover { color: #fff; }
        
        .anime-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.5rem; }
        
        .anixo-card { position: relative; border-radius: 8px; overflow: hidden; display: block; transition: transform 0.2s; aspect-ratio: 2 / 3; }
        .anixo-card:hover { transform: translateY(-4px); }
        .anixo-card-image-wrapper { width: 100%; height: 100%; position: relative; }
        .anixo-card-image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .anixo-card-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.9) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 0.5rem; }
        .anixo-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .anixo-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 0.2rem; }
        .dark-badge { background: rgba(0,0,0,0.6); color: #fff; backdrop-filter: blur(4px); }
        .purple-badge { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; }
        
        .anixo-card-bottom { padding: 0.25rem; }
        .anixo-card-title { color: #fff; font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.1rem; }
        .anixo-card-sub { color: #a1a1aa; font-size: 0.75rem; font-weight: 500; }
        
        .continue-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 3rem; }
        @media (max-width: 1024px) { .continue-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .continue-grid { grid-template-columns: 1fr; } }
        .continue-card { display: flex; flex-direction: column; gap: 0.5rem; transition: transform 0.2s; }
        .continue-card:hover { transform: translateY(-4px); }
        .continue-image-wrapper { position: relative; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; background: #1e1c2e; }
        .continue-image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .continue-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
        .continue-card:hover .continue-overlay { opacity: 1; }
        .continue-play-btn { width: 48px; height: 48px; border-radius: 50%; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: white; backdrop-filter: blur(4px); transition: all 0.2s; }
        .continue-play-btn:hover { background: var(--primary); border-color: var(--primary); transform: scale(1.1); }
        .continue-progress-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.2); }
        .continue-progress-fill { height: 100%; background: var(--primary); border-radius: 0 2px 2px 0; }
        .continue-info { display: flex; justify-content: space-between; align-items: center; }
        .continue-title { color: #fff; font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%; }
        .continue-ep { color: #fff; font-size: 0.75rem; font-weight: 700; }

        .features-section { display: flex; justify-content: space-between; background-color: #12101c; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 2rem; border: 1px solid #1e1c2e; flex-wrap: wrap; gap: 1rem; }
        .feature-item { display: flex; align-items: center; gap: 1rem; }
        .feature-icon { color: var(--primary); background: rgba(249, 115, 22, 0.1); padding: 0.75rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .feature-text h4 { color: #fff; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.2rem; }
        .feature-text p { color: #8a8898; font-size: 0.8rem; }
        
        .join-community-banner { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, #16112c 0%, #1a1435 100%); border-radius: 12px; padding: 1.5rem 2rem; border: 1px solid #431407; margin-bottom: 4rem; }
        .join-banner-text h3 { color: #fff; font-size: 1.1rem; font-weight: 700; margin-bottom: 0.2rem; }
        .join-banner-text p { color: #8a8898; font-size: 0.85rem; }
        .join-btn { padding: 0.6rem 1.5rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.9rem; }
        
        .skeleton { background: var(--bg-hover); animation: pulse 1.5s infinite; border-radius: 8px; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
