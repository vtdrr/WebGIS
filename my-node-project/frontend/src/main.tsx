import React, { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';
import './styles/app.css';
import './styles/admin.css';

// The admin UI is only downloaded when it is opened (#/admin)
const AdminApp = lazy(() => import('./components/Admin/AdminApp'));

const isAdminRoute = () => window.location.hash.startsWith('#/admin');

function Root() {
  const [admin, setAdmin] = useState(isAdminRoute());
  useEffect(() => {
    const onHashChange = () => setAdmin(isAdminRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return admin ? (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  ) : (
    <App />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
