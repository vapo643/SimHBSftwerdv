-- Migration: Add ClickSign integration fields to propostas table
-- Date: January 29, 2025

ALTER TABLE propostas 
ADD COLUMN clicksign_document_key TEXT,
ADD COLUMN clicksign_signer_key TEXT,
ADD COLUMN clicksign_list_key TEXT,
ADD COLUMN clicksign_status TEXT,
ADD COLUMN clicksign_sign_url TEXT,
ADD COLUMN clicksign_sent_at TIMESTAMP,
ADD COLUMN clicksign_signed_at TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN propostas.clicksign_document_key IS 'ClickSign document key returned after upload';
COMMENT ON COLUMN propostas.clicksign_signer_key IS 'ClickSign signer key for the client';
COMMENT ON COLUMN propostas.clicksign_list_key IS 'ClickSign signature list (envelope) key';
COMMENT ON COLUMN propostas.clicksign_status IS 'ClickSign status: pending, signed, cancelled, expired';
COMMENT ON COLUMN propostas.clicksign_sign_url IS 'URL for client to access signature interface';
COMMENT ON COLUMN propostas.clicksign_sent_at IS 'When CCB was sent to ClickSign';
COMMENT ON COLUMN propostas.clicksign_signed_at IS 'When client completed signature in ClickSign';