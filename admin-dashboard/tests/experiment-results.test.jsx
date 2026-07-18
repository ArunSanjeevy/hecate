import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExperimentResults from '../src/pages/ExperimentResults';
import { apiClient } from '../src/api/client';

// Mock recharts because SVG layout components fail in jsdom
vi.mock('recharts', () => {
  const OriginalModule = vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    BarChart: ({ children, data }) => <div data-testid="results-bar-chart" data-data={JSON.stringify(data)}>{children}</div>,
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
    getExperiment: vi.fn(),
    getResults: vi.fn(),
  },
}));

const renderWithRouter = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/experiments/checkout_btn_text/results']}>
        <Routes>
          <Route path="/experiments/:key/results" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Experiment Results Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExperiment = {
    key: 'checkout_btn_text',
    status: 'active',
    salt: 'v1',
    variants: [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ]
  };

  const mockResults = {
    experimentKey: 'checkout_btn_text',
    variants: [
      { variantKey: 'control', exposures: 200, conversions: 20, conversionRate: 0.10 },
      { variantKey: 'treatment', exposures: 200, conversions: 30, conversionRate: 0.15 }
    ]
  };

  it('should render loading state initially', () => {
    apiClient.getExperiment.mockReturnValue(new Promise(() => {}));
    apiClient.getResults.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<ExperimentResults />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should load and render metrics, table, and chart correctly', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    apiClient.getResults.mockResolvedValue(mockResults);
    
    renderWithRouter(<ExperimentResults />);

    // Header checks
    await screen.findByText('Results: checkout_btn_text');
    expect(screen.getByText('active')).toBeInTheDocument();

    // Summary checks
    expect(screen.getByTestId('metric-total-exposures')).toHaveTextContent('400');
    expect(screen.getByTestId('metric-total-conversions')).toHaveTextContent('50');
    expect(screen.getByTestId('metric-overall-cr')).toHaveTextContent('12.50%'); // 50 / 400 = 12.5%

    // Table checks
    expect(screen.getByTestId('results-table')).toBeInTheDocument();
    expect(screen.getByTestId('result-row-control')).toHaveTextContent('control2002010.00%');
    expect(screen.getByTestId('result-row-treatment')).toHaveTextContent('treatment2003015.00%');

    // Chart checks
    const chart = screen.getByTestId('results-bar-chart');
    expect(chart).toBeInTheDocument();
    const data = JSON.parse(chart.getAttribute('data-data'));
    expect(data).toContainEqual({ name: 'control', rate: 10, rateRaw: 0.10 });
    expect(data).toContainEqual({ name: 'treatment', rate: 15, rateRaw: 0.15 });
  });

  it('should handle zero exposure safely without division errors', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    apiClient.getResults.mockResolvedValue({
      experimentKey: 'checkout_btn_text',
      variants: [
        { variantKey: 'control', exposures: 0, conversions: 0, conversionRate: 0 },
        { variantKey: 'treatment', exposures: 0, conversions: 0, conversionRate: 0 }
      ]
    });

    renderWithRouter(<ExperimentResults />);

    await screen.findByText('Results: checkout_btn_text');

    // Verify values display zero
    expect(screen.getByTestId('metric-total-exposures')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-total-conversions')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-overall-cr')).toHaveTextContent('0.00%');

    // Verify warning or chart fallback message
    expect(screen.getByText('No exposure events recorded yet. Ready to receive assignments.')).toBeInTheDocument();
  });

  it('should call refetch on click of manual refresh button', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    apiClient.getResults.mockResolvedValue(mockResults);

    renderWithRouter(<ExperimentResults />);

    await screen.findByText('Results: checkout_btn_text');

    const refreshBtn = screen.getByTestId('refresh-btn');
    fireEvent.click(refreshBtn);

    expect(apiClient.getExperiment).toHaveBeenCalledTimes(2);
    expect(apiClient.getResults).toHaveBeenCalledTimes(2);
  });
});
