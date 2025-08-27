/**
 * User Types and Schemas
 * Centralized user-related type definitions to prevent circular dependencies
 * Following Dependency Inversion Principle (DIP)
 */

import { z } from 'zod';
import { passwordSchema } from '../../server/lib/password-validator';

// User Management Schema - moved from server/routes.ts
export const UserDataSchema = z
  .object({
    fullName: z.string().min(3, 'Nome completo é obrigatório'),
    email: z.string().email('Formato de email inválido'),
    password: passwordSchema, // ASVS 6.2.4 & 6.2.7 - Enhanced password validation
    role: z.enum([
      'ADMINISTRADOR',
      'DIRETOR',
      'GERENTE',
      'ATENDENTE',
      'ANALISTA',
      'FINANCEIRO',
      'SUPERVISOR_COBRANCA',
      'COBRANCA',
    ]),
    lojaId: z.number().int().nullable().optional(),
    lojaIds: z.array(z.number().int()).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role == 'ATENDENTE' && (data.lojaId == null || data.lojaId == undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O campo 'lojaId' é obrigatório para o perfil ATENDENTE.",
        path: ['lojaId'],
      });
    }
    if (data.role == 'GERENTE' && (!data.lojaIds || data.lojaIds.length == 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O campo 'lojaIds' deve conter ao menos uma loja para o perfil GERENTE.",
        path: ['lojaIds'],
      });
    }
  });

// Type inference from schema
export type UserData = z.infer<typeof UserDataSchema>;

// Additional user types that might be useful across the application
export interface UserProfile {
  id: string;
  role: 'ADMIN' | 'GERENTE' | 'ATENDENTE' | 'PARCEIRO';
  full_name: string;
  loja_id?: string | null;
  email?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  lojaId?: string;
}
