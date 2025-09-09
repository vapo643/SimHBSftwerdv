CREATE TABLE "boletos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "proposta_id" text NOT NULL,
        "ccb_id" uuid,
        "numero_boleto" text NOT NULL,
        "numero_parcela" integer NOT NULL,
        "total_parcelas" integer NOT NULL,
        "valor_principal" numeric(12, 2) NOT NULL,
        "valor_juros" numeric(10, 2) DEFAULT '0.00',
        "valor_multa" numeric(10, 2) DEFAULT '0.00',
        "valor_total" numeric(12, 2) NOT NULL,
        "data_vencimento" text NOT NULL,
        "data_emissao" text NOT NULL,
        "data_pagamento" text,
        "status" text DEFAULT 'emitido' NOT NULL,
        "forma_pagamento" text,
        "banco_origem_id" text,
        "codigo_barras" text,
        "linha_digitavel" text,
        "nosso_numero" text,
        "pix_txid" text,
        "pix_copia_e_cola" text,
        "qr_code_pix" text,
        "url_boleto" text,
        "url_comprovante_pagamento" text,
        "tentativas_envio" integer DEFAULT 0,
        "ultimo_envio" timestamp,
        "motivo_cancelamento" text,
        "gerado_por" uuid,
        "observacoes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ccbs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "proposta_id" text NOT NULL,
        "numero_ccb" text NOT NULL,
        "valor_ccb" numeric(15, 2) NOT NULL,
        "status" text DEFAULT 'gerada' NOT NULL,
        "caminho_documento_original" text,
        "url_documento_original" text,
        "caminho_documento_assinado" text,
        "url_documento_assinado" text,
        "clicksign_document_key" text,
        "clicksign_signer_key" text,
        "clicksign_list_key" text,
        "clicksign_sign_url" text,
        "clicksign_status" text,
        "data_envio_assinatura" timestamp,
        "data_assinatura_concluida" timestamp,
        "prazo_assinatura" timestamp,
        "tamanho_arquivo" integer,
        "hash_documento" text,
        "versao_template" text DEFAULT '1.0',
        "criado_por" uuid,
        "observacoes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "ccbs_numero_ccb_unique" UNIQUE("numero_ccb")
);
--> statement-breakpoint
ALTER TABLE "propostas" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_proposta_id_propostas_id_fk" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_ccb_id_ccbs_id_fk" FOREIGN KEY ("ccb_id") REFERENCES "public"."ccbs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_gerado_por_profiles_id_fk" FOREIGN KEY ("gerado_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccbs" ADD CONSTRAINT "ccbs_proposta_id_propostas_id_fk" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccbs" ADD CONSTRAINT "ccbs_criado_por_profiles_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ========================================================================
-- ÍNDICES OTIMIZADOS PARA BANKING-GRADE PERFORMANCE
-- ========================================================================

-- Índices para CCBs (consultas críticas)
CREATE INDEX IF NOT EXISTS idx_ccbs_proposta_status ON ccbs(proposta_id, status);
CREATE INDEX IF NOT EXISTS idx_ccbs_status_created ON ccbs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ccbs_clicksign_document ON ccbs(clicksign_document_key);
CREATE INDEX IF NOT EXISTS idx_ccbs_not_deleted ON ccbs(id) WHERE deleted_at IS NULL;

-- Índices para Boletos (consultas críticas)
CREATE INDEX IF NOT EXISTS idx_boletos_proposta_status ON boletos(proposta_id, status);
CREATE INDEX IF NOT EXISTS idx_boletos_vencimento_status ON boletos(data_vencimento, status);
CREATE INDEX IF NOT EXISTS idx_boletos_banco_origem ON boletos(banco_origem_id);
CREATE INDEX IF NOT EXISTS idx_boletos_ccb_id ON boletos(ccb_id);
CREATE INDEX IF NOT EXISTS idx_boletos_not_deleted ON boletos(id) WHERE deleted_at IS NULL;

-- Índices adicionais para Propostas (performance crítica)
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_status ON propostas(cliente_cpf, status);
CREATE INDEX IF NOT EXISTS idx_propostas_created_status ON propostas(created_at, status);
CREATE INDEX IF NOT EXISTS idx_propostas_not_deleted ON propostas(id) WHERE deleted_at IS NULL;

-- Índices para Parcelas (sistema de cobrança)
CREATE INDEX IF NOT EXISTS idx_parcelas_proposta_status ON parcelas(proposta_id, status);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_pagamento ON parcelas(data_pagamento) WHERE data_pagamento IS NOT NULL;