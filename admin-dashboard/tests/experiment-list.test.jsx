import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ExperimentList from '../src/pages/ExperimentList';
import { apiClient } from '../src/api/client';

vi.mock('../src/api/client', () => ({
  apiClient: {
    getExperiments: vi.fn(),
    activateExperiment: vi.fn(),
    deactivateExperiment: vi.fn(),
    deleteExperiment: vi.fn(),
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

describe('Experiment List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExperiments = [
    {
      key: 'checkout_btn_text',
      status: 'active',
      salt: 'v1',
      variants: [
        { key: 'control', allocation: 50 },
        { key: 'treatment', allocation: 50 }
      ]
    },
    {
      key: 'homepage_banner',
      status: 'draft',
      salt: 'v2',
      variants: [
        { key: 'control', allocation: 60 },
        { key: 'variant_a', allocation: 20 },
        { key: 'variant_b', allocation: 20 }
      ]
    },
    {
      key: 'pricing_tier',
      status: 'paused',
      salt: 'v3',
      variants: [
        { key: 'control', allocation: 90 },
        { key: 'treatment', allocation: 10 }
      ]
    }
  ];

  it('should render loading state initially', () => {
    apiClient.getExperiments.mockReturnValue(new Promise(() => {}));
    render(<ExperimentList />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render error state on API failure', async () => {
    apiClient.getExperiments.mockRejectedValue(new Error('Network error'));
    render(<ExperimentList />, { wrapper: createWrapper() });

    const errorMsg = await screen.findByText('Network error');
    expect(errorMsg).toBeInTheDocument();
  });

  it('should render empty state if no experiments exist', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: [] });
    render(<ExperimentList />, { wrapper: createWrapper() });

    const emptyTitle = await screen.findByText('No Experiments Found');
    expect(emptyTitle).toBeInTheDocument();
  });

  it('should render the list of experiments correctly', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: mockExperiments });
    render(<ExperimentList />, { wrapper: createWrapper() });

    const table = await screen.findByTestId('experiments-table');
    expect(table).toBeInTheDocument();

    // Check titles
    expect(screen.getByText('checkout_btn_text')).toBeInTheDocument();
    expect(screen.getByText('homepage_banner')).toBeInTheDocument();
    
    // Check allocations summary
    expect(screen.getByText('control (50%) / treatment (50%)')).toBeInTheDocument();
    expect(screen.getByText('control (60%) / variant_a (20%) / variant_b (20%)')).toBeInTheDocument();
  });

  it('should filter client-side by key search input', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: mockExperiments });
    render(<ExperimentList />, { wrapper: createWrapper() });

    await screen.findByTestId('experiments-table');

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'btn' } });

    // Should show match and hide non-match
    expect(screen.getByText('checkout_btn_text')).toBeInTheDocument();
    expect(screen.queryByText('homepage_banner')).not.toBeInTheDocument();
  });

  it('should filter client-side by status dropdown', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: mockExperiments });
    render(<ExperimentList />, { wrapper: createWrapper() });

    await screen.findByTestId('experiments-table');

    const statusSelect = screen.getByTestId('status-select');
    fireEvent.change(statusSelect, { target: { value: 'paused' } });

    // Should only show pricing_tier (paused)
    expect(screen.getByText('pricing_tier')).toBeInTheDocument();
    expect(screen.queryByText('checkout_btn_text')).not.toBeInTheDocument();
    expect(screen.queryByText('homepage_banner')).not.toBeInTheDocument();
  });

  it('should display View and Results buttons for each experiment row', async () => {
    apiClient.getExperiments.mockResolvedValue({ experiments: mockExperiments });
    render(<ExperimentList />, { wrapper: createWrapper() });

    await screen.findByTestId('experiments-table');

    // Should have view-btn and results-btn for each experiment
    expect(screen.getByTestId('view-btn-checkout_btn_text')).toBeInTheDocument();
    expect(screen.getByTestId('view-btn-homepage_banner')).toBeInTheDocument();
    expect(screen.getByTestId('results-btn-checkout_btn_text')).toBeInTheDocument();
    expect(screen.getByTestId('results-btn-homepage_banner')).toBeInTheDocument();

    // The other state action buttons should NOT be present in list row
    expect(screen.queryByTestId('activate-btn-checkout_btn_text')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deactivate-btn-checkout_btn_text')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-btn-checkout_btn_text')).not.toBeInTheDocument();
  });
});
