/**
 * Unit Tests for Status FSM Service
 * PAM V1.0 - Status System Validation
 * Date: 19/08/2025
 *
 * These tests validate the FSM logic directly without database dependencies
 */

import { describe, it, expect } from 'vitest';
import {
  ProposalStatus,
  validateTransition,
  getPossibleTransitions,
} from '../../server/services/statusFsmService';

describe('Status FSM Unit Tests', () => {
  describe('Scenario 1: Valid Transitions', () => {
    it('should allow transition from RASCUNHO to APROVADO', () => {
      const isValid = validateTransition(ProposalStatus.RASCUNHO, ProposalStatus.APROVADO);
      expect(isValid).toBe(true);
    });

    it('should allow transition from APROVADO to AGUARDANDO_DOCUMENTACAO', () => {
      const isValid = validateTransition(
        ProposalStatus.APROVADO,
        ProposalStatus.AGUARDANDO_DOCUMENTACAO
      );
      expect(isValid).toBe(true);
    });

    it('should allow multiple valid transitions in sequence', () => {
      // RASCUNHO -> APROVADO
      expect(validateTransition(ProposalStatus.RASCUNHO, ProposalStatus.APROVADO)).toBe(true);

      // APROVADO -> AGUARDANDO_DOCUMENTACAO
      expect(
        validateTransition(ProposalStatus.APROVADO, ProposalStatus.AGUARDANDO_DOCUMENTACAO)
      ).toBe(true);

      // AGUARDANDO_DOCUMENTACAO -> DOCUMENTACAO_COMPLETA
      expect(
        validateTransition(
          ProposalStatus.AGUARDANDO_DOCUMENTACAO,
          ProposalStatus.DOCUMENTACAO_COMPLETA
        )
      ).toBe(true);

      // DOCUMENTACAO_COMPLETA -> ASSINATURA_PENDENTE
      expect(
        validateTransition(ProposalStatus.DOCUMENTACAO_COMPLETA, ProposalStatus.ASSINATURA_PENDENTE)
      ).toBe(true);
    });
  });

  describe('Scenario 2: Invalid Transitions', () => {
    it('should reject direct transition from APROVADO to REJEITADO', () => {
      const isValid = validateTransition(ProposalStatus.APROVADO, ProposalStatus.REJEITADO);
      expect(isValid).toBe(false);
    });

    it('should reject transition from CANCELADO to any other status', () => {
      const fromStatus = ProposalStatus.CANCELADO;

      // Test all possible target statuses
      const allStatuses = Object.values(ProposalStatus);

      for (const toStatus of allStatuses) {
        if (toStatus !== fromStatus) {
          const isValid = validateTransition(fromStatus, toStatus as ProposalStatus);
          expect(isValid).toBe(false);
        }
      }
    });

    it('should reject backward transition from PAGO_TOTAL to AGUARDANDO_PAGAMENTO', () => {
      const isValid = validateTransition(
        ProposalStatus.PAGO_TOTAL,
        ProposalStatus.AGUARDANDO_PAGAMENTO
      );
      expect(isValid).toBe(false);
    });
  });

  describe('Scenario 3: Get Possible Transitions', () => {
    it('should return correct transitions for RASCUNHO', () => {
      const transitions = getPossibleTransitions(ProposalStatus.RASCUNHO);

      expect(transitions).toContain(ProposalStatus.APROVADO);
      expect(transitions).toContain(ProposalStatus.REJEITADO);
      expect(transitions).toContain(ProposalStatus.CANCELADO);
      expect(transitions.length).toBeGreaterThan(0);
    });

    it('should return correct transitions for APROVADO', () => {
      const transitions = getPossibleTransitions(ProposalStatus.APROVADO);

      expect(transitions).toContain(ProposalStatus.AGUARDANDO_DOCUMENTACAO);
      expect(transitions).toContain(ProposalStatus.CANCELADO);
      expect(transitions).not.toContain(ProposalStatus.REJEITADO);
    });

    it('should return empty array for terminal states', () => {
      const canceladoTransitions = getPossibleTransitions(ProposalStatus.CANCELADO);
      expect(canceladoTransitions).toEqual([]);

      const pagoTotalTransitions = getPossibleTransitions(ProposalStatus.PAGO_TOTAL);
      expect(pagoTotalTransitions).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle self-transitions', () => {
      // Self-transitions should generally be false unless explicitly allowed
      const isValid = validateTransition(ProposalStatus.APROVADO, ProposalStatus.APROVADO);
      expect(isValid).toBe(false);
    });

    it('should handle unknown status gracefully', () => {
      // Test with an invalid status string
      const transitions = getPossibleTransitions('INVALID_STATUS' as ProposalStatus);
      expect(transitions).toEqual([]);
    });
  });
});
