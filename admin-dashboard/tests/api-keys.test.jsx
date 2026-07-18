import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiKeys from '../src/pages/ApiKeys';
import { apiClient } from '../src/api/client';

vi.mock('../src/api/client', () => ({ apiClient: { getKeys: vi.fn(), createKey: vi.fn(), revokeKey: vi.fn() } }));
const wrapper = ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe('API keys page', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('confirm', vi.fn(() => true)); });
  it('lists masked keys, creates a new key, and revokes it', async () => {
    apiClient.getKeys.mockResolvedValue({ keys: [{ id: '1', name: 'Default', apiKey: 'hk_12****abcd' }] });
    apiClient.createKey.mockResolvedValue({ key: { id: '2', apiKey: 'hk_new_once' } });
    apiClient.revokeKey.mockResolvedValue({ status: 'success' });
    render(<ApiKeys />, { wrapper });
    expect(await screen.findByText('hk_12****abcd')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Name'), 'Staging');
    await user.clear(screen.getByLabelText('Expiration duration'));
    await user.type(screen.getByLabelText('Expiration duration'), '2');
    await user.selectOptions(screen.getByLabelText('Expiration unit'), 'week');
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    await waitFor(() => expect(apiClient.createKey.mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'Staging', expiresAt: expect.any(String) })));
    expect(await screen.findByText('hk_new_once')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('hk_new_once')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /revoke/i }));
    await waitFor(() => expect(apiClient.revokeKey.mock.calls[0][0]).toBe('1'));
  });
});
