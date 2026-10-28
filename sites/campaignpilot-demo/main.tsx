import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/ui/App';
// The hosted artifact intentionally contains only the local fixture mode.
createRoot(document.getElementById('root')!).render(<React.StrictMode><App hostedDemo/></React.StrictMode>);
