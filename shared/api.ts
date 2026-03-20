import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = loginSchema.extend({
  name: z.string().min(2),
  role: z.enum(["admin", "teacher", "student"]).default("student"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type SignupRequest = z.infer<typeof signupSchema>;

export interface AuthResponse {
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  token?: string; // In a real app, you'd return a JWT or similar
}
export interface DemoResponse {
  message: string;
}
