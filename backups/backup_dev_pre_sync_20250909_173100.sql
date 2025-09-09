                    ?column?                     
-------------------------------------------------
 Backup gerado em: 2025-09-09 17:31:01.048292+00
(1 row)

-- Backup do esquema propostas Tue Sep  9 05:31:01 PM UTC 2025
                                            Table "public.propostas"
              Column              |            Type             | Collation | Nullable |        Default         
----------------------------------+-----------------------------+-----------+----------+------------------------
 id                               | text                        |           | not null | 
 numero_proposta                  | integer                     |           | not null | 
 loja_id                          | integer                     |           | not null | 
 produto_id                       | integer                     |           |          | 
 tabela_comercial_id              | integer                     |           |          | 
 cliente_nome                     | text                        |           |          | 
 cliente_cpf                      | text                        |           |          | 
 cliente_email                    | text                        |           |          | 
 cliente_telefone                 | text                        |           |          | 
 cliente_data_nascimento          | text                        |           |          | 
 cliente_renda                    | text                        |           |          | 
 cliente_rg                       | text                        |           |          | 
 cliente_orgao_emissor            | text                        |           |          | 
 cliente_rg_uf                    | text                        |           |          | 
 cliente_rg_data_emissao          | text                        |           |          | 
 cliente_estado_civil             | text                        |           |          | 
 cliente_nacionalidade            | text                        |           |          | 'Brasileira'::text
 cliente_local_nascimento         | text                        |           |          | 
 cliente_cep                      | text                        |           |          | 
 cliente_endereco                 | text                        |           |          | 
 cliente_logradouro               | text                        |           |          | 
 cliente_numero                   | text                        |           |          | 
 cliente_complemento              | text                        |           |          | 
 cliente_bairro                   | text                        |           |          | 
 cliente_cidade                   | text                        |           |          | 
 cliente_uf                       | text                        |           |          | 
 cliente_ocupacao                 | text                        |           |          | 
 tipo_pessoa                      | text                        |           |          | 'PF'::text
 cliente_razao_social             | text                        |           |          | 
 cliente_cnpj                     | text                        |           |          | 
 valor                            | numeric(15,2)               |           |          | 
 prazo                            | integer                     |           |          | 
 finalidade                       | text                        |           |          | 
 garantia                         | text                        |           |          | 
 valor_tac                        | numeric(10,2)               |           |          | 
 valor_iof                        | numeric(10,2)               |           |          | 
 valor_total_financiado           | numeric(15,2)               |           |          | 
 valor_liquido_liberado           | numeric(15,2)               |           |          | 
 juros_modalidade                 | text                        |           |          | 'pre_fixado'::text
 periodicidade_capitalizacao      | text                        |           |          | 'mensal'::text
 taxa_juros_anual                 | numeric(5,2)                |           |          | 
 praca_pagamento                  | text                        |           |          | 'São Paulo'::text
 forma_pagamento                  | text                        |           |          | 'boleto'::text
 ano_base                         | integer                     |           |          | 365
 tarifa_ted                       | numeric(10,2)               |           |          | 10.00
 taxa_credito                     | numeric(10,2)               |           |          | 
 data_liberacao                   | timestamp without time zone |           |          | 
 forma_liberacao                  | text                        |           |          | 'deposito'::text
 calculo_encargos                 | text                        |           |          | 
 status                           | text                        |           | not null | 
 analista_id                      | text                        |           |          | 
 data_analise                     | timestamp without time zone |           |          | 
 motivo_pendencia                 | text                        |           |          | 
 valor_aprovado                   | numeric(15,2)               |           |          | 
 taxa_juros                       | numeric(5,2)                |           |          | 
 observacoes                      | text                        |           |          | 
 documentos                       | text[]                      |           |          | 
 ccb_documento_url                | text                        |           |          | 
 data_aprovacao                   | timestamp without time zone |           |          | 
 documentos_adicionais            | text[]                      |           |          | 
 contrato_gerado                  | boolean                     |           |          | false
 contrato_assinado                | boolean                     |           |          | false
 data_assinatura                  | timestamp without time zone |           |          | 
 data_pagamento                   | timestamp without time zone |           |          | 
 observacoes_formalizacao         | text                        |           |          | 
 ccb_gerado                       | boolean                     |           | not null | false
 caminho_ccb                      | text                        |           |          | 
 ccb_gerado_em                    | timestamp without time zone |           |          | 
 assinatura_eletronica_concluida  | boolean                     |           | not null | false
 biometria_concluida              | boolean                     |           | not null | false
 caminho_ccb_assinado             | text                        |           |          | 
 clicksign_document_key           | text                        |           |          | 
 clicksign_signer_key             | text                        |           |          | 
 clicksign_list_key               | text                        |           |          | 
 clicksign_status                 | text                        |           |          | 
 clicksign_sign_url               | text                        |           |          | 
 clicksign_sent_at                | timestamp without time zone |           |          | 
 clicksign_signed_at              | timestamp without time zone |           |          | 
 dados_pagamento_banco            | text                        |           |          | 
 dados_pagamento_codigo_banco     | text                        |           |          | 
 dados_pagamento_agencia          | text                        |           |          | 
 dados_pagamento_conta            | text                        |           |          | 
 dados_pagamento_digito           | text                        |           |          | 
 dados_pagamento_tipo             | text                        |           |          | 
 dados_pagamento_nome_titular     | text                        |           |          | 
 dados_pagamento_cpf_titular      | text                        |           |          | 
 dados_pagamento_pix              | text                        |           |          | 
 dados_pagamento_tipo_pix         | text                        |           |          | 
 dados_pagamento_pix_banco        | text                        |           |          | 
 dados_pagamento_pix_nome_titular | text                        |           |          | 
 dados_pagamento_pix_cpf_titular  | text                        |           |          | 
 metodo_pagamento                 | text                        |           |          | 'conta_bancaria'::text
 url_comprovante_pagamento        | text                        |           |          | 
 inter_boleto_gerado              | boolean                     |           |          | false
 inter_boleto_gerado_em           | timestamp without time zone |           |          | 
 cliente_data                     | text                        |           |          | 
 condicoes_data                   | text                        |           |          | 
 cliente_empresa_nome             | text                        |           |          | 
 cliente_empresa_cnpj             | text                        |           |          | 
 cliente_cargo_funcao             | text                        |           |          | 
 cliente_tempo_emprego            | text                        |           |          | 
 cliente_renda_comprovada         | boolean                     |           |          | false
 cliente_dividas_existentes       | numeric(12,2)               |           |          | 
 cliente_comprometimento_renda    | numeric(6,2)                |           |          | 
 cliente_score_serasa             | integer                     |           |          | 
 cliente_restricoes_cpf           | boolean                     |           |          | false
 user_id                          | text                        |           |          | 
 created_at                       | timestamp without time zone |           |          | now()
 deleted_at                       | timestamp without time zone |           |          | 
