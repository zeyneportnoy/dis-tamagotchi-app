import { z } from 'zod';

const configSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(20),
});

export type SupabaseConfig = z.infer<typeof configSchema>;

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !publishableKey) return null;
  const result = configSchema.safeParse({ url, publishableKey });
  if (!result.success) throw new Error('SUPABASE_CONFIG_INVALID');
  return result.data;
}
