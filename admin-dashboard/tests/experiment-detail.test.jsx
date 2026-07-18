import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExperimentDetail from '../src/pages/ExperimentDetail';
import { apiClient } from '../src/api/client';

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
    getExperiment: vi.fn(),
    updateExperiment: vi.fn(),
    activateExperiment: vi.fn(),
    deactivateExperiment: vi.fn(),
    deleteExperiment: vi.fn(),
  },
}));

const renderWithRouter = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/experiments/checkout_btn_text']}>
        <Routes>
          <Route path="/experiments/:key" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Experiment Detail / Edit Page', () => {
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

  it('should render loading state initially', () => {
    apiClient.getExperiment.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<ExperimentDetail />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should load and render experiment details correctly in read-only / editable inputs', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Key and salt should be read-only
    const keyField = screen.getByTestId('field-key');
    expect(keyField).toHaveValue('checkout_btn_text');
    expect(keyField).toHaveAttribute('readonly');

    const saltField = screen.getByTestId('field-salt');
    expect(saltField).toHaveValue('v1');
    expect(saltField).toHaveAttribute('readonly');

    // Status and variants are filled and editable
    const statusField = screen.getByTestId('field-status');
    expect(statusField).toHaveValue('active');

    expect(screen.getByTestId('variant-key-input-0')).toHaveValue('control');
    expect(screen.getByTestId('variant-allocation-input-0')).toHaveValue(50);
  });

  it('should display warning alert ONLY when allocations differ from original', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Warning should not be visible by default
    expect(screen.queryByTestId('allocation-warning-alert')).not.toBeInTheDocument();

    // Click edit button first
    fireEvent.click(screen.getByTestId('edit-btn'));

    // Modify allocation
    const allocInput = screen.getByTestId('variant-allocation-input-0');
    fireEvent.change(allocInput, { target: { value: '60' } });
    
    // Total is now 110, so let's adjust the other to make it 100 but modified
    const allocInput1 = screen.getByTestId('variant-allocation-input-1');
    fireEvent.change(allocInput1, { target: { value: '40' } });

    // Warning should now be visible
    expect(screen.getByTestId('allocation-warning-alert')).toBeInTheDocument();
    expect(screen.getByTestId('allocation-warning-alert')).toHaveTextContent(
      'Changing allocation may cause some visitors to receive a different variant.'
    );

    // Revert changes
    fireEvent.change(allocInput, { target: { value: '50' } });
    fireEvent.change(allocInput1, { target: { value: '50' } });

    // Warning should disappear
    expect(screen.queryByTestId('allocation-warning-alert')).not.toBeInTheDocument();
  });

  it('should save edited status and variants and show success banner', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    apiClient.updateExperiment.mockResolvedValue({
      status: 'success',
      experiment: {
        key: 'checkout_btn_text',
        status: 'paused',
        salt: 'v1',
        variants: [
          { key: 'control', allocation: 90 },
          { key: 'treatment', allocation: 10 }
        ]
      }
    });

    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click edit button first
    fireEvent.click(screen.getByTestId('edit-btn'));

    // Edit status
    const statusSelect = screen.getByTestId('field-status');
    fireEvent.change(statusSelect, { target: { value: 'paused' } });

    // Edit allocations (90 / 10)
    fireEvent.change(screen.getByTestId('variant-allocation-input-0'), { target: { value: '90' } });
    fireEvent.change(screen.getByTestId('variant-allocation-input-1'), { target: { value: '10' } });

    const form = screen.getByTestId('edit-experiment-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiClient.updateExperiment).toHaveBeenCalledWith('checkout_btn_text', {
        status: 'paused',
        variants: [
          { key: 'control', allocation: 90 },
          { key: 'treatment', allocation: 10 }
        ]
      });
    });

    const successBanner = await screen.findByTestId('success-alert');
    expect(successBanner).toHaveTextContent('Experiment configuration saved successfully.');
  });

  it('should display Deactivate button when experiment is active', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment); // status: active
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click dropdown toggle
    fireEvent.click(screen.getByTestId('actions-dropdown-toggle'));

    expect(screen.getByTestId('deactivate-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('activate-btn')).not.toBeInTheDocument();
  });

  it('should display Activate button when experiment is draft', async () => {
    apiClient.getExperiment.mockResolvedValue({ ...mockExperiment, status: 'draft' });
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click dropdown toggle
    fireEvent.click(screen.getByTestId('actions-dropdown-toggle'));

    expect(screen.getByTestId('activate-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('deactivate-btn')).not.toBeInTheDocument();
  });

  it('should call activateExperiment when clicking Activate in header', async () => {
    apiClient.getExperiment.mockResolvedValue({ ...mockExperiment, status: 'draft' });
    apiClient.activateExperiment.mockResolvedValue({
      status: 'success',
      experiment: { ...mockExperiment, status: 'active' }
    });

    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click dropdown toggle
    fireEvent.click(screen.getByTestId('actions-dropdown-toggle'));

    const activateBtn = screen.getByTestId('activate-btn');
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(apiClient.activateExperiment).toHaveBeenCalledWith('checkout_btn_text');
    });
  });

  it('should call deactivateExperiment when clicking Deactivate in header', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment); // status: active
    apiClient.deactivateExperiment.mockResolvedValue({
      status: 'success',
      experiment: { ...mockExperiment, status: 'paused' }
    });

    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click dropdown toggle
    fireEvent.click(screen.getByTestId('actions-dropdown-toggle'));

    const deactivateBtn = screen.getByTestId('deactivate-btn');
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(apiClient.deactivateExperiment).toHaveBeenCalledWith('checkout_btn_text');
    });
  });

  it('should call deleteExperiment and redirect on delete action', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    apiClient.deleteExperiment.mockResolvedValue({ status: 'success' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click dropdown toggle
    fireEvent.click(screen.getByTestId('actions-dropdown-toggle'));

    const deleteBtn = screen.getByTestId('delete-btn');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(apiClient.deleteExperiment).toHaveBeenCalledWith('checkout_btn_text');
      expect(mockNavigate).toHaveBeenCalledWith('/experiments');
    });
    
    confirmSpy.mockRestore();
  });

  it('should render in view mode by default with disabled fields', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Key, salt, and status should be disabled / readonly
    expect(screen.getByTestId('field-key')).toHaveAttribute('readonly');
    expect(screen.getByTestId('field-salt')).toHaveAttribute('readonly');
    expect(screen.getByTestId('field-status')).toBeDisabled();

    // Variant key inputs and allocations should be disabled
    expect(screen.getByTestId('variant-key-input-0')).toBeDisabled();
    expect(screen.getByTestId('variant-allocation-input-0')).toBeDisabled();

    // Variant add/remove actions should be hidden / not present
    expect(screen.queryByTestId('add-variant-btn')).not.toBeVisible();
    expect(screen.queryByTestId('remove-variant-btn-0')).not.toBeInTheDocument();

    // Submission panel should not be present
    expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-edit-btn')).not.toBeInTheDocument();
  });

  it('should toggle to edit mode, enable inputs, and revert on Cancel', async () => {
    apiClient.getExperiment.mockResolvedValue(mockExperiment);
    renderWithRouter(<ExperimentDetail />);

    await screen.findByTestId('detail-title');

    // Click edit
    fireEvent.click(screen.getByTestId('edit-btn'));

    // Status select and variant inputs should now be enabled
    expect(screen.getByTestId('field-status')).not.toBeDisabled();
    expect(screen.getByTestId('variant-key-input-0')).not.toBeDisabled();
    expect(screen.getByTestId('variant-allocation-input-0')).not.toBeDisabled();

    // Header actions should be hidden during edit mode
    expect(screen.queryByTestId('edit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('actions-dropdown-toggle')).not.toBeInTheDocument();

    // Add variant and submit button should now be visible / present
    expect(screen.getByTestId('add-variant-btn')).toBeVisible();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();

    // Modify a value
    fireEvent.change(screen.getByTestId('variant-allocation-input-0'), { target: { value: '60' } });

    // Click Cancel
    fireEvent.click(screen.getByTestId('cancel-edit-btn'));

    // Fields should be disabled again and reverted
    expect(screen.getByTestId('variant-allocation-input-0')).toBeDisabled();
    expect(screen.getByTestId('variant-allocation-input-0')).toHaveValue(50);
  });
});
