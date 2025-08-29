-- Setup de dados para testes de integração
-- Cria dados válidos que respeitam as regras de negócio

-- Criar parceiro de teste
INSERT INTO parceiros (id, nome, codigo, is_active) 
VALUES (999, 'Parceiro Teste', 'TEST999', true)
ON CONFLICT (id) DO NOTHING;

-- Criar loja de teste
INSERT INTO lojas (id, parceiro_id, nome_loja, endereco, is_active)
VALUES (999, 999, 'Loja Teste Integração', 'Rua Teste, 123', true)
ON CONFLICT (id) DO NOTHING;

-- Criar produto de teste
INSERT INTO produtos (id, nome, descricao, is_active)
VALUES (999, 'Produto Teste', 'Produto para testes de integração', true)
ON CONFLICT (id) DO NOTHING;

-- Criar perfil de teste
INSERT INTO profiles (id, nome_completo, role, permissions)
VALUES ('test-user-id', 'Usuário Teste', 'admin', '["all"]'::jsonb)
ON CONFLICT (id) DO NOTHING;