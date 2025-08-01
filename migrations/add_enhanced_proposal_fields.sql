-- Migration: Add enhanced proposal fields for improved credit analysis
-- Date: February 1, 2025
-- Description: Add company phone and personal references to propostas table

-- Add company phone field to propostas table
ALTER TABLE propostas 
ADD COLUMN cliente_telefone_empresa TEXT;

-- Add personal references field as JSONB
ALTER TABLE propostas 
ADD COLUMN referencia_pessoal JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN propostas.cliente_telefone_empresa IS 'Company/Work phone number for credit validation';
COMMENT ON COLUMN propostas.referencia_pessoal IS 'Array of personal references - each with name, relationship, and phone';

-- Create index on personal references for better query performance
CREATE INDEX idx_propostas_referencia_pessoal ON propostas USING GIN(referencia_pessoal);

-- Example structure for referencia_pessoal:
-- [
--   {
--     "nomeCompleto": "João da Silva", 
--     "grauParentesco": "irmao",
--     "telefone": "(11) 98765-4321"
--   }
-- ]