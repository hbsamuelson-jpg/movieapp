import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { pref } from './lib/config.js';

// Applied before the first paint so the page doesn't jump.
document.documentElement.classList.toggle('big-text', pref.get('big-text', false));

createRoot(document.getElementById('root')).render(<App />);
