import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Overview from '../src/pages/Overview';
import { apiClient } from '../src/api/client';

// Mock recharts because SVG layouts are hard to mock in jsdom
vi.mock('recharts', () => {
  const OriginalModule = vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    BarChart: ({ children, data }) => <div data-testid="bar-chart" data-data={JSON.stringify(data)}>{children}</div>,
    Bar: () => <div data-testid="bar" />,
    Cell: () => <div data-testid="cell" />,
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
  };
});

vi.mock('../src/api/client', () => ({
  apiClient: {
    getExperiments: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Overview Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    apiClient.getExperiments.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<Overview />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render error state with retry on failure', async () => {
    apiClient.getExperiments.mockRejectedValue(new Error('API Error'));
    render(<Overview />, { wrapper: createWrapper() });

    const errorMsg = await screen.findByText('API Error');
    expect(errorMsg).toBeInTheDocument();
    
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    
    apiClient.getExperiments.mockResolvedValueOnce({ experiments: [] });
    fireEvent.click(retryBtn);

    const title = await screen.findByText('Platform Overview');
    expect(title).toBeInTheDocument();
  });

  it('should calculate metrics and render status chart when data is loaded', async () => {
    const mockExperiments = [
      { key: 'exp_1', status: 'active', variants: [{ key: 'c', allocation: 50 }, { key: 't', allocation: 50 }] },
      { key: 'exp_2', status: 'paused', variants: [{ key: 'c', allocation: 80 }, { key: 't', allocation: 20 }] },
      { key: 'exp_3', status: 'draft', variants: [{ key: 'c', allocation: 50 }, { key: 't', allocation: 50 }] },
      { key: 'exp_4', status: 'archived', variants: [{ key: 'c', allocation: 50 }, { key: 't', allocation: 50 }] },
    ];

    apiClient.getExperiments.mockResolvedValue({ experiments: mockExperiments });
    render(<Overview />, { wrapper: createWrapper() });

    // Check Metrics values
    const totalCard = await screen.findByTestId('metric-total');
    expect(totalCard).toHaveTextContent('4');

    const activeCard = screen.getByTestId('metric-active');
    expect(activeCard).toHaveTextContent('1');

    const pausedCard = screen.getByTestId('metric-paused');
    expect(pausedCard).toHaveTextContent('1');

    const draftCard = screen.getByTestId('metric-draft');
    expect(draftCard).toHaveTextContent('1');

    const archivedCard = screen.getByTestId('metric-archived');
    expect(archivedCard).toHaveTextContent('1');

    const variantsCard = screen.getByTestId('metric-variants');
    expect(variantsCard).toHaveTextContent('8'); // 2 variants per experiment * 4

    // Check chart presence
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeInTheDocument();
    const chartData = JSON.parse(chart.getAttribute('data-data'));
    expect(chartData).toContainEqual({ name: 'Active', count: 1, color: 'var(--success-color)' });
  });

  it('should display "No status data available" if list is empty', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: [] });
    render(<Overview />, { wrapper: createWrapper() });

    const totalCard = await screen.findByTestId('metric-total');
    expect(totalCard).toHaveTextContent('0');

    expect(screen.getByText(/no status data available/i)).toBeInTheDocument();
  });
});
