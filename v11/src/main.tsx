import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BetaApp from './BetaApp';
import { MigrationReadinessApp } from './components/MigrationReadinessApp';
import './styles.css';
import './styles-beta2.css';
import './styles-beta3.css';
import './styles-beta4.css';
import './styles-rc1.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root was not found.');

const migrationRehearsal = new URLSearchParams(window.location.search).get('migration-rehearsal') === '1';

createRoot(root).render(
  <StrictMode>
    {migrationRehearsal ? <MigrationReadinessApp /> : <BetaApp />}
  </StrictMode>
);
