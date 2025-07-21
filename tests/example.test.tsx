import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';

// Simple test component to validate configuration
const TestComponent = () => {
  return (
    <div>
      <h1>Simpix Credit Management</h1>
      <button>Click me</button>
      <p>Testing framework is working!</p>
    </div>
  );
};

describe('Testing Framework Validation', () => {
  it('should render the test component correctly', () => {
    render(<TestComponent />);
    
    // Check if elements are rendered
    expect(screen.getByText('Simpix Credit Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    expect(screen.getByText('Testing framework is working!')).toBeInTheDocument();
  });

  it('should validate basic DOM manipulation', () => {
    render(<TestComponent />);
    
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeVisible();
    expect(button.tagName.toLowerCase()).toBe('button');
  });

  it('should validate testing library utilities', () => {
    render(<TestComponent />);
    
    // Test query methods
    expect(screen.queryByText('Non-existent text')).not.toBeInTheDocument();
    expect(screen.getByText('Testing framework is working!')).toHaveTextContent('Testing framework is working!');
  });
});

describe('Environment Configuration', () => {
  it('should have access to DOM globals', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(typeof HTMLElement).toBe('function');
  });

  it('should have vitest globals configured', () => {
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });
});