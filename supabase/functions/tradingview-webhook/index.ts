import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type TradingViewPayload = {
  secret?: string;
  webhook_secret?: string;
  botId?: string;
  bot_id?: string;
  userId?: string;
  user_id?: string;
  side?: string;
  signal?: string;
  action?: string;
  mode?: string;
  trade_mode?: string;
  size?: number;
  size_multiplier?: number;
  leverage?: number;
  reason?: string;
  note?: string;
  strategy?: string;
  trigger_execution?: boolean;
};

function normalizeSide(rawSide: string | undefined): "buy" | "sell" | null {
  if (!rawSide) return null;
  const side = rawSide.toLowerCase();
  if (side === "buy" || side === "long") return "buy";
  if (side === "sell" || side === "short") return "sell";
  return null;
}

function normalizeMode(rawMode: string | undefined): "real" | "paper" {
  if (!rawMode) return "real";
  const mode = rawMode.toLowerCase();
  if (["paper", "paper_trading", "test", "demo"].includes(mode)) {
    return "paper";
  }
  return "real";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const tradingViewSecret = Deno.env.get("TRADINGVIEW_WEBHOOK_SECRET") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing Supabase configuration env vars");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let payload: TradingViewPayload;
  try {
    const rawBody = await req.text();
    if (!rawBody) {
      throw new Error("Empty request body");
    }
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("⚠️ TradingView payload not valid JSON, attempting fallback parsing");
      payload = JSON.parse(rawBody.replace(/'/g, "\""));
    }
  } catch (parseError) {
    console.error("❌ Failed to parse TradingView payload:", parseError);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const headerSecret =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-tradingview-secret") ??
    "";
  const providedSecret =
    headerSecret ||
    payload.secret ||
    payload.webhook_secret ||
    "";

  const botId = payload.botId || payload.bot_id;

  if (!botId) {
    return new Response(JSON.stringify({ error: "botId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: bot, error: botError } = await supabaseClient
    .from("trading_bots")
    .select("id, user_id, name, status, paper_trading, trade_amount, webhook_secret, webhook_trigger_immediate")
    .eq("id", botId)
    .single();

  if (botError || !bot) {
    console.error("❌ Trading bot not found for webhook", botError);
    return new Response(JSON.stringify({ error: "Bot not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const allowedSecrets = [tradingViewSecret, bot.webhook_secret].filter(
    (secret): secret is string => Boolean(secret && secret.length > 0)
  );

  if (allowedSecrets.length === 0) {
    console.error("❌ No webhook secret configured for TradingView webhook");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!providedSecret || !allowedSecrets.includes(providedSecret)) {
    console.warn("⚠️ Invalid TradingView webhook secret provided");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const normalizedSide = normalizeSide(payload.side || payload.signal || payload.action);
  const mode = normalizeMode(payload.mode || payload.trade_mode);
  const sizeMultiplier =
    typeof payload.size_multiplier === "number"
      ? payload.size_multiplier
      : typeof payload.size === "number"
      ? payload.size
      : undefined;

  if (!normalizedSide) {
    return new Response(JSON.stringify({ error: "side must be one of buy/sell/long/short" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const userIdOverride = payload.userId || payload.user_id;
    if (userIdOverride && userIdOverride !== bot.user_id) {
      return new Response(JSON.stringify({ error: "botId and userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const shouldTrigger =
      typeof payload.trigger_execution === "boolean"
        ? payload.trigger_execution
        : bot.webhook_trigger_immediate ?? true;

    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.secret;
    delete sanitizedPayload.webhook_secret;

    await supabaseClient
      .from("bot_activity_logs")
      .insert({
        bot_id: bot.id,
        level: "info",
        category: "webhook",
        message: `TradingView signal received: ${normalizedSide.toUpperCase()} (${mode.toUpperCase()})`,
        details: {
          ...sanitizedPayload,
          mode,
          size_multiplier: sizeMultiplier,
          source: "tradingview-webhook",
          received_at: new Date().toISOString(),
          trigger_execution: shouldTrigger
        },
        timestamp: new Date().toISOString()
      });

    const { data: signal, error: insertError } = await supabaseClient
      .from("manual_trade_signals")
      .insert({
        bot_id: bot.id,
        user_id: bot.user_id,
        mode,
        side: normalizedSide,
        size_multiplier: sizeMultiplier,
        reason: payload.reason || payload.note || payload.strategy || "TradingView alert trigger"
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Failed to record manual trade signal:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue trade signal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let triggerResponse: { ok: boolean; status: number; message?: string } | null = null;

    if (shouldTrigger && cronSecret) {
      try {
        const triggerFetch = await fetch(`${supabaseUrl}/functions/v1/bot-executor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": cronSecret
          },
          body: JSON.stringify({
            action: "execute_bot",
            botId: bot.id
          })
        });

        const triggerText = await triggerFetch.text();
        triggerResponse = {
          ok: triggerFetch.ok,
          status: triggerFetch.status,
          message: triggerText
        };
      } catch (triggerError) {
        console.error("⚠️ Failed to trigger immediate bot execution:", triggerError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      mode,
      side: normalizedSide,
      signalId: signal?.id,
      bot: { id: bot.id, name: bot.name },
      trigger: triggerResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ TradingView webhook processing error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

