import { createServerSupabaseClient } from "../../client/src/lib/supabase";
import { z } from "zod";
import crypto from "crypto";

// Schema para validação
export const createUserSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  role: z.enum(['ADMINISTRADOR', 'GERENTE', 'ATENDENTE']),
  lojaId: z.number().int().optional()
}).refine(data => {
  return !((data.role === 'GERENTE' || data.role === 'ATENDENTE') && !data.lojaId);
}, {
  message: "Loja é obrigatória para perfis GERENTE e ATENDENTE",
  path: ["lojaId"]
});

export type UserData = z.infer<typeof createUserSchema>;

interface CreatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  lojaId?: number;
}

// Função mock para enviar email de boas-vindas
function sendWelcomeEmail(email: string, temporaryPassword: string): void {
  console.log(`[MOCK EMAIL] Enviando email de boas-vindas para: ${email}`);
  console.log(`[MOCK EMAIL] Senha temporária: ${temporaryPassword}`);
}

// Gerar senha temporária segura
function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString('base64').slice(0, 12);
}

export async function createUser(userData: UserData): Promise<CreatedUser> {
  const supabase = createServerSupabaseClient();
  let createdAuthUser: any = null;

  try {
    // Check if user already exists by listing all users and filtering by email
    const { data: userList, error: checkError } = await supabase.auth.admin.listUsers();
    if (checkError) {
        throw new Error(`Erro ao verificar usuários existentes: ${checkError.message}`);
    }
    
    const existingUser = userList.users.find(user => user.email === userData.email);
    if (existingUser) {
      throw new Error(`Usuário com email ${userData.email} já existe`);
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: userData.fullName,
        role: userData.role
      }
    });

    if (authError) throw new Error(`Erro ao criar usuário no Auth: ${authError.message}`);
    if (!authData.user) throw new Error("Usuário não foi criado no Auth");

    createdAuthUser = authData.user;

    const profileData = {
      id: authData.user.id,
      role: userData.role,
      full_name: userData.fullName,
      loja_id: userData.lojaId || null
    };

    const { error: profileError } = await supabase.from('profiles').insert(profileData);

    if (profileError) {
      console.error("Erro ao inserir profile, fazendo rollback...", profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.log("Rollback concluído: usuário removido do Auth");
      throw new Error(`Erro ao criar perfil do usuário: ${profileError.message}`);
    }

    sendWelcomeEmail(userData.email, temporaryPassword);

    return {
      id: authData.user.id,
      email: userData.email,
      fullName: userData.fullName,
      role: userData.role,
      lojaId: userData.lojaId
    };

  } catch (error) {
    if (error instanceof Error && error.message.includes('já existe')) {
        throw error;
    }
    if (createdAuthUser) {
        await supabase.auth.admin.deleteUser(createdAuthUser.id);
        console.log("Rollback de emergência concluído");
    }
    throw error;
  }
}