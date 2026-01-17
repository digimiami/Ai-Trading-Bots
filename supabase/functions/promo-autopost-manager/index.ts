// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const DEFAULT_SETTINGS = {
  enabled: false,
  min_win_rate: 60,
  min_pnl: 100,
  lookback_days: 7,
  include_bot_settings: true,
  include_all_users: true,
};

type PromoSettings = typeof DEFAULT_SETTINGS;

type PromoTarget = {
  id: string;
  label: string;
  platform: "telegram";
  bot_token: string;
  chat_id: string;
  enabled: boolean;
};

type BotRow = {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  exchange: string;
  trading_type: string;
  status: string;
  leverage?: number | null;
  trade_amount?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  risk_level?: string | null;
  timeframe?: string | null;
  strategy_config?: any;
  ai_ml_enabled?: boolean | null;
  use_ml?: boolean | null;
  paper_trading?: boolean | null;
};

type BotStats = {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalPnL: number;
  totalFees: number;
};

type EligibleBot = BotRow & BotStats;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatCurrency = (value: number) => {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
};

const formatWinRate = (value: number) => `${value.toFixed(1)}%`;

const buildSettingsLines = (bot: BotRow) => {
  const lines: string[] = [];
  if (bot.leverage) lines.push(`Leverage: ${bot.leverage}x`);
  if (bot.trade_amount) lines.push(`Trade Amount: $${bot.trade_amount}`);
  if (bot.stop_loss !== null && bot.stop_loss !== undefined) {
    lines.push(`Stop Loss: ${bot.stop_loss}%`);
  }
  if (bot.take_profit !== null && bot.take_profit !== undefined) {
    lines.push(`Take Profit: ${bot.take_profit}%`);
  }
  if (bot.timeframe) lines.push(`Timeframe: ${bot.timeframe}`);
  if (bot.risk_level) lines.push(`Risk: ${bot.risk_level}`);
  const mlEnabled = bot.ai_ml_enabled || bot.use_ml;
  if (mlEnabled !== undefined) lines.push(`ML: ${mlEnabled ? "On" : "Off"}`);
  return lines;
};

const buildBotCardSvg = (bot: EligibleBot) => {
  const pnlColor = bot.totalPnL >= 0 ? "#22c55e" : "#ef4444";
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg)" rx="24"/>
  <text x="40" y="70" fill="#e2e8f0" font-size="28" font-family="Arial, sans-serif" font-weight="bold">
    PabloBots Share Card
  </text>
  <text x="40" y="120" fill="#ffffff" font-size="36" font-family="Arial, sans-serif" font-weight="bold">
    ${escapeHtml(bot.name)}
  </text>
  <text x="40" y="165" fill="#94a3b8" font-size="22" font-family="Arial, sans-serif">
    ${escapeHtml(bot.symbol)} • ${escapeHtml(bot.exchange)} • ${escapeHtml(bot.trading_type)}
  </text>
  <text x="40" y="230" fill="${pnlColor}" font-size="48" font-family="Arial, sans-serif" font-weight="bold">
    ${formatCurrency(bot.totalPnL)}
  </text>
  <text x="40" y="270" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif">
    7d PnL
  </text>
  <text x="320" y="230" fill="#38bdf8" font-size="36" font-family="Arial, sans-serif" font-weight="bold">
    ${formatWinRate(bot.winRate)}
  </text>
  <text x="320" y="270" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif">
    Win Rate (${bot.winTrades}W / ${bot.lossTrades}L)
  </text>
  <text x="40" y="340" fill="#e2e8f0" font-size="22" font-family="Arial, sans-serif">
    Trades: ${bot.totalTrades}
  </text>
  <text x="40" y="390" fill="#94a3b8" font-size="18" font-family="Arial, sans-serif">
    Auto-shared by PabloBots Admin
  </text>
</svg>`;
};

const buildPerformanceCardSvg = (bot: EligibleBot, lookbackDays: number) => {
  const pnlColor = bot.totalPnL >= 0 ? "#22c55e" : "#ef4444";
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
  <defs>
    <linearGradient id="bg2" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg2)" rx="24"/>
  <text x="40" y="70" fill="#f8fafc" font-size="28" font-family="Arial, sans-serif" font-weight="bold">
    Bot Performance (${lookbackDays}d)
  </text>
  <text x="40" y="130" fill="#ffffff" font-size="32" font-family="Arial, sans-serif" font-weight="bold">
    ${escapeHtml(bot.symbol)}
  </text>
  <text x="40" y="175" fill="#94a3b8" font-size="20" font-family="Arial, sans-serif">
    ${escapeHtml(bot.exchange)} • ${escapeHtml(bot.trading_type)}
  </text>
  <text x="40" y="245" fill="${pnlColor}" font-size="46" font-family="Arial, sans-serif" font-weight="bold">
    ${formatCurrency(bot.totalPnL)}
  </text>
  <text x="40" y="285" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif">
    Total PnL • Fees: $${bot.totalFees.toFixed(2)}
  </text>
  <text x="40" y="350" fill="#38bdf8" font-size="32" font-family="Arial, sans-serif" font-weight="bold">
    ${formatWinRate(bot.winRate)}
  </text>
  <text x="40" y="390" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif">
    ${bot.totalTrades} trades in last ${lookbackDays} days
  </text>
</svg>`;
};

