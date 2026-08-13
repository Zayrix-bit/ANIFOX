import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, Home, Tv, Film, Calendar, Users, ChevronDown, Moon, User } from 'lucide-react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container header-container">
        <div className="header-left">
          <button className="mobile-menu-btn">
            <Menu size={24} />
          </button>
          <Link to="/" className="logo">
            ANIXO
          </Link>
          <nav className="desktop-nav">
            <Link to="/" className="nav-link active"><Home size={16} /> Home</Link>
            <Link to="#" className="nav-link"><Tv size={16} /> Anime</Link>
            <Link to="#" className="nav-link"><Film size={16} /> Movies</Link>
            <Link to="#" className="nav-link"><Calendar size={16} /> Schedule</Link>
            <Link to="#" className="nav-link"><Users size={16} /> Community</Link>
            <div className="nav-link nav-dropdown">More <ChevronDown size={14} /></div>
          </nav>
        </div>

        <div className="header-right">
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search anime..." />
            <div className="search-shortcut">Ctrl K</div>
          </div>
          <button className="btn btn-primary sign-in-btn">
            <User size={16} style={{marginRight: '6px'}} /> Sign in
          </button>
          <button className="icon-btn theme-btn">
            <Moon size={20} />
          </button>
        </div>
        </div>
      </header>
      <style>{`.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background-color: transparent;
  z-index: 1000;
  transition: background-color 0.3s ease, border-bottom 0.3s ease;
  border-bottom: 1px solid transparent;
}

.header.scrolled {
  background-color: var(--bg-header);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.header-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.mobile-menu-btn {
  display: none;
  color: var(--text-main);
}

.logo {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 1px;
}

.desktop-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.nav-link:hover, .nav-link.active {
  color: var(--text-main);
}
.nav-link.active { border-bottom: 2px solid var(--primary); padding-bottom: 2px; }

.nav-dropdown { cursor: pointer; }

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-bar {
  display: flex;
  align-items: center;
  background-color: #12101e;
  border-radius: 99px;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border);
  gap: 0.5rem;
  width: 250px;
}

.search-icon { color: var(--text-muted); }

.search-bar input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 0.85rem;
  outline: none;
}

.search-shortcut {
  background-color: #1c1a2c;
  color: var(--text-muted);
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.sign-in-btn {
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--text-main);
  background-color: transparent;
  transition: background-color 0.2s;
  cursor: pointer;
  border: none;
}

.icon-btn:hover {
  background-color: var(--bg-hover);
}

.theme-btn {
  background-color: #12101e;
  border: 1px solid var(--border);
}

@media (max-width: 900px) {
  .desktop-nav {
    display: none;
  }
  .mobile-menu-btn {
    display: block;
  }
  .header-center {
    display: none;
  }
}
`}</style>
    </>
  );
}
