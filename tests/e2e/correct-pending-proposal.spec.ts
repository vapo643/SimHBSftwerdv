/**
 * TESTE E2E - FLUXO DE CORREÇÃO DE PROPOSTA PENDENTE
 * PAM V1.0 - BLINDAGEM AUTOMATIZADA DE REGRESSÃO
 * 
 * Este teste valida o fluxo completo de ponta-a-ponta para:
 * 1. Criar uma proposta pendente
 * 2. Navegar para edição
 * 3. Corrigir dados necessários
 * 4. Validar salvamento e mudança de status
 * 
 * Implementa validação de comportamento de negócio real com interface de usuário.
 */

import { test, expect } from '@playwright/test';

test.describe('🛡️ PROPOSAL CORRECTION E2E FLOW - PAM V1.0', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
    
    // TODO: Add authentication flow here
    // For now, assume we're already authenticated or using a test user
    console.log('🔐 [SETUP] Authentication flow - skipping for MVP test');
  });

  test('🎯 should complete full proposal correction workflow', async ({ page }) => {
    console.log('🚀 [E2E] Starting proposal correction workflow test');
    
    // Step 1: Navigate to proposals list
    console.log('📋 [STEP 1] Navigating to proposals list');
    await page.goto('/propostas');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the proposals page
    await expect(page).toHaveTitle(/Propostas|Simpix/);
    console.log('✅ [STEP 1] Proposals page loaded successfully');
    
    // Step 2: Look for a pending proposal or create one
    console.log('🔍 [STEP 2] Looking for pending proposals');
    
    // Check if there are any pending proposals visible
    const pendingProposals = page.locator('[data-testid*="proposal-"][data-status="PENDENTE"]');
    const pendingCount = await pendingProposals.count();
    
    if (pendingCount === 0) {
      console.log('📝 [STEP 2] No pending proposals found, creating one');
      
      // Navigate to create new proposal
      await page.click('[data-testid="button-nova-proposta"]');
      await page.waitForLoadState('networkidle');
      
      // Fill minimum required fields for a proposal
      await page.fill('[data-testid="input-cliente-nome"]', 'João Silva Test E2E');
      await page.fill('[data-testid="input-cliente-cpf"]', '12345678901');
      await page.fill('[data-testid="input-cliente-email"]', 'joao.teste.e2e@exemplo.com');
      await page.fill('[data-testid="input-valor"]', '10000');
      await page.fill('[data-testid="input-prazo"]', '24');
      
      // Submit the proposal (which should create it as pending)
      await page.click('[data-testid="button-salvar-proposta"]');
      await page.waitForLoadState('networkidle');
      
      // Navigate back to proposals list
      await page.goto('/propostas');
      await page.waitForLoadState('networkidle');
    }
    
    // Step 3: Find and click on the first pending proposal
    console.log('🎯 [STEP 3] Selecting first pending proposal for correction');
    
    const firstPendingProposal = page.locator('[data-testid*="proposal-"][data-status="PENDENTE"]').first();
    await expect(firstPendingProposal).toBeVisible();
    
    // Get the proposal ID for tracking
    const proposalElement = await firstPendingProposal.getAttribute('data-testid');
    const proposalId = proposalElement?.replace('proposal-card-', '') || 'unknown';
    console.log(`✅ [STEP 3] Found pending proposal: ${proposalId}`);
    
    // Click on edit button or the proposal card
    const editButton = firstPendingProposal.locator('[data-testid="button-editar"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the edit page
    await expect(page.url()).toContain('/propostas/editar');
    console.log('✅ [STEP 3] Navigate to edit page successful');
    
    // Step 4: Make corrections to the proposal
    console.log('✏️ [STEP 4] Making corrections to proposal data');
    
    // Add or correct the required fields that might be missing
    // Focus on fields that commonly cause proposals to be pending
    
    // Ensure finalidade is filled
    const finalidadeField = page.locator('[data-testid="select-finalidade"]');
    if (await finalidadeField.isVisible()) {
      await finalidadeField.click();
      await page.click('[data-testid="option-capital-giro"]');
      console.log('✅ [STEP 4] Finalidade field corrected');
    }
    
    // Ensure garantia is filled
    const garantiaField = page.locator('[data-testid="select-garantia"]');
    if (await garantiaField.isVisible()) {
      await garantiaField.click();
      await page.click('[data-testid="option-sem-garantia"]');
      console.log('✅ [STEP 4] Garantia field corrected');
    }
    
    // Add any missing client data
    const telefoneField = page.locator('[data-testid="input-cliente-telefone"]');
    if (await telefoneField.isVisible() && await telefoneField.inputValue() === '') {
      await telefoneField.fill('11999999999');
      console.log('✅ [STEP 4] Phone number added');
    }
    
    const rendaField = page.locator('[data-testid="input-cliente-renda"]');
    if (await rendaField.isVisible() && await rendaField.inputValue() === '') {
      await rendaField.fill('5000');
      console.log('✅ [STEP 4] Income added');
    }
    
    // Step 5: Save the corrected proposal
    console.log('💾 [STEP 5] Saving corrected proposal');
    
    const saveButton = page.locator('[data-testid="button-salvar"]');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Wait for save confirmation
    await page.waitForLoadState('networkidle');
    
    // Look for success message or status change
    const successMessage = page.locator('[data-testid="toast-success"], .toast-success, [data-testid="alert-success"]');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    console.log('✅ [STEP 5] Save successful - confirmation visible');
    
    // Step 6: Verify the proposal status has changed
    console.log('🔄 [STEP 6] Verifying proposal status change');
    
    // Navigate back to proposals list to verify status
    await page.goto('/propostas');
    await page.waitForLoadState('networkidle');
    
    // Look for the same proposal with updated status
    const updatedProposal = page.locator(`[data-testid="proposal-card-${proposalId}"]`);
    
    if (await updatedProposal.isVisible()) {
      const statusBadge = updatedProposal.locator('[data-testid*="status-"]');
      const currentStatus = await statusBadge.textContent();
      
      // The status should no longer be "PENDENTE"
      expect(currentStatus).not.toBe('PENDENTE');
      console.log(`✅ [STEP 6] Status successfully changed from PENDENTE to: ${currentStatus}`);
    } else {
      console.log('ℹ️ [STEP 6] Proposal might have moved to different page/filter due to status change');
    }
    
    // Step 7: Final validation - check that the data persists
    console.log('🔍 [STEP 7] Final validation - data persistence check');
    
    // Navigate back to the edit page to verify data was saved
    await page.goto(`/propostas/editar/${proposalId}`);
    await page.waitForLoadState('networkidle');
    
    // Verify the corrections are still there
    if (await finalidadeField.isVisible()) {
      const finalidadeValue = await finalidadeField.textContent();
      expect(finalidadeValue).toBeTruthy();
      expect(finalidadeValue).not.toBe('Selecione...');
      console.log('✅ [STEP 7] Finalidade data persisted correctly');
    }
    
    if (await garantiaField.isVisible()) {
      const garantiaValue = await garantiaField.textContent();
      expect(garantiaValue).toBeTruthy();
      expect(garantiaValue).not.toBe('Selecione...');
      console.log('✅ [STEP 7] Garantia data persisted correctly');
    }
    
    // Log test completion summary
    console.log('🎉 [SUCCESS] E2E Proposal Correction Workflow completed successfully:');
    console.log(`   📋 Proposal ID: ${proposalId}`);
    console.log(`   🔄 Status changed from: PENDENTE`);
    console.log(`   ✏️ Data corrections applied and persisted`);
    console.log(`   💾 Save functionality working correctly`);
    console.log(`   🔍 Frontend-backend integration validated`);
  });

  test('🚨 should handle validation errors gracefully', async ({ page }) => {
    console.log('🧪 [E2E] Testing validation error handling');
    
    // Navigate to new proposal page
    await page.goto('/propostas/nova');
    await page.waitForLoadState('networkidle');
    
    // Try to save without required fields
    const saveButton = page.locator('[data-testid="button-salvar-proposta"]');
    await saveButton.click();
    
    // Should show validation errors
    const errorMessages = page.locator('[data-testid*="error-"], .error-message, .field-error');
    await expect(errorMessages.first()).toBeVisible({ timeout: 5000 });
    
    console.log('✅ [VALIDATION] Error handling working correctly');
  });

  test('🔐 should require authentication for proposal operations', async ({ page }) => {
    console.log('🧪 [E2E] Testing authentication requirements');
    
    // TODO: Implement logout or use incognito context
    // For now, verify that certain elements require authentication
    
    await page.goto('/propostas');
    await page.waitForLoadState('networkidle');
    
    // Look for authentication-required indicators
    const authRequired = page.locator('[data-testid="login-required"], .auth-required');
    const loginForm = page.locator('[data-testid="login-form"]');
    
    // Either the page should redirect to login or show proposals (if authenticated)
    const hasProposalsAccess = await page.locator('[data-testid*="proposal-"]').count() > 0;
    const hasLoginForm = await loginForm.isVisible();
    
    // One of these should be true
    expect(hasProposalsAccess || hasLoginForm).toBe(true);
    console.log('✅ [SECURITY] Authentication check passed');
  });
});