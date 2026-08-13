import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Details from './pages/Details';
import Watch from './pages/Watch';
import Header from './components/Header';
import Footer from './components/Footer';

function App() {
  return (
    <>
      <Router>
        <Header />
      <main style={{ paddingTop: '70px', minHeight: 'calc(100vh - 70px)' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/anime/:id" element={<Details />} />
          <Route path="/watch/:id" element={<Watch />} />
        </Routes>
      </main>
      <Footer />
    </Router>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

:root {
  --bg-main: #0b0a15;
  --bg-card: #151420;
  --bg-hover: #1e1c2e;
  --bg-header: rgba(11, 10, 21, 0.85);
  
  --primary: #f97316;
  --primary-hover: #ea580c;
  --primary-glow: rgba(249, 115, 22, 0.4);
  
  --text-main: #fafafa;
  --text-muted: #a1a1aa;
  
  --border: #27272a;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--bg-main);
  color: var(--text-main);
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  text-decoration: none;
  color: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
  color: inherit;
}

/* Layout Utilities */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Typography */
h1, h2, h3, h4 {
  font-weight: 700;
  letter-spacing: -0.025em;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
  box-shadow: 0 0 15px var(--primary-glow);
}

.btn-secondary {
  background-color: var(--bg-hover);
  color: var(--text-main);
}

.btn-secondary:hover {
  background-color: #3f3f46;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-main);
}
::-webkit-scrollbar-thumb {
  background: var(--bg-hover);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
`}</style>
    </>
  );
}

export default App;