Indexes:
    "propostas_pkey" PRIMARY KEY, btree (id)
    "propostas_numero_proposta_unique" UNIQUE CONSTRAINT, btree (numero_proposta)
Foreign-key constraints:
    "propostas_produto_id_produtos_id_fk" FOREIGN KEY (produto_id) REFERENCES produtos(id)
    "propostas_tabela_comercial_id_tabelas_comerciais_id_fk" FOREIGN KEY (tabela_comercial_id) REFERENCES tabelas_comerciais(id)
Referenced by:
    TABLE "comunicacao_logs" CONSTRAINT "comunicacao_logs_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id)
    TABLE "historico_observacoes_cobranca" CONSTRAINT "historico_observacoes_cobranca_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id)
    TABLE "inter_collections" CONSTRAINT "inter_collections_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id)
    TABLE "observacoes_cobranca" CONSTRAINT "observacoes_cobranca_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "parcelas" CONSTRAINT "parcelas_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "proposta_documentos" CONSTRAINT "proposta_documentos_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id)
    TABLE "proposta_logs" CONSTRAINT "proposta_logs_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id)
    TABLE "referencia_pessoal" CONSTRAINT "referencia_pessoal_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "referencias_profissionais" CONSTRAINT "referencias_profissionais_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "solicitacoes_modificacao" CONSTRAINT "solicitacoes_modificacao_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "status_contextuais" CONSTRAINT "status_contextuais_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
    TABLE "status_transitions" CONSTRAINT "status_transitions_proposta_id_propostas_id_fk" FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE

-- Contagem de registros principais Tue Sep  9 05:31:03 PM UTC 2025
      ?column?      | count 
--------------------+-------
 propostas          |     0
 tabelas_comerciais |     1
(2 rows)

