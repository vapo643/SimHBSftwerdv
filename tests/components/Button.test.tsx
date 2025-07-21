import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Example Button component for testing
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary' 
}) => {
  const baseClasses = "px-4 py-2 rounded font-medium";
  const variantClasses = variant === 'primary' 
    ? "bg-blue-600 text-white hover:bg-blue-700" 
    : "bg-gray-200 text-gray-800 hover:bg-gray-300";
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

describe('Button Component', () => {
  it('should render button with children', () => {
    render(<Button>Test Button</Button>);
    
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: 'Click Me' });
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Disabled Button' });
    expect(button).toBeDisabled();
  });

  it('should not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<Button onClick={handleClick} disabled>Disabled Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Disabled Button' });
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply primary variant styles by default', () => {
    render(<Button>Primary Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Primary Button' });
    expect(button).toHaveClass('bg-blue-600', 'text-white');
  });

  it('should apply secondary variant styles', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Secondary Button' });
    expect(button).toHaveClass('bg-gray-200', 'text-gray-800');
  });
});