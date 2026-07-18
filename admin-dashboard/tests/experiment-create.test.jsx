import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ExperimentCreate from '../src/pages/ExperimentCreate';
import { apiClient, APIError } from '../src/api/client';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../src/api/client', () => ({
  apiClient: {
    createExperiment: vi.fn(),
  },
  APIError: class APIError extends Error {
    constructor(message, status, errorCode, details = null) {
      super(message);
      this.status = status;
      this.errorCode = errorCode;
      this.details = details;
    }
  }
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

describe('Create Experiment Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with default values', () => {
    render(<ExperimentCreate />, { wrapper: createWrapper() });

    expect(screen.getByTestId('field-key')).toHaveValue('');
    expect(screen.getByTestId('field-status')).toHaveValue('draft');
    
    // Check for default variants
    expect(screen.getByTestId('variant-key-input-0')).toHaveValue('control');
    expect(screen.getByTestId('variant-allocation-input-0')).toHaveValue(50);
    expect(screen.getByTestId('variant-key-input-1')).toHaveValue('treatment');
    expect(screen.getByTestId('variant-allocation-input-1')).toHaveValue(50);
    
    expect(screen.getByTestId('allocation-total-bar')).toHaveTextContent('Total Allocation:100% / 100%');
  });

  it('should allow adding and removing variants dynamically', () => {
    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const addBtn = screen.getByTestId('add-variant-btn');
    fireEvent.click(addBtn);

    // Verify a third row is added
    expect(screen.getByTestId('variant-row-2')).toBeInTheDocument();
    
    // Remove it
    const removeBtn = screen.getByTestId('remove-variant-btn-2');
    fireEvent.click(removeBtn);
    
    expect(screen.queryByTestId('variant-row-2')).not.toBeInTheDocument();
  });

  it('should show error and disable submit if allocations do not total 100', async () => {
    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const allocationInput = screen.getByTestId('variant-allocation-input-1');
    fireEvent.change(allocationInput, { target: { value: '40' } }); // Total: 50 + 40 = 90%

    expect(screen.getByTestId('allocation-total-bar')).toHaveClass('error');
    expect(screen.getByTestId('error-allocation-sum')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('should show error and disable submit if variant keys are duplicated', async () => {
    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const keyInput = screen.getByTestId('variant-key-input-1');
    fireEvent.change(keyInput, { target: { value: 'control' } }); // Both are 'control'

    expect(screen.getByTestId('error-duplicate-keys')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('should show error and disable submit if allocations are negative or decimal', async () => {
    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const allocationInput = screen.getByTestId('variant-allocation-input-1');
    fireEvent.change(allocationInput, { target: { value: '-10' } });

    expect(screen.getByTestId('error-invalid-allocations')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeDisabled();
  });

  it('should successfully submit form and navigate on success', async () => {
    apiClient.createExperiment.mockResolvedValue({
      status: 'success',
      experiment: { key: 'new_experiment' }
    });

    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const keyField = screen.getByTestId('field-key');
    fireEvent.change(keyField, { target: { value: 'new_experiment' } });

    const form = screen.getByTestId('create-experiment-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiClient.createExperiment).toHaveBeenCalledWith({
        key: 'new_experiment',
        status: 'draft',
        variants: [
          { key: 'control', allocation: 50 },
          { key: 'treatment', allocation: 50 }
        ]
      });
      expect(mockNavigate).toHaveBeenCalledWith('/experiments/new_experiment');
    });
  });

  it('should display field error when duplicate experiment key is submitted', async () => {
    const duplicateError = new APIError('Duplicate', 409, 'duplicate_key');
    apiClient.createExperiment.mockRejectedValue(duplicateError);

    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const keyField = screen.getByTestId('field-key');
    fireEvent.change(keyField, { target: { value: 'existing_experiment' } });

    const form = screen.getByTestId('create-experiment-form');
    fireEvent.submit(form);

    const errorMsg = await screen.findByTestId('error-key');
    expect(errorMsg).toHaveTextContent('An experiment with this key already exists.');
  });

  it('should display root validation error if backend payload check fails', async () => {
    const validationError = new APIError('Joi validation error', 400, 'invalid_payload', {
      error_code: 'invalid_payload',
      message: 'Variants total must equal 100'
    });
    apiClient.createExperiment.mockRejectedValue(validationError);

    render(<ExperimentCreate />, { wrapper: createWrapper() });

    const keyField = screen.getByTestId('field-key');
    fireEvent.change(keyField, { target: { value: 'failed_experiment' } });

    const form = screen.getByTestId('create-experiment-form');
    fireEvent.submit(form);

    const serverAlert = await screen.findByTestId('server-error-alert');
    expect(serverAlert).toHaveTextContent('Variants total must equal 100');
  });
});
