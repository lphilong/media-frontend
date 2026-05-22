import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from '@app/App';
import { initializeI18n } from '@shared/i18n/i18n';
import '@styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

void initializeI18n().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
