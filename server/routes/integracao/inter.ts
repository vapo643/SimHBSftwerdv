import { Router } from "express";
import type { AuthenticatedRequest } from "../../lib/jwt-auth-middleware";

const router = Router();

// =============================================
// CIRCUIT BREAKER TEST ENDPOINTS - PAM V1.0
// =============================================

// Endpoint que testa o circuit breaker real do InterBankService
router.get("/test/circuit-breaker", async (req: AuthenticatedRequest, res) => {
  try {
    const { interBankService } = await import("../../services/interBankService");
    
    // Tentar uma conexão de teste
    const result = await interBankService.testConnection();
    
    res.json({ 
      success: true, 
      serviceStatus: result ? "operational" : "unavailable",
      circuitBreakerStatus: "closed"
    });
  } catch (error: any) {
    if (error.message?.includes("circuit breaker is OPEN")) {
      console.log("[CIRCUIT TEST] ⚡ Inter Bank circuit breaker is OPEN");
      res.status(503).json({ 
        error: "Inter Bank API temporarily unavailable - circuit breaker is OPEN",
        circuitBreakerStatus: "open"
      });
    } else {
      res.status(500).json({ 
        error: error.message,
        circuitBreakerStatus: "unknown"
      });
    }
  }
});

export default router;