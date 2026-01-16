import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import Dashboard from './pages/Dashboard';
import Websites from './pages/Websites';
import Products from './pages/Products';
import Matching from './pages/Matching';
import Comparison from './pages/Comparison';
import Export from './pages/Export';
import './App.css';

// Create context for socket
export const SocketContext = React.createContext(null);

function App() {
  const socketData = useSocket();

  return (
    <SocketContext.Provider value={socketData}>
      <BrowserRouter>
        <div className="app">
          <nav className="sidebar">
            <div className="logo">
              <h1>EcomCompare</h1>
              <span className="connection-status">
                {socketData.isConnected ? (
                  <span className="connected">Connected</span>
                ) : (
                  <span className="disconnected">Disconnected</span>
                )}
              </span>
            </div>
            <ul className="nav-links">
              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/websites" className={({ isActive }) => isActive ? 'active' : ''}>
                  Websites
                </NavLink>
              </li>
              <li>
                <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
                  Products
                </NavLink>
              </li>
              <li>
                <NavLink to="/matching" className={({ isActive }) => isActive ? 'active' : ''}>
                  Matching
                </NavLink>
              </li>
              <li>
                <NavLink to="/comparison" className={({ isActive }) => isActive ? 'active' : ''}>
                  Comparison
                </NavLink>
              </li>
              <li>
                <NavLink to="/export" className={({ isActive }) => isActive ? 'active' : ''}>
                  Export
                </NavLink>
              </li>
            </ul>
          </nav>
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/websites" element={<Websites />} />
              <Route path="/products" element={<Products />} />
              <Route path="/matching" element={<Matching />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/export" element={<Export />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </SocketContext.Provider>
  );
}

export default App;
