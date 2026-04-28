"use client";

export default function SupabaseEnvBanner() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] rounded-lg border border-[#B8860B]/30 bg-white/90 px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-[#1a1a1a]">Supabase env</div>
      <div className="text-[#1a1a1a]/70">URL present: {hasUrl ? "true" : "false"}</div>
      <div className="text-[#1a1a1a]/70">Anon key present: {hasAnon ? "true" : "false"}</div>
    </div>
  );
}
