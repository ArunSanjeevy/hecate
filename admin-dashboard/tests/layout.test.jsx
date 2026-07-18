import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../src/components/Layout';

describe('Layout component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should render with default light theme and toggle to dark theme', () => {
    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );

    // Initial default theme should be light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Click theme toggle
    const toggleBtn = screen.getByTestId('theme-toggle');
    fireEvent.click(toggleBtn);

    // Attribute should update to dark
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('hecate-theme')).toBe('dark');

    // Click theme toggle again
    fireEvent.click(toggleBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('hecate-theme')).toBe('light');
  });

  it('should initialize theme from localStorage', () => {
    localStorage.setItem('hecate-theme', 'dark');

    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
