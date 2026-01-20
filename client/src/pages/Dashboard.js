import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { SocketContext } from '../App';
import { productsApi, matchingApi, websitesApi, jobsApi } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [matchStats, setMatchStats] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [runningJobs, setRunningJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { crawlProgress } = useContext(SocketContext);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Refresh running jobs when crawl progress changes
    loadRunningJobs();
  }, [crawlProgress]);

  const loadData = async () => {
    try {
      const [productStats, matching, sites, jobs] = await Promise.all([
        productsApi.getStats(),
        matchingApi.getStats(),
        websitesApi.getAll(),
        jobsApi.getRunning()
      ]);
      setStats(productStats);
      setMatchStats(matching);
      setWebsites(sites);
      setRunningJobs(jobs);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRunningJobs = async () => {
    try {
      const jobs = await jobsApi.getRunning();
      setRunningJobs(jobs);
    } catch (error) {
      console.error('Error loading running jobs:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Websites</div>
          <div className="value">{stats?.total_websites || 0}</div>
          <div className="sub-value">
            {stats?.source_website ? `Source: ${stats.source_website}` : 'No source set'}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Source Products</div>
          <div className="value">{stats?.source_products || 0}</div>
          <div className="sub-value">
            Avg price: ₺${stats?.price_stats?.source?.avg || '0.00'}
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Competitor Products</div>
          <div className="value">{stats?.competitor_products || 0}</div>
          <div className="sub-value">
            From {stats?.competitor_websites || 0} websites
          </div>
        </div>

        <div className="stat-card">
          <div className="label">Product Matches</div>
          <div className="value">{matchStats?.total_matches || 0}</div>
          <div className="sub-value">
            {matchStats?.confirmed_matches || 0} confirmed
          </div>
        </div>
      </div>

      {/* Running Crawls */}
      {runningJobs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Running Crawls</h3>
          </div>
          {runningJobs.map(job => {
            const progress = crawlProgress[job.website_id];
            return (
              <div key={job.id} className="crawl-progress">
                <div className="status">
                  <span>{job.website_name}</span>
                  <span>
                    {progress?.pagesCrawled || job.crawled_pages || 0} pages |
                    {progress?.productsFound || job.total_products || 0} products
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="fill"
                    style={{ width: `${Math.min((progress?.pagesCrawled || 0) * 2, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/websites" className="btn btn-primary">
              Add Website
            </Link>
            <Link to="/matching" className="btn btn-secondary">
              Run Product Matching
            </Link>
            <Link to="/comparison" className="btn btn-outline">
              View Price Comparison
            </Link>
            <Link to="/export" className="btn btn-outline">
              Export Data
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Websites</h3>
            <Link to="/websites" className="btn btn-sm btn-outline">View All</Link>
          </div>
          {websites.length === 0 ? (
            <div className="empty-state">
              <p>No websites added yet</p>
              <Link to="/websites" className="btn btn-primary btn-sm">Add Website</Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Website</th>
                    <th>Type</th>
                    <th>Products</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {websites.slice(0, 5).map(website => (
                    <tr key={website.id}>
                      <td>
                        <div>{website.name}</div>
                        <small style={{ color: 'var(--text-light)' }}>{website.url}</small>
                      </td>
                      <td>
                        <span className={`badge ${website.is_source ? 'badge-info' : 'badge-secondary'}`}>
                          {website.is_source ? 'Source' : 'Competitor'}
                        </span>
                      </td>
                      <td>{website.product_count}</td>
                      <td>
                        <span className={`badge badge-${website.status === 'completed' ? 'success' : website.status === 'failed' ? 'danger' : 'warning'}`}>
                          {website.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Match Breakdown */}
      {matchStats && matchStats.total_matches > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Match Type Breakdown</h3>
          </div>
          <div className="stats-grid">
            {Object.entries(matchStats.match_type_breakdown || {}).map(([type, count]) => (
              <div key={type} className="stat-card">
                <div className="label">{type.replace(/_/g, ' ').toUpperCase()}</div>
                <div className="value">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
