import { Link } from 'react-router-dom';
import { Globe, Mail, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <>
      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-top">
            <div className="footer-brand-section">
              <Link to="/" className="footer-logo">ANIXO</Link>
              <p className="footer-tagline">
                Your favorite anime, completely ad-free. Stream the latest episodes in high quality and join our amazing community!
              </p>
              <div className="footer-socials">
                <a href="#" className="social-icon" aria-label="Discord">
                  <MessageCircle size={20} />
                </a>
                <a href="#" className="social-icon" aria-label="Website">
                  <Globe size={20} />
                </a>
                <a href="#" className="social-icon" aria-label="Contact">
                  <Mail size={20} />
                </a>
              </div>
            </div>

            <div className="footer-links-wrapper">
              <div className="footer-links-col">
                <h4>Navigation</h4>
                <Link to="/">Home</Link>
                <Link to="/trending">Trending Anime</Link>
                <Link to="#">Movies</Link>
                <Link to="#">Schedule</Link>
              </div>
              <div className="footer-links-col">
                <h4>Legal</h4>
                <Link to="#">Terms of Service</Link>
                <Link to="#">Privacy Policy</Link>
                <Link to="#">DMCA</Link>
                <Link to="#">Contact Us</Link>
              </div>
            </div>
          </div>

          <div className="footer-divider"></div>

          <div className="footer-bottom">
            <p className="disclaimer-text">
              <strong>Disclaimer:</strong> Anixo does not store any files on our server, we only linked to the media which is hosted on 3rd party services.
            </p>
            <p className="copyright">
              &copy; {new Date().getFullYear()} Anixo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
      <style>{`
        .footer {
          background-color: var(--bg-card);
          border-top: 1px solid var(--border);
          padding: 4rem 0 2rem 0;
          margin-top: auto;
          color: var(--text-muted);
        }
        
        .footer-container {
          display: flex;
          flex-direction: column;
        }

        .footer-top {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 4rem;
          margin-bottom: 3rem;
        }

        @media (max-width: 768px) {
          .footer-top {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        .footer-logo {
          font-size: 2rem;
          font-weight: 900;
          color: white;
          letter-spacing: -1px;
          margin-bottom: 1rem;
          display: inline-block;
        }

        .footer-tagline {
          font-size: 0.95rem;
          line-height: 1.6;
          max-width: 400px;
          margin-bottom: 1.5rem;
        }

        .footer-socials {
          display: flex;
          gap: 1rem;
        }

        .social-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bg-hover);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.2s;
        }

        .social-icon:hover {
          background: var(--primary);
          transform: translateY(-3px);
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        .footer-links-wrapper {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
        }

        .footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .footer-links-col h4 {
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .footer-links-col a {
          font-size: 0.95rem;
          transition: color 0.2s;
        }

        .footer-links-col a:hover {
          color: var(--primary);
        }

        .footer-divider {
          height: 1px;
          background: var(--border);
          width: 100%;
          margin-bottom: 2rem;
        }

        .footer-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
        }

        .disclaimer-text {
          font-size: 0.85rem;
          max-width: 800px;
          line-height: 1.5;
          opacity: 0.7;
        }

        .copyright {
          font-size: 0.85rem;
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
