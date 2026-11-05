import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { loadFonts } from './lib/fonts.js';
import App from './App.jsx';

loadFonts();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
