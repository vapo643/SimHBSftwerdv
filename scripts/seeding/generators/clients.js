/**
 * Client Data Generator - Gerador de dados de clientes para propostas
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { faker } from '@faker-js/faker';

export class ClientGenerator {
  
  constructor() {
    // Dados brasileiros
    faker.setLocale('pt_BR');
  }

  /**
   * Gera dados completos de cliente para uma proposta
   */
  generateClientData() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    
    return {
      // Dados pessoais básicos
      clienteNome: fullName,
      clienteEmail: faker.internet.email(firstName.toLowerCase(), lastName.toLowerCase()),
      clienteTelefone: this.generateBrazilianPhone(),
      clienteCpf: this.generateCpf(),
      clienteDataNascimento: faker.date.between({ 
        from: '1960-01-01', 
        to: '2000-12-31' 
      }),
      clienteEstadoCivil: faker.helpers.arrayElement([
        'solteiro', 'casado', 'divorciado', 'viuvo'
      ]),
      clienteEscolaridade: faker.helpers.arrayElement([
        'fundamental', 'medio', 'superior', 'pos_graduacao'
      ]),
      
      // Endereço
      clienteCep: this.generateCep(),
      clienteLogradouro: faker.location.street(),
      clienteNumero: faker.number.int({ min: 1, max: 9999 }).toString(),
      clienteComplemento: Math.random() > 0.5 ? faker.helpers.arrayElement(['Apto 101', 'Casa', 'Bloco A']) : null,
      clienteBairro: faker.location.county(),
      clienteCidade: faker.location.city(),
      clienteUf: faker.helpers.arrayElement([
        'SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'GO', 'DF'
      ]),
      
      // Dados profissionais
      clienteOcupacao: faker.person.jobTitle(),
      clienteEmpresaNome: faker.company.name(),
      clienteEmpresaCnpj: this.generateCnpj(),
      clienteCargoFuncao: faker.person.jobTitle(),
      clienteTempoEmprego: faker.helpers.arrayElement([
        '6 meses', '1 ano', '2 anos', '3 anos', '5 anos', '10 anos'
      ]),
      clienteRendaComprovada: faker.datatype.boolean(),
      
      // Dados financeiros
      clienteRenda: faker.number.float({ min: 2000, max: 15000, precision: 0.01 }),
      clienteDividasExistentes: faker.number.float({ min: 0, max: 5000, precision: 0.01 }),
      clienteComprometimentoRenda: faker.number.float({ min: 10, max: 80, precision: 0.01 }),
      clienteScoreSerasa: faker.number.int({ min: 300, max: 1000 }),
      clienteRestricoesCpf: faker.datatype.boolean(0.2), // 20% chance de ter restrições
      
      // Tipo de pessoa (apenas PF para simplicidade inicial)
      tipoPessoa: 'PF',
    };
  }

  /**
   * Gera CPF válido (formato, não necessariamente real)
   */
  generateCpf() {
    return faker.helpers.replaceSymbols('###.###.###-##');
  }

  /**
   * Gera CNPJ válido (formato)
   */
  generateCnpj() {
    return faker.helpers.replaceSymbols('##.###.###/####-##');
  }

  /**
   * Gera telefone brasileiro
   */
  generateBrazilianPhone() {
    const ddd = faker.helpers.arrayElement([
      '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
      '21', '22', '24', // RJ
      '27', '28', // ES
      '31', '32', '33', '34', '35', '37', '38', // MG
    ]);
    
    return `(${ddd}) ${faker.helpers.replaceSymbols('9####-####')}`;
  }

  /**
   * Gera CEP brasileiro
   */
  generateCep() {
    return faker.helpers.replaceSymbols('#####-###');
  }
}