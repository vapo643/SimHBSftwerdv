import { createServerSupabaseAdminClient } from '../lib/supabase';
import { z } from 'zod';

import { UserDataSchema, UserData } from '../../shared/types/user';

// Re-export UserData for tests
export { UserData };

export async function createUser(userData: UserData) {
  const supabase = createServerSupabaseAdminClient();
  let createdAuthUser: unknown = null;
  let createdProfile: unknown = null;

  try {
    // Check if user already exists by listing all users and finding by email
    const { data: existingUsers, error: checkError } = await supabase.auth.admin.listUsers();
    if (checkError) {
      throw new Error(`Erro ao verificar email: ${checkError.message}`);
    }

    const existingUser = existingUsers.users.find((user) => user.email === userData.email);
    if (existingUser) {
      const conflictError = new Error(`Usuário com email ${userData.email} já existe.`);
      conflictError.name = 'ConflictError';
      throw conflictError;
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
    });

    if (authError) throw new Error(`Erro no Supabase Auth: ${authError.message}`);
    if (!authData.user) throw new Error('Falha crítica ao criar usuário no Auth.');
    createdAuthUser = authData.user;

    const profilePayload = {
      id: createdAuthUser.id,
      role: userData.role,
      full_name: userData.fullName,
      loja_id: userData.role === 'ATENDENTE' ? userData.lojaId : null,
    };

    const { data: profileResult, error: profileError } = await supabase
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();
    if (profileError) throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    createdProfile = profileResult;

    if (userData.role === 'GERENTE' && userData.lojaIds && userData.lojaIds.length > 0) {
      const gerenteLojaInserts = userData.lojaIds.map((lojaId) => ({
        gerente_id: createdAuthUser.id,
        loja_id: lojaId,
      }));
      const { error: gerenteLojaError } = await supabase
        .from('gerente_lojas')
        .insert(gerenteLojaInserts);
      if (gerenteLojaError)
        throw new Error(`Erro ao associar gerente a lojas: ${gerenteLojaError.message}`);
    }

    return {
      success: true,
      message: 'Usuário criado com sucesso.',
      user: createdProfile,
    };
  } catch (error) {
    if (createdAuthUser) {
      console.error('ERRO DETECTADO. Iniciando rollback completo...');
      await supabase.auth.admin.deleteUser(createdAuthUser.id);
      console.log(`ROLLBACK: Usuário ${createdAuthUser.id} removido do Auth.`);
    }
    throw error;
  }
}
