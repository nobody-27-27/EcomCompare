import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState({});

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('crawl-progress', (data) => {
      setCrawlProgress(prev => ({
        ...prev,
        [data.website_id]: data
      }));
    });

    newSocket.on('crawl-complete', (data) => {
      setCrawlProgress(prev => ({
        ...prev,
        [data.website_id]: { ...data, status: 'completed' }
      }));
    });

    newSocket.on('crawl-error', (data) => {
      setCrawlProgress(prev => ({
        ...prev,
        [data.website_id]: { ...data, status: 'error' }
      }));
    });

    newSocket.on('running-jobs', (jobs) => {
      const progressMap = {};
      jobs.forEach(job => {
        progressMap[job.website_id] = {
          job_id: job.id,
          website_id: job.website_id,
          status: 'running',
          pagesCrawled: job.crawled_pages,
          productsFound: job.total_products
        };
      });
      setCrawlProgress(prev => ({ ...prev, ...progressMap }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const clearProgress = useCallback((websiteId) => {
    setCrawlProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[websiteId];
      return newProgress;
    });
  }, []);

  return {
    socket,
    isConnected,
    crawlProgress,
    clearProgress
  };
}
