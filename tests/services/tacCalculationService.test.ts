/**
 * Suíte de Testes Unitários - TacCalculationService
 *
 * Testes isolados da lógica de negócio para cálculo e isenção de TAC
 * com mocking completo das dependências de banco de dados.
 *
 * @file tests/services/tacCalculationService.test.ts
 * @created 2025-08-20
 * @coverage 4 cenários críticos conforme PAM V1.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TacCalculationService } from '../../server/services/tacCalculationService';

// Mock do módulo de database
vi.mock('../../server/lib/_supabase.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import do mock após declaração
import { db } from '../../server/lib/_supabase.js';

describe('TacCalculationService', () => {
  // Mock setup - cria chain de métodos para simular Drizzle query builder
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();

  beforeEach(() => {
    // Reset all mocks antes de cada teste
    vi.clearAllMocks();

    // Setup da chain de métodos mockados
    mockLimit.mockResolvedValue([]);
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Mock principal do db.select
    (db.select as any) = mockSelect;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateTac - Cenário 1: TAC para Cliente Novo', () => {
    it('deve calcular TAC fixa corretamente para cliente novo', async () => {
      // Arrange
      const produtoId = 1;
      const valorEmprestimo = 5000;
      const clienteCpf = '12345678901';
      const tacValorFixo = 50; // R$ 50,00

      // Mock: Cliente NÃO cadastrado (sem propostas anteriores)
      mockLimit
        .mockResolvedValueOnce([]) // Primeira chamada: isClienteCadastrado retorna vazio
        .mockResolvedValueOnce([
          {
            // Segunda chamada: busca configuração do produto
            tacValor: tacValorFixo.toString(),
            tacTipo: 'fixo',
          },
        ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(50); // TAC fixa de R$ 50,00
      expect(mockSelect).toHaveBeenCalledTimes(2); // Uma para cliente, outra para produto
    });

    it('deve calcular TAC percentual corretamente para cliente novo', async () => {
      // Arrange
      const produtoId = 2;
      const valorEmprestimo = 10000;
      const clienteCpf = '98765432100';
      const tacPercentual = 2.5; // 2.5%

      // Mock: Cliente NÃO cadastrado + produto com TAC percentual
      mockLimit
        .mockResolvedValueOnce([]) // Cliente não cadastrado
        .mockResolvedValueOnce([
          {
            // Produto com TAC percentual
            tacValor: tacPercentual.toString(),
            tacTipo: 'percentual',
          },
        ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      // 2.5% de R$ 10.000 = R$ 250,00
      expect(resultado).toBe(250);
      expect(mockSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateTac - Cenário 2: Isenção para Cliente Cadastrado', () => {
    it('deve retornar 0 (isenção) para cliente cadastrado independente do produto', async () => {
      // Arrange
      const produtoId = 1;
      const valorEmprestimo = 15000;
      const clienteCpf = '11111111111';

      // Mock: Cliente CADASTRADO (tem proposta aprovada)
      mockLimit.mockResolvedValueOnce([
        {
          id: 300001,
          status: 'aprovado',
        },
      ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(0); // Isenção total
      expect(mockSelect).toHaveBeenCalledTimes(1); // Só consulta cliente, não precisa consultar produto
    });
  });

  describe('isClienteCadastrado - Cenário 3: Lógica de Verificação de Cliente', () => {
    it('deve retornar true quando cliente possui proposta com status válido', async () => {
      // Arrange
      const clienteCpf = '22222222222';

      // Mock: Cliente com proposta assinada
      mockLimit.mockResolvedValue([
        {
          id: 300002,
          status: 'ASSINATURA_CONCLUIDA',
        },
      ]);

      // Act
      const resultado = await TacCalculationService.isClienteCadastrado(clienteCpf);

      // Assert
      expect(resultado).toBe(true);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('deve retornar false quando cliente não possui propostas com status válidos', async () => {
      // Arrange
      const clienteCpf = '33333333333';

      // Mock: Nenhuma proposta encontrada
      mockLimit.mockResolvedValue([]);

      // Act
      const resultado = await TacCalculationService.isClienteCadastrado(clienteCpf);

      // Assert
      expect(resultado).toBe(false);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('deve reconhecer todos os status de cliente cadastrado', async () => {
      // Arrange - testa os 3 status válidos
      const statusValidos = ['aprovado', 'ASSINATURA_CONCLUIDA', 'QUITADO'];
      const clienteCpf = '44444444444';

      for (const status of statusValidos) {
        // Reset mocks para cada iteração
        vi.clearAllMocks();
        mockLimit.mockReturnValue({ limit: mockLimit });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockSelect.mockReturnValue({ from: mockFrom });
        (db.select as any) = mockSelect;

        // Mock: Cliente com status específico
        mockLimit.mockResolvedValue([
          {
            id: 300003,
            status: status,
          },
        ]);

        // Act
        const resultado = await TacCalculationService.isClienteCadastrado(clienteCpf);

        // Assert
        expect(resultado).toBe(true);
        expect(mockSelect).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('calculateTac - Cenário 4: Tratamento de Erro', () => {
    it('deve retornar 0 quando produto não é encontrado', async () => {
      // Arrange
      const produtoIdInexistente = 999;
      const valorEmprestimo = 5000;
      const clienteCpf = '55555555555';

      // Mock: Cliente NÃO cadastrado + produto NÃO encontrado
      mockLimit
        .mockResolvedValueOnce([]) // Cliente não cadastrado
        .mockResolvedValueOnce([]); // Produto não encontrado

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoIdInexistente,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(0); // Fallback para não bloquear o fluxo
      expect(mockSelect).toHaveBeenCalledTimes(2);
    });

    it('deve retornar 0 quando ocorre erro na consulta ao banco', async () => {
      // Arrange
      const produtoId = 1;
      const valorEmprestimo = 5000;
      const clienteCpf = '66666666666';

      // Mock: Simulando erro na primeira consulta (isClienteCadastrado)
      // e depois retorno vazio para o produto (segunda consulta)
      mockLimit
        .mockRejectedValueOnce(new Error('Database connection failed')) // Erro na primeira consulta
        .mockResolvedValueOnce([]); // Produto não encontrado (fallback completo)

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(0); // Fallback em caso de erro
      expect(mockSelect).toHaveBeenCalledTimes(2); // isClienteCadastrado (erro) + busca produto
    });

    it('deve tratar erro na verificação de cliente e assumir não cadastrado', async () => {
      // Arrange
      const clienteCpf = '77777777777';

      // Mock: Erro na consulta
      mockLimit.mockRejectedValue(new Error('Network timeout'));

      // Act
      const resultado = await TacCalculationService.isClienteCadastrado(clienteCpf);

      // Assert
      expect(resultado).toBe(false); // Fallback: considera não cadastrado
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateTacByType - Validação Indireta via calculateTac', () => {
    it('deve tratar TAC valor zero corretamente', async () => {
      // Arrange
      const produtoId = 3;
      const valorEmprestimo = 8000;
      const clienteCpf = '88888888888';

      // Mock: Cliente não cadastrado + produto com TAC = 0
      mockLimit
        .mockResolvedValueOnce([]) // Cliente não cadastrado
        .mockResolvedValueOnce([
          {
            tacValor: '0',
            tacTipo: 'fixo',
          },
        ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(0);
    });

    it('deve usar fallback fixo para tipo desconhecido', async () => {
      // Arrange
      const produtoId = 4;
      const valorEmprestimo = 3000;
      const clienteCpf = '99999999999';
      const tacValor = 75;

      // Mock: Cliente não cadastrado + produto com tipo desconhecido
      mockLimit
        .mockResolvedValueOnce([]) // Cliente não cadastrado
        .mockResolvedValueOnce([
          {
            tacValor: tacValor.toString(),
            tacTipo: 'tipo_invalido',
          },
        ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      expect(resultado).toBe(75); // Deve usar valor fixo como fallback
    });

    it('deve arredondar TAC percentual para 2 casas decimais', async () => {
      // Arrange
      const produtoId = 5;
      const valorEmprestimo = 3333; // Valor que gera dízima
      const clienteCpf = '00000000000';
      const tacPercentual = 3; // 3%

      // Mock: Cliente não cadastrado + TAC percentual
      mockLimit
        .mockResolvedValueOnce([]) // Cliente não cadastrado
        .mockResolvedValueOnce([
          {
            tacValor: tacPercentual.toString(),
            tacTipo: 'percentual',
          },
        ]);

      // Act
      const resultado = await TacCalculationService.calculateTac(
        produtoId,
        valorEmprestimo,
        clienteCpf
      );

      // Assert
      // 3% de R$ 3.333 = R$ 99,99 (arredondado)
      expect(resultado).toBe(99.99);
    });
  });
});
