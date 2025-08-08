import { db } from "./supabase";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";
import { supabase } from "./supabase";

/**
 * Set up Row Level Security context for database operations
 * This function must be called before any database query to establish
 * the user's loja_id context for RLS policies
 */
export async function setRLSContext(userId: string, lojaId: number) {
  try {
    // Set the current user's loja_id in the database session
    // This will be used by the get_current_user_loja_id() function
    await db.execute(`SET app.current_user_loja_id = '${lojaId}';`);

    console.log(`RLS context set: userId=${userId}, lojaId=${lojaId}`);
  } catch (error) {
    console.error("Failed to set RLS context:", error);
    throw new Error("Failed to establish security context");
  }
}

/**
 * Enhanced authentication middleware that includes RLS context setup
 * This middleware should replace the existing authMiddleware
 */

export interface EnhancedAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    lojaId: number;
  };
}

export async function rlsAuthMiddleware(
  req: EnhancedAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const supabaseClient = supabase;

    // Get user from Supabase
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Get user's loja_id from database
    const userRecord = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        lojaId: users.lojaId,
      })
      .from(users)
      .where(eq(users.email, user.email || ""))
      .limit(1);

    if (!userRecord.length) {
      return res.status(401).json({ message: "User not found in system" });
    }

    const userData = userRecord[0];

    // Set RLS context for this request
    await setRLSContext(user.id, userData.lojaId);

    // Attach enhanced user data to request
    req.user = {
      id: user.id,
      email: user.email || "",
      lojaId: userData.lojaId,
    };

    next();
  } catch (error) {
    console.error("RLS Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
}

/**
 * Utility function to validate loja_id ownership
 * Use this in API routes for additional security validation
 */
export function validateLojaAccess(userLojaId: number, resourceLojaId: number) {
  if (userLojaId !== resourceLojaId) {
    throw new Error(
      `Unauthorized access: User loja_id ${userLojaId} cannot access resource from loja_id ${resourceLojaId}`
    );
  }
}
