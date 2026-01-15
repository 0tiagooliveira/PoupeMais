import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

const HomePage = () => {
  const location = useLocation();
  return (
    <div style={{ padding: '20px' }}>
      <h1>HOME PAGE</h1>
      <p>Current path: {location.pathname}</p>
      <nav style={{ margin: '20px 0' }}>
        <Link to="/" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Home</Link>
        <Link to="/about" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>About</Link>
        <Link to="/contact" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Contact</Link>
      </nav>
    </div>
  );
};

const AboutPage = () => {
  const location = useLocation();
  return (
    <div style={{ padding: '20px' }}>
      <h1>ABOUT PAGE</h1>
      <p>Current path: {location.pathname}</p>
      <nav style={{ margin: '20px 0' }}>
        <Link to="/" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Home</Link>
        <Link to="/about" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>About</Link>
        <Link to="/contact" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Contact</Link>
      </nav>
    </div>
  );
};

const ContactPage = () => {
  const location = useLocation();
  return (
    <div style={{ padding: '20px' }}>
      <h1>CONTACT PAGE</h1>
      <p>Current path: {location.pathname}</p>
      <nav style={{ margin: '20px 0' }}>
        <Link to="/" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Home</Link>
        <Link to="/about" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>About</Link>
        <Link to="/contact" style={{ margin: '0 10px', padding: '10px', background: '#eee' }}>Contact</Link>
      </nav>
    </div>
  );
};

const TestApp: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default TestApp;