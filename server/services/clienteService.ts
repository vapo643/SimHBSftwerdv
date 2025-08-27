/**
 * Cliente Service
 * Business logic for client operations
 * PAM V1.0 - Service layer implementation
 */

import { clienteRepository } from '../repositories/cliente.repository.js';
import { maskCPF, maskEmail, maskRG, maskTelefone } from '../utils/masking.js';

export class ClienteService {
  /**
   * Get client data by CPF
   */
  async getClientByCPF(cpf: string): Promise<{
    exists: boolean;
    data?: unknown;
    message?: string;
  }> {
    try {
      const cleanCPF = cpf.replace(/\D/g, '');

      if (!cleanCPF || cleanCPF.length !== 11) {
        return {
          exists: false,
          message: 'CPF inválido',
        };
      }

      console.log(`[CLIENTE_SERVICE] Searching for CPF: ${cleanCPF}`);

      // Check for demonstration CPF
      if (cleanCPF == '12345678901') {
        console.log(`[CLIENTE_SERVICE] Demo data for CPF: ${cleanCPF}`);

        return {
          exists: true,
          data: {
            nome: 'João da Silva Demonstração',
            email: maskEmail('joao.demo@email.com'),
            telefone: maskTelefone('(11) 99999-9999'),
            cpf: maskCPF(cleanCPF),
            dataNascimento: '1990-01-15',
            rg: maskRG('12.345.678-9'),
            orgaoEmissor: 'SSP',
            rgUf: 'SP',
            rgDataEmissao: '2010-01-15',
            estadoCivil: 'Solteiro',
            nacionalidade: 'Brasileira',
            localNascimento: 'São Paulo',
            cep: '01310-100',
            logradouro: 'Avenida Paulista',
            numero: '1000',
            complemento: 'Apto 101',
            bairro: 'Bela Vista',
            cidade: 'São Paulo',
            estado: 'SP',
            ocupacao: 'Analista de Sistemas',
            rendaMensal: '5000.00',
            metodoPagamento: 'conta_bancaria',
            dadosPagamentoBanco: 'Banco do Brasil',
            dadosPagamentoAgencia: '****-5',
            dadosPagamentoConta: '*****-6',
            dadosPagamentoDigito: '*',
            dadosPagamentoPixBanco: '',
            dadosPagamentoPixNomeTitular: '',
            dadosPagamentoPixCpfTitular: '',
            dadosPagamentoPix: '',
            dadosPagamentoTipoPix: '',
          },
        };
      }

      // Search in database
      const clientData = await clienteRepository.findByCPF(cleanCPF);

      if (!clientData) {
        console.log(`[CLIENTE_SERVICE] No client found for CPF: ${cleanCPF}`);
        return {
          exists: false,
          message: 'Cliente não encontrado',
        };
      }

      // Apply PII masking
      const maskedData = {
        ...clientData,
        cpf: maskCPF(clientData.cpf),
        email: clientData.email ? maskEmail(clientData.email) : '',
        telefone: clientData.telefone ? maskTelefone(clientData.telefone) : '',
        rg: clientData.rg ? maskRG(clientData.rg) : '',
        dadosPagamentoAgencia: clientData.dadosPagamentoAgencia
          ? `****-${clientData.dadosPagamentoAgencia.slice(-1)}`
          : '',
        dadosPagamentoConta: clientData.dadosPagamentoConta
          ? `*****-${clientData.dadosPagamentoConta.slice(-1)}`
          : '',
        dadosPagamentoDigito: clientData.dadosPagamentoDigito ? '*' : '',
      };

      return {
        exists: true,
        data: maskedData,
      };
    }
catch (error) {
      console.error('[CLIENTE_SERVICE] Error getting client by CPF:', error);
      throw new Error('Erro ao buscar dados do cliente');
    }
  }

  /**
   * Search address by CEP (Brazilian Postal Code)
   */
  async getAddressByCEP(cep: string): Promise<unknown> {
    try {
      const cleanCep = cep.replace(/\D/g, '');

      if (cleanCep.length !== 8) {
        throw new Error('CEP inválido');
      }

      // Try multiple CEP APIs
      const apis = [
        `https://viacep.com.br/ws/${cleanCep}/json/`,
        `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
        `https://cep.awesomeapi.com.br/json/${cleanCep}`,
      ];

      for (const apiUrl of apis) {
        try {
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();

            // Normalize response from different APIs
            if (apiUrl.includes('viacep')) {
              if (!data.erro) {
                return {
                  logradouro: data.logradouro || '',
                  bairro: data.bairro || '',
                  cidade: data.localidade || '',
                  estado: data.uf || '',
                  cep: data.cep || cleanCep,
                };
              }
            }
else if (apiUrl.includes('brasilapi')) {
              return {
                logradouro: data.street || '',
                bairro: data.neighborhood || '',
                cidade: data.city || '',
                estado: data.state || '',
                cep: data.cep || cleanCep,
              };
            }
else if (apiUrl.includes('awesomeapi')) {
              return {
                logradouro: data.address || '',
                bairro: data.district || '',
                cidade: data.city || '',
                estado: data.state || '',
                cep: data.cep || cleanCep,
              };
            }
          }
        }
catch (apiError) {
          console.log(`[CLIENTE_SERVICE] API ${apiUrl} failed, trying next...`);
          continue;
        }
      }

      throw new Error('CEP não encontrado');
    }
catch (error) {
      console.error('[CLIENTE_SERVICE] Error fetching CEP:', error);
      throw error;
    }
  }
}

export const clienteService = new ClienteService();
