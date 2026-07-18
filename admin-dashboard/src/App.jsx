import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import ExperimentList from './pages/ExperimentList';
import ExperimentCreate from './pages/ExperimentCreate';
import ExperimentDetail from './pages/ExperimentDetail';
import ExperimentResults from './pages/ExperimentResults';

// Configure TanStack Query client with safe defaults (disable auto-refetching, disable retries for predictable testing)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/experiments" element={<ExperimentList />} />
            <Route path="/experiments/new" element={<ExperimentCreate />} />
            <Route path="/experiments/:key" element={<ExperimentDetail />} />
            <Route path="/experiments/:key/results" element={<ExperimentResults />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
