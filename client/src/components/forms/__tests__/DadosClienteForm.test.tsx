
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DadosClienteForm from '../DadosClienteForm';

// Mock dos componentes UI
vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div>
      {children}
      <select onChange={(e) => onValueChange?.(e.target.value)}>
        <option value="">Selecione...</option>
        <option value="solteiro">Solteiro</option>
        <option value="casado">Casado</option>
      </select>
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type, ...props }: any) => (
    <button onClick={onClick} type={type} {...props}>
      {children}
    </button>
  )
}));

describe('DadosClienteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar todos os campos obrigatórios', () => {
    render(<DadosClienteForm />);
    
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpf\/cnpj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data de nascimento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cep/i)).toBeInTheDocument();
  });

  it('deve validar nome completo obrigatório', async () => {
    render(<DadosClienteForm />);
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Nome completo é obrigatório.')).toBeInTheDocument();
    });
  });

  it('deve validar formato de CPF/CNPJ', async () => {
    render(<DadosClienteForm />);
    
    const cpfInput = screen.getByLabelText(/cpf\/cnpj/i);
    fireEvent.change(cpfInput, { target: { value: '123' } });
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('CPF/CNPJ inválido.')).toBeInTheDocument();
    });
  });

  it('deve validar formato de email', async () => {
    render(<DadosClienteForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'email-inválido' } });
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email inválido.')).toBeInTheDocument();
    });
  });

  it('deve validar formato de CEP', async () => {
    render(<DadosClienteForm />);
    
    const cepInput = screen.getByLabelText(/cep/i);
    fireEvent.change(cepInput, { target: { value: '123' } });
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('CEP deve ter 9 dígitos (incluindo traço).')).toBeInTheDocument();
    });
  });

  it('deve aceitar formulário válido', async () => {
    const mockSubmit = vi.fn();
    render(<DadosClienteForm onSubmit={mockSubmit} />);
    
    // Preencher todos os campos obrigatórios
    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva Santos' }
    });
    fireEvent.change(screen.getByLabelText(/cpf\/cnpj/i), {
      target: { value: '12345678901234' }
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'joao@email.com' }
    });
    fireEvent.change(screen.getByLabelText(/telefone/i), {
      target: { value: '11999999999' }
    });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
      target: { value: '1990-01-01' }
    });
    fireEvent.change(screen.getByLabelText(/cep/i), {
      target: { value: '01234-567' }
    });
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          nomeCompleto: 'João Silva Santos',
          email: 'joao@email.com'
        })
      );
    });
  });

  it('deve validar renda/faturamento como número positivo', async () => {
    render(<DadosClienteForm />);
    
    const rendaInput = screen.getByLabelText(/renda.*faturamento/i);
    fireEvent.change(rendaInput, { target: { value: '-1000' } });
    
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Renda ou Faturamento deve ser positivo.')).toBeInTheDocument();
    });
  });
});