const buildCaption = (bot: EligibleBot, includeSettings: boolean) => {
  const lines = [
    `<b>${escapeHtml(bot.name)}</b> (${escapeHtml(bot.symbol)})`,
    `7d Win Rate: <b>${formatWinRate(bot.winRate)}</b>`,
    `7d PnL: <b>${formatCurrency(bot.totalPnL)}</b>`,
    `Trades: ${bot.totalTrades}`,
  ];
  if (includeSettings) {
    const settings = buildSettingsLines(bot);
    if (settings.length > 0) {
      lines.push("", "<b>Settings</b>");
      settings.forEach((line) => lines.push(escapeHtml(line)));
    }
  }
  return lines.join("\n");
};

const sendTelegramMessage = async (target: PromoTarget, message: string) => {
  const response = await fetch(
    `https://api.telegram.org/bot${target.bot_token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target.chat_id,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram message");
  }
  return result;
};

const loadEligibleBots = async (
  client: any,
  settings: PromoSettings,
): Promise<EligibleBot[]> => {
  if (!settings.include_all_users) {
    return [];
  }
  const lookbackDays = settings.lookback_days || DEFAULT_SETTINGS.lookback_days;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const { data: bots, error: botsError } = await client
    .from("trading_bots")
    .select(
      "id, user_id, name, symbol, exchange, trading_type, status, leverage, trade_amount, stop_loss, take_profit, risk_level, timeframe, strategy_config, ai_ml_enabled, use_ml, paper_trading",
    )
    .in("status", ["running", "active"])
    .eq("paper_trading", false);

  if (botsError) throw botsError;

  const { data: positions, error: positionsError } = await client
    .from("trading_positions")
    .select("bot_id, realized_pnl, fees, closed_at")
    .eq("status", "closed")
    .gte("closed_at", since.toISOString());

  if (positionsError) throw positionsError;

  const statsByBot = new Map<string, BotStats>();
  for (const row of positions || []) {
    const botId = row.bot_id as string;
    const realized = Number(row.realized_pnl || 0);
    const fees = Number(row.fees || 0);
    const stats = statsByBot.get(botId) || {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalFees: 0,
    };
    stats.totalTrades += 1;
    if (realized > 0) stats.winTrades += 1;
    else stats.lossTrades += 1;
    stats.totalPnL += realized;
    stats.totalFees += fees;
    statsByBot.set(botId, stats);
  }

  const eligible: EligibleBot[] = [];
  for (const bot of bots || []) {
    const stats = statsByBot.get(bot.id);
    if (!stats || stats.totalTrades === 0) continue;
    const winRate = (stats.winTrades / stats.totalTrades) * 100;
    const totalPnL = stats.totalPnL;
    if (winRate >= settings.min_win_rate && totalPnL >= settings.min_pnl) {
      eligible.push({
        ...(bot as BotRow),
        ...stats,
        winRate,
      });
    }
  }

  return eligible;
};

const logResult = async (
  client: any,
  payload: {
    target_id?: string | null;
    bot_id?: string | null;
    user_id?: string | null;
    status: string;
    message?: string | null;
    error_message?: string | null;
    payload?: any;
    sent_at?: string | null;
  },
) => {
  await client.from("promo_autopost_logs").insert({
    target_id: payload.target_id,
    bot_id: payload.bot_id,
    user_id: payload.user_id,
    status: payload.status,
    message: payload.message,
    error_message: payload.error_message,
    payload: payload.payload,
    sent_at: payload.sent_at,
  });
};

const verifyAdmin = async (supabaseClient: any, token: string) => {
  const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
  if (authError || !userData?.user) {
    throw new Error("Unauthorized");
  }
  const { data: roleData, error: roleError } = await supabaseClient
    .from("users")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (roleError || roleData?.role !== "admin") {
    throw new Error("Admin access required");
  }
  return userData.user;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    await verifyAdmin(supabaseClient, token);

    let action: string | null = null;
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
      action = body.action || null;
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      action = url.searchParams.get("action");
    }

    if (!action) {
      return new Response(JSON.stringify({ error: "Action parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "getSettings": {
        const { data, error } = await supabaseClient
          .from("promo_autopost_settings")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          return new Response(JSON.stringify({ settings: data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: created, error: insertError } = await supabaseClient
          .from("promo_autopost_settings")
          .insert(DEFAULT_SETTINGS)
          .select()
          .single();
        if (insertError) throw insertError;
        return new Response(JSON.stringify({ settings: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "saveSettings": {
        const updates = {
          enabled: body.enabled ?? DEFAULT_SETTINGS.enabled,
          min_win_rate: body.min_win_rate ?? DEFAULT_SETTINGS.min_win_rate,
          min_pnl: body.min_pnl ?? DEFAULT_SETTINGS.min_pnl,
          lookback_days: body.lookback_days ?? DEFAULT_SETTINGS.lookback_days,
          include_bot_settings: body.include_bot_settings ?? DEFAULT_SETTINGS.include_bot_settings,
          include_all_users: body.include_all_users ?? DEFAULT_SETTINGS.include_all_users,
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabaseClient
          .from("promo_autopost_settings")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          const { data: updated, error } = await supabaseClient
            .from("promo_autopost_settings")
            .update(updates)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ settings: updated }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: created, error } = await supabaseClient
          .from("promo_autopost_settings")
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ settings: created }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "listTargets": {
        const { data, error } = await supabaseClient
          .from("promo_autopost_targets")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ targets: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "upsertTarget": {
        const payload = {
          label: body.label,
          platform: "telegram",
          bot_token: body.bot_token,
          chat_id: body.chat_id,
          enabled: body.enabled ?? true,
          updated_at: new Date().toISOString(),
        };
        if (!payload.label || !payload.bot_token || !payload.chat_id) {
          return new Response(JSON.stringify({ error: "label, bot_token, chat_id are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (body.id) {
          const { data, error } = await supabaseClient
            .from("promo_autopost_targets")
            .update(payload)
            .eq("id", body.id)
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify({ target: data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabaseClient
          .from("promo_autopost_targets")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ target: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "deleteTarget": {
        if (!body.id) {
          return new Response(JSON.stringify({ error: "id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabaseClient
          .from("promo_autopost_targets")
          .delete()
          .eq("id", body.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "previewEligibleBots": {
        const settings = {
          enabled: body.enabled ?? DEFAULT_SETTINGS.enabled,
          min_win_rate: body.min_win_rate ?? DEFAULT_SETTINGS.min_win_rate,
          min_pnl: body.min_pnl ?? DEFAULT_SETTINGS.min_pnl,
          lookback_days: body.lookback_days ?? DEFAULT_SETTINGS.lookback_days,
          include_bot_settings: body.include_bot_settings ?? DEFAULT_SETTINGS.include_bot_settings,
          include_all_users: body.include_all_users ?? DEFAULT_SETTINGS.include_all_users,
        };
        const eligibleBots = await loadEligibleBots(supabaseClient, settings);
        const preview = eligibleBots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          symbol: bot.symbol,
          exchange: bot.exchange,
          winRate: bot.winRate,
          totalPnL: bot.totalPnL,
          totalTrades: bot.totalTrades,
        }));
        return new Response(JSON.stringify({ bots: preview }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "runNow": {
        const { data: settingsRow, error } = await supabaseClient
          .from("promo_autopost_settings")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        const settings: PromoSettings = {
          enabled: settingsRow?.enabled ?? DEFAULT_SETTINGS.enabled,
          min_win_rate: Number(settingsRow?.min_win_rate ?? DEFAULT_SETTINGS.min_win_rate),
          min_pnl: Number(settingsRow?.min_pnl ?? DEFAULT_SETTINGS.min_pnl),
          lookback_days: Number(settingsRow?.lookback_days ?? DEFAULT_SETTINGS.lookback_days),
          include_bot_settings: settingsRow?.include_bot_settings ?? DEFAULT_SETTINGS.include_bot_settings,
          include_all_users: settingsRow?.include_all_users ?? DEFAULT_SETTINGS.include_all_users,
        };

        const { data: targets, error: targetsError } = await supabaseClient
          .from("promo_autopost_targets")
          .select("*")
          .eq("platform", "telegram")
          .eq("enabled", true)
          .order("created_at", { ascending: true });
        if (targetsError) throw targetsError;
        const eligibleBots = await loadEligibleBots(supabaseClient, settings);
        const results: any[] = [];

        for (const bot of eligibleBots) {
          const caption = buildCaption(bot, settings.include_bot_settings);

          for (const target of (targets || []) as PromoTarget[]) {
            try {
              await sendTelegramMessage(target, caption);

              await logResult(supabaseClient, {
                target_id: target.id,
                bot_id: bot.id,
                user_id: bot.user_id,
                status: "sent",
                message: "Promo auto-post sent (manual run)",
                sent_at: new Date().toISOString(),
                payload: { caption },
              });
              results.push({ bot_id: bot.id, target_id: target.id, status: "sent" });
            } catch (sendError: any) {
              await logResult(supabaseClient, {
                target_id: target.id,
                bot_id: bot.id,
                user_id: bot.user_id,
                status: "failed",
                error_message: sendError?.message || String(sendError),
                payload: { caption },
              });
              results.push({
                bot_id: bot.id,
                target_id: target.id,
                status: "failed",
                error: sendError?.message || String(sendError),
              });
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            eligibleBots: eligibleBots.length,
            targets: (targets || []).length,
            results,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("promo-autopost-manager error:", error);
    const status = error.message === "Admin access required" ? 403 : error.message === "Unauthorized" ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
