import zxcvbn from "zxcvbn";
import { z } from "zod";

export interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  message: string;
  suggestions: string[];
}

// ASVS 6.2.4 - Validate against common passwords (3000+ in zxcvbn database)
// ASVS 6.2.7 - Validate password complexity
export function validatePassword(
  password: string,
  userInputs: string[] = []
): PasswordValidationResult {
  // Check minimum length first (ASVS 6.2.1)
  if (password.length < 8) {
    return {
      isValid: false,
      score: 0,
      message: "Senha deve ter pelo menos 8 caracteres",
      suggestions: ["Use uma senha mais longa"],
    };
  }

  // Use zxcvbn to check password strength and common passwords
  const result = zxcvbn(password, userInputs);

  // ASVS 6.2.4 - zxcvbn checks against 30,000+ common passwords
  // Score 0-1 means it's too weak (common password or very simple)
  if (result.score < 2) {
    const suggestions = result.feedback.suggestions || [];
    const warning = result.feedback.warning || "Senha muito fraca";

    return {
      isValid: false,
      score: result.score,
      message: warning,
      suggestions: suggestions.length > 0 ? suggestions : ["Use uma senha mais forte e única"],
    };
  }

  // ASVS 6.2.7 - Check for complexity rules
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  // Count how many character types are present
  const characterTypes = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(
    Boolean
  ).length;

  // Require at least 3 different character types for strong passwords
  if (characterTypes < 3) {
    return {
      isValid: false,
      score: result.score,
      message: "Senha deve conter pelo menos 3 tipos diferentes de caracteres",
      suggestions: [
        "Use letras maiúsculas e minúsculas",
        "Adicione números",
        "Inclua caracteres especiais (!@#$%&*)",
      ].filter((_, i) => {
        if (i === 0) return !hasUpperCase || !hasLowerCase;
        if (i === 1) return !hasNumber;
        if (i === 2) return !hasSpecialChar;
        return false;
      }),
    };
  }

  return {
    isValid: true,
    score: result.score,
    message: "Senha forte",
    suggestions: [],
  };
}

// Create Zod schema for password validation that can be used in routes
// ✅ OTIMIZAÇÃO: Cache validation result to avoid calling validatePassword() twice
const validationCache = new Map<string, PasswordValidationResult>();

export const passwordSchema = z
  .string()
  .min(8)
  .refine(
    password => {
      const validation = validatePassword(password);
      validationCache.set(password, validation); // Cache result
      return validation.isValid;
    },
    password => {
      // Use cached result if available, otherwise validate again
      const validation = validationCache.get(password) || validatePassword(password);
      validationCache.delete(password); // Clean up cache
      return { message: validation.message }; // ✅ CORREÇÃO: Retorna objeto { message: string }
    }
  );

// Export helper to get all validation feedback for user display
export function getPasswordStrengthFeedback(
  password: string,
  userInputs: string[] = []
): {
  strength: "weak" | "fair" | "good" | "strong" | "very-strong";
  percentage: number;
  feedback: string;
  suggestions: string[];
} {
  const result = zxcvbn(password, userInputs);

  const strengthMap = {
    0: "weak",
    1: "weak",
    2: "fair",
    3: "good",
    4: "strong",
  } as const;

  return {
    strength: strengthMap[result.score as keyof typeof strengthMap] || "weak",
    percentage: (result.score / 4) * 100,
    feedback: result.feedback.warning || "Senha analisada",
    suggestions: result.feedback.suggestions || [],
  };
}
