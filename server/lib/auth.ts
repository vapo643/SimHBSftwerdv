import { Request, Response, NextFunction } from "express";
import { createServerSupabaseClient } from "../../client/src/lib/supabase";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Development mode bypass for easier testing  
    if (process.env.NODE_ENV === "development") {
      console.log("🔧 Development mode: Bypassing authentication");
      req.user = {
        id: "dev-user",
        email: "dev@example.com",
      };
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Auth middleware: No token provided", { headers: req.headers.authorization });
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token === "undefined" || token === "null") {
      console.log("Auth middleware: Invalid token format", { token });
      return res.status(401).json({ message: "Invalid token format" });
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.log("Auth middleware: Supabase error", error);
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!user) {
      console.log("Auth middleware: No user found");
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      email: user.email || "",
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication failed" });
  }
}
