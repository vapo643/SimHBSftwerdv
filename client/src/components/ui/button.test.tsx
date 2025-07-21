
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('renders button with correct text', () => {
    render(<Button>Click me</Button>)
    
    const buttonElement = screen.getByRole('button', { name: /click me/i })
    expect(buttonElement).toBeInTheDocument()
  })

  it('applies correct variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    
    const buttonElement = screen.getByRole('button', { name: /delete/i })
    expect(buttonElement).toHaveClass('bg-destructive')
  })

  it('applies correct size classes', () => {
    render(<Button size="lg">Large Button</Button>)
    
    const buttonElement = screen.getByRole('button', { name: /large button/i })
    expect(buttonElement).toHaveClass('h-11')
  })

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    
    const buttonElement = screen.getByRole('button', { name: /disabled/i })
    expect(buttonElement).toBeDisabled()
    expect(buttonElement).toHaveClass('disabled:opacity-50')
  })
})
