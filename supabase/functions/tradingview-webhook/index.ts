import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tradingview-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400" // 24 hours
};

type TradingViewPayload = {
  secret?: string;
  webhook_secret?: string;
  botId?: string;
  bot_id?: string;
  signalToken?: string;
  signal_token?: string;
  signalKey?: string;
  signal_key?: string;
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
  instrument?: string;
  ticker?: string;
  symbol?: string;
  amount?: number | string;
  marketPosition?: string;
  market_position?: string;
  prevMarketPosition?: string;
  prev_market_position?: string;
  marketPositionSize?: number | string;
  market_position_size?: number | string;
};

function resolveAmountFromPayload(payload: TradingViewPayload): number | null {
  const candidates: Array<number | string | undefined> = [
    payload.amount,
    payload.size,
    payload.size_multiplier,
    payload.marketPositionSize,
    payload.market_position_size
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const parsed = parseFloat(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function resolveSideFromAction(payload: TradingViewPayload): "buy" | "sell" | null {
  const candidates = [
    payload.side,
    payload.signal,
    payload.action,
    payload.marketPosition,
    payload.market_position
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const action = raw.toLowerCase();
    if (["buy", "long", "enter_long", "entry_long"].includes(action)) return "buy";
    if (["sell", "short", "enter_short", "entry_short", "sellshort"].includes(action)) return "sell";
    if (["close", "exit", "flat"].includes(action)) {
      const prev = (payload.prevMarketPosition || payload.prev_market_position || "").toLowerCase();
      if (prev === "long") return "sell";
      if (prev === "short") return "buy";
    }
  }

  return null;
}

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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
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

  const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
  
  // Record webhook call attempt IMMEDIATELY - before any processing
  let webhookCallId: string | null = null;
  const webhookCallStartTime = Date.now();
  let rawBody = "";
  
  // Capture request metadata for logging
  const requestHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });
  
  const requestMetadata = {
    method: req.method,
    url: req.url,
    headers: requestHeaders,
    timestamp: new Date().toISOString(),
    userAgent: req.headers.get("user-agent") || "unknown",
    origin: req.headers.get("origin") || "unknown",
    referer: req.headers.get("referer") || "unknown"
  };
  
  console.log("📥 Incoming webhook request:", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    userAgent: requestMetadata.userAgent,
    origin: requestMetadata.origin,
    timestamp: requestMetadata.timestamp
  });
  
  try {
    rawBody = await req.text();
    console.log("📦 Raw body received:", {
      length: rawBody.length,
      preview: rawBody.substring(0, 200),
      contentType: req.headers.get("content-type")
    });
  } catch (error) {
    console.error("❌ Failed to read request body:", error);
    
    // Record failed webhook call immediately
    try {
      const { data: failedCall } = await supabaseClient
        .from("webhook_calls")
        .insert({
          raw_payload: { 
            raw: "", 
            error: "Failed to read request body",
            metadata: requestMetadata
          },
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          response_status: 400,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      webhookCallId = failedCall?.id || null;
      console.log("📝 Recorded failed webhook call (read error):", webhookCallId);
    } catch (recordError) {
      console.error("❌ Failed to record webhook call:", recordError);
    }
    
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Record webhook call IMMEDIATELY with raw body (before parsing)
  if (!webhookCallId) {
    try {
      const { data: recordedCall } = await supabaseClient
        .from("webhook_calls")
        .insert({
          raw_payload: { 
            raw: rawBody,
            length: rawBody.length,
            contentType: req.headers.get("content-type") || "unknown",
            metadata: requestMetadata
          },
          status: "processing",
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      webhookCallId = recordedCall?.id || null;
      console.log("📝 Recorded incoming webhook call:", webhookCallId);
    } catch (recordError) {
      console.error("❌ Failed to record webhook call (initial):", recordError);
      // Continue processing even if recording fails
    }
  }
  
  let payload: TradingViewPayload;
  try {
    if (!rawBody) {
      throw new Error("Empty request body");
    }
    
    const contentType = req.headers.get("content-type") || "";
    console.log("🔍 Parsing payload, content-type:", contentType);
    
    // Handle different content types
    if (contentType.includes("application/json")) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        console.warn("⚠️ JSON parse failed, attempting fallback");
        payload = JSON.parse(rawBody.replace(/'/g, "\""));
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      // Handle form-encoded data
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params) as TradingViewPayload;
      console.log("📋 Parsed form-encoded payload:", payload);
    } else if (contentType.includes("text/plain") || contentType === "") {
      // TradingView might send plain text or no content-type
      // Try JSON first, then fallback to text parsing
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // If not JSON, try to extract key-value pairs from text
        console.warn("⚠️ Plain text payload, attempting to parse as JSON or extract fields");
        try {
          payload = JSON.parse(rawBody.replace(/'/g, "\""));
        } catch {
          // Last resort: create a minimal payload from text
          payload = {
            raw_text: rawBody,
            side: rawBody.toLowerCase().includes("buy") || rawBody.toLowerCase().includes("long") ? "buy" : 
                  rawBody.toLowerCase().includes("sell") || rawBody.toLowerCase().includes("short") ? "sell" : undefined
          } as TradingViewPayload;
          console.warn("⚠️ Created minimal payload from plain text:", payload);
        }
      }
    } else {
      // Unknown content type, try JSON anyway
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = JSON.parse(rawBody.replace(/'/g, "\""));
      }
    }
    
    console.log("✅ Parsed payload:", {
      hasBotId: !!(payload.botId || payload.bot_id),
      hasSide: !!(payload.side || payload.signal || payload.action),
      hasSecret: !!(payload.secret || payload.webhook_secret),
      keys: Object.keys(payload)
    });
  } catch (parseError) {
    console.error("❌ Failed to parse TradingView payload:", parseError);
    
    // Update webhook call record with error
    if (webhookCallId) {
      try {
        await supabaseClient
          .from("webhook_calls")
          .update({
            parsed_payload: { error: "Parse failed", raw: rawBody },
            status: "failed",
            error_message: parseError instanceof Error ? parseError.message : String(parseError),
            response_status: 400,
            processed_at: new Date().toISOString()
          })
          .eq("id", webhookCallId);
        console.log("📝 Updated webhook call record with parse error:", webhookCallId);
      } catch (recordError) {
        console.error("❌ Failed to update webhook call record:", recordError);
      }
    } else {
      // Record if we didn't record earlier
      try {
        const { data: failedCall } = await supabaseClient
          .from("webhook_calls")
          .insert({
            raw_payload: { raw: rawBody, error: "Invalid JSON", metadata: requestMetadata },
            status: "failed",
            error_message: parseError instanceof Error ? parseError.message : String(parseError),
            response_status: 400
          })
          .select()
          .single();
        webhookCallId = failedCall?.id || null;
      } catch (recordError) {
        console.error("❌ Failed to record webhook call:", recordError);
      }
    }
    
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
  const signalToken =
    payload.signalToken ||
    payload.signal_token ||
    payload.signalKey ||
    payload.signal_key ||
    "";

  if (!botId) {
    console.warn("⚠️ No botId found in payload:", payload);
    
    // Update webhook call record with error
    if (webhookCallId) {
      try {
        await supabaseClient
          .from("webhook_calls")
          .update({
            parsed_payload: payload,
            status: "failed",
            error_message: "botId is required",
            response_status: 400,
            processed_at: new Date().toISOString()
          })
          .eq("id", webhookCallId);
        console.log("📝 Updated webhook call record (no botId):", webhookCallId);
      } catch (recordError) {
        console.error("❌ Failed to update webhook call record:", recordError);
      }
    } else {
      // Record webhook call without botId
      try {
        const { data: failedCall } = await supabaseClient
          .from("webhook_calls")
          .insert({
            raw_payload: { raw: rawBody, metadata: requestMetadata },
            parsed_payload: payload,
            status: "failed",
            error_message: "botId is required",
            response_status: 400
          })
          .select()
          .single();
        webhookCallId = failedCall?.id || null;
      } catch (recordError) {
        console.error("❌ Failed to record webhook call:", recordError);
      }
    }
    
    return new Response(JSON.stringify({ error: "botId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let bot: any = null;
  let template: any = null;

  if (botId) {
    const { data: botData, error: botError } = await supabaseClient
      .from("trading_bots")
      .select("id, user_id, name, status, paper_trading, trade_amount, webhook_secret, webhook_trigger_immediate")
      .eq("id", botId)
      .single();

    if (botError || !botData) {
      console.error("❌ Trading bot not found for webhook", botError);
      return new Response(JSON.stringify({ error: "Bot not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    bot = botData;
  } else if (signalToken) {
    const { data: templateData, error: templateError } = await supabaseClient
      .from("signal_templates")
      .select("id, user_id, name, mode, trade_amount, leverage, default_symbol, linked_bot_id, active")
      .eq("signal_token", signalToken)
      .eq("active", true)
      .single();

    if (templateError || !templateData) {
      console.warn("⚠️ Signal template not found or inactive for token");
      return new Response(JSON.stringify({ error: "Signal template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    template = templateData;

    if (template.linked_bot_id) {
      const { data: linkedBot, error: linkedBotError } = await supabaseClient
        .from("trading_bots")
        .select("id, user_id, name, status, paper_trading, trade_amount, webhook_secret, webhook_trigger_immediate")
        .eq("id", template.linked_bot_id)
        .single();

      if (linkedBotError || !linkedBot) {
        console.error("❌ Linked bot missing for signal template", linkedBotError);
        return new Response(JSON.stringify({ error: "Linked bot not found for template" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      bot = linkedBot;
    }
  } else {
    return new Response(JSON.stringify({ error: "botId or signalToken required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const allowedSecrets = [tradingViewSecret, bot?.webhook_secret].filter(
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
    console.warn("⚠️ Invalid TradingView webhook secret provided", {
      provided: providedSecret ? "***" : "empty",
      allowedCount: allowedSecrets.length,
      botId
    });
    
    // Update webhook call record with auth error
    if (webhookCallId) {
      try {
        await supabaseClient
          .from("webhook_calls")
          .update({
            parsed_payload: payload,
            secret_provided: providedSecret ? "***" : null,
            secret_valid: false,
            bot_found: !!bot,
            bot_id: bot?.id || null,
            status: "failed",
            error_message: "Unauthorized: Invalid webhook secret",
            response_status: 401,
            processed_at: new Date().toISOString()
          })
          .eq("id", webhookCallId);
        console.log("📝 Updated webhook call record (unauthorized):", webhookCallId);
      } catch (recordError) {
        console.error("❌ Failed to update webhook call record:", recordError);
      }
    } else {
      // Record if we didn't record earlier
      try {
        const { data: failedCall } = await supabaseClient
          .from("webhook_calls")
          .insert({
            raw_payload: { raw: rawBody, metadata: requestMetadata },
            parsed_payload: payload,
            secret_provided: providedSecret ? "***" : null,
            secret_valid: false,
            bot_found: !!bot,
            bot_id: bot?.id || null,
            status: "failed",
            error_message: "Unauthorized: Invalid webhook secret",
            response_status: 401
          })
          .select()
          .single();
        webhookCallId = failedCall?.id || null;
      } catch (recordError) {
        console.error("❌ Failed to record webhook call:", recordError);
      }
    }
    
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const resolvedAmount = resolveAmountFromPayload(payload);
  const normalizedSide =
    resolveSideFromAction(payload) ||
    normalizeSide(payload.side || payload.signal || payload.action);
  let mode = normalizeMode(payload.mode || payload.trade_mode);
  if (template) {
    mode = template.mode === "paper" ? "paper" : "real";
  }
  const sizeMultiplier =
    typeof payload.size_multiplier === "number"
      ? payload.size_multiplier
      : resolvedAmount !== null
      ? resolvedAmount
      : undefined;

  if (!normalizedSide) {
    return new Response(JSON.stringify({ error: "side must be one of buy/sell/long/short" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const userIdOverride = payload.userId || payload.user_id;
    const ownerId = bot ? bot.user_id : template?.user_id;
    if (userIdOverride && ownerId && userIdOverride !== ownerId) {
      return new Response(JSON.stringify({ error: "botId and userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const shouldTrigger =
      typeof payload.trigger_execution === "boolean"
        ? payload.trigger_execution
        : bot
        ? bot.webhook_trigger_immediate ?? true
        : true;

    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.secret;
    delete sanitizedPayload.webhook_secret;

    if (bot) {
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
            source: template ? "signal-template" : "tradingview-webhook",
            template_id: template?.id,
            received_at: new Date().toISOString(),
            trigger_execution: shouldTrigger
          },
          timestamp: new Date().toISOString()
        });
    }

    let signal = null;
    let signalEvent = null;

    if (template) {
      const { data: eventData, error: eventError } = await supabaseClient
        .from("signal_events")
        .insert({
          template_id: template.id,
          user_id: template.user_id,
          raw_payload: sanitizedPayload,
          action: normalizedSide,
          amount: resolvedAmount,
          mode: mode,
          status: bot ? "pending" : "ignored",
          notes: {
            instrument: payload.instrument || payload.ticker || payload.symbol,
            id: payload.id || payload.signal_id || payload.strategy?.id
          }
        })
        .select()
        .single();

      if (eventError || !eventData) {
        console.error("❌ Failed to record signal event:", eventError);
        return new Response(JSON.stringify({ error: "Failed to record signal event" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      signalEvent = eventData;

      if (!bot) {
        return new Response(JSON.stringify({
          success: true,
          mode,
          side: normalizedSide,
          signalEventId: signalEvent.id,
          message: "Signal recorded. No linked bot configured for execution."
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const { data: manualSignal, error: insertError } = await supabaseClient
      .from("manual_trade_signals")
      .insert({
        bot_id: bot.id,
        user_id: bot.user_id,
        mode,
        side: normalizedSide,
        size_multiplier: sizeMultiplier,
        reason: payload.reason || payload.note || payload.strategy || "TradingView alert trigger",
        metadata: {
          signalToken: signalToken || null,
          templateId: template?.id || null,
          sourcePayloadId: payload.id || payload.signal_id || null,
          requestedAmount: resolvedAmount
        }
      })
      .select()
      .single();

    if (insertError || !manualSignal) {
      if (signalEvent) {
        await supabaseClient
          .from("signal_events")
          .update({
            status: "failed",
            error: insertError?.message || "Failed to queue manual trade signal"
          })
          .eq("id", signalEvent.id);
      }
      console.error("❌ Failed to record manual trade signal:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue trade signal" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    signal = manualSignal;

    if (signalEvent) {
      await supabaseClient
        .from("signal_events")
        .update({
          status: "pending",
          linked_signal_id: manualSignal.id
        })
        .eq("id", signalEvent.id);
    }

    let triggerResponse: { ok: boolean; status: number; message?: string } | null = null;

    if (shouldTrigger) {
      try {
        // Always try to use x-cron-secret if available (preferred method)
        // If not available, we'll still try but it may fail if CRON_SECRET is not set in bot-executor
        const headers: Record<string, string> = {
          "Content-Type": "application/json"
        };
        
        if (cronSecret) {
          headers["x-cron-secret"] = cronSecret;
          console.log(`🚀 Triggering immediate bot execution for bot ${bot.id} using x-cron-secret...`);
        } else {
          // Fallback: Use service role key as Authorization header
          // Note: This requires bot-executor to accept service role key
          headers["Authorization"] = `Bearer ${serviceRoleKey}`;
          console.log(`🚀 Triggering immediate bot execution for bot ${bot.id} using service role key...`);
          console.warn(`⚠️ CRON_SECRET not set - using service role key. Ensure bot-executor accepts this.`);
        }
        
        const triggerFetch = await fetch(`${supabaseUrl}/functions/v1/bot-executor`, {
          method: "POST",
          headers,
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
        
        if (triggerFetch.ok) {
          console.log(`✅ Bot execution triggered successfully for bot ${bot.id}`);
        } else {
          console.error(`❌ Bot execution trigger failed: ${triggerFetch.status} - ${triggerText}`);
        }
      } catch (triggerError) {
        console.error("⚠️ Failed to trigger immediate bot execution:", triggerError);
        triggerResponse = {
          ok: false,
          status: 0,
          message: triggerError instanceof Error ? triggerError.message : String(triggerError)
        };
      }
    } else {
      console.log(`ℹ️ Immediate execution disabled for bot ${bot.id}. Signal will be processed on next bot execution cycle.`);
    }

    // Record successful webhook call (update existing or insert new)
    const responseBody = {
      success: true,
      mode,
      side: normalizedSide,
      signalId: signal?.id,
      bot: bot ? { id: bot.id, name: bot.name } : null,
      template: template ? { id: template.id, name: template.name } : null,
      signalEventId: signalEvent?.id,
      trigger: triggerResponse
    };
    
    try {
      if (webhookCallId) {
        // Update existing record
        await supabaseClient
          .from("webhook_calls")
          .update({
            parsed_payload: payload,
            secret_provided: providedSecret ? "***" : null,
            secret_valid: true,
            bot_found: !!bot,
            bot_id: bot?.id || null,
            user_id: bot?.user_id || template?.user_id || null,
            side: normalizedSide,
            mode,
            status: "processed",
            response_status: 200,
            response_body: responseBody,
            signal_id: signal?.id || null,
            trigger_executed: shouldTrigger,
            trigger_response: triggerResponse,
            processed_at: new Date().toISOString()
          })
          .eq("id", webhookCallId);
        console.log("📝 Updated webhook call record (success):", webhookCallId);
      } else {
        // Insert new record (shouldn't happen, but just in case)
        const { data: newCall } = await supabaseClient
          .from("webhook_calls")
          .insert({
            bot_id: bot?.id || null,
            user_id: bot?.user_id || template?.user_id || null,
            raw_payload: { raw: rawBody, metadata: requestMetadata },
            parsed_payload: payload,
            secret_provided: providedSecret ? "***" : null,
            secret_valid: true,
            bot_found: !!bot,
            side: normalizedSide,
            mode,
            status: "processed",
            response_status: 200,
            response_body: responseBody,
            signal_id: signal?.id || null,
            trigger_executed: shouldTrigger,
            trigger_response: triggerResponse,
            processed_at: new Date().toISOString()
          })
          .select()
          .single();
        webhookCallId = newCall?.id || null;
        console.log("📝 Inserted webhook call record (success):", webhookCallId);
      }
    } catch (recordError) {
      console.error("❌ Failed to record webhook call:", recordError);
    }
    
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ TradingView webhook processing error:", error);
    
    // Record failed webhook call
    try {
      await supabaseClient
        .from("webhook_calls")
        .insert({
          bot_id: bot?.id || null,
          user_id: bot?.user_id || template?.user_id || null,
          raw_payload: { raw: rawBody },
          parsed_payload: payload || null,
          secret_provided: providedSecret ? "***" : null,
          secret_valid: false,
          bot_found: !!bot,
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          response_status: 500
        });
    } catch (recordError) {
      console.error("❌ Failed to record webhook call error:", recordError);
    }
    
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

