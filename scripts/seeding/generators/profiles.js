/**
 * Profile Generator - Gerador de perfis de usuários/atendentes
 * Operação Soberania dos Dados - Seeding System V1.0
 */
import { faker } from '@faker-js/faker';

export class ProfileGenerator {
  
  constructor() {
    // Configuração específica para dados brasileiros
    faker.setLocale('pt_BR');
  }

  /**
   * Gera um perfil de atendente com dados consistentes
   */
  generateAttendant(lojaId) {
    return {
      id: faker.string.uuid(),
      fullName: faker.person.fullName(),
      role: 'atendente',
      lojaId: lojaId,
    };
  }

  /**
   * Gera perfil de gerente
   */
  generateManager(lojaId) {
    return {
      id: faker.string.uuid(),
      fullName: faker.person.fullName(),
      role: 'gerente',
      lojaId: lojaId,
    };
  }

  /**
   * Gera perfil de analista
   */
  generateAnalyst() {
    return {
      id: faker.string.uuid(),
      fullName: faker.person.fullName(),
      role: 'analista',
      lojaId: null, // Analistas não estão vinculados a lojas específicas
    };
  }
}