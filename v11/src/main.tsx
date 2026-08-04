import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BetaApp from './BetaApp';
import './styles.css';
import './styles-beta2.css';
import './styles-beta3.css';
import './styles-beta4.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root was not found.');

createRoot(root).render(
  <StrictMode>
    <BetaApp />
  </StrictMode>
);
