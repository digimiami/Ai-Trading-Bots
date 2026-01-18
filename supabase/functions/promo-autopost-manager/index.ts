// deno-lint-ignore-file
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import satori from "https://esm.sh/satori@0.10.14";
import { h } from "https://esm.sh/preact@10.19.3";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { encode as b64encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

const CARD_WIDTH = 800;
const CARD_HEIGHT = 450;
const RESVG_WASM_URL = "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const LOGO_URL = "https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/pablobots-logo/logo_no_bg.png";
const QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://pablobots.com";
const FONT_URLS = [
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZNhjQ.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter-Regular.ttf",
  "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter-Medium.ttf",
];

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

let wasmReady: Promise<void> | null = null;
let fontData: ArrayBuffer | null = null;
let logoDataUrl: string | null = null;
let qrDataUrl: string | null = null;

const ensureWasmReady = () => {
  if (!wasmReady) {
    wasmReady = initWasm(fetch(RESVG_WASM_URL));
  }
  return wasmReady;
};

const loadFont = async () => {
  if (fontData) return fontData;
  let lastError: Error | null = null;
  for (const fontUrl of FONT_URLS) {
    try {
      const response = await fetch(fontUrl);
      if (!response.ok) {
        lastError = new Error(`Failed to load font: ${response.status}`);
        continue;
      }
      fontData = await response.arrayBuffer();
      return fontData;
    } catch (error: any) {
      lastError = error;
    }
  }
  throw new Error(lastError?.message || "Failed to load font");
};

const fetchAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  const base64 = b64encode(bytes);
  return `data:${contentType};base64,${base64}`;
};

const loadImages = async () => {
  if (!logoDataUrl) {
    try {
      logoDataUrl = await fetchAsDataUrl(LOGO_URL);
    } catch (error) {
      console.warn("⚠️ Logo load failed:", error);
      logoDataUrl = null;
    }
  }
  if (!qrDataUrl) {
    try {
      qrDataUrl = await fetchAsDataUrl(QR_URL);
    } catch (error) {
      console.warn("⚠️ QR load failed:", error);
      qrDataUrl = null;
    }
  }
  return { logoDataUrl, qrDataUrl };
};

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

const buildBotCardSvg = async (bot: EligibleBot) => {
  const { logoDataUrl, qrDataUrl } = await loadImages();
  const font = await loadFont();
  const pnlColor = bot.totalPnL >= 0 ? "#22c55e" : "#ef4444";

  const svg = await satori(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "36px",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
          color: "#f8fafc",
          fontFamily: "Inter",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px" } },
        logoDataUrl
          ? h("img", { src: logoDataUrl, width: 42, height: 42, style: { borderRadius: "8px" } })
          : h("div", { style: { width: "42px", height: "42px", borderRadius: "8px", backgroundColor: "#ffffff" } }),
        h("div", { style: { fontSize: "20px", fontWeight: 700 } }, "PabloBots"),
      ),
      h(
        "div",
        { style: { marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" } },
        h("div", { style: { fontSize: "30px", fontWeight: 700 } }, bot.name),
        h(
          "div",
          { style: { fontSize: "18px", color: "#94a3b8" } },
          `${bot.symbol} • ${bot.exchange} • ${bot.trading_type}`,
        ),
      ),
      h(
        "div",
        { style: { display: "flex", gap: "24px", marginTop: "12px" } },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { style: { fontSize: "36px", fontWeight: 700, color: pnlColor } }, formatCurrency(bot.totalPnL)),
          h("div", { style: { fontSize: "16px", color: "#e2e8f0" } }, "7d PnL"),
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { style: { fontSize: "28px", fontWeight: 700, color: "#38bdf8" } }, formatWinRate(bot.winRate)),
          h("div", { style: { fontSize: "16px", color: "#e2e8f0" } }, `Win Rate (${bot.winTrades}W / ${bot.lossTrades}L)`),
        ),
      ),
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "10px" } },
        h("div", { style: { fontSize: "18px", color: "#e2e8f0" } }, `Trades: ${bot.totalTrades}`),
        qrDataUrl
          ? h("img", { src: qrDataUrl, width: 120, height: 120, style: { backgroundColor: "#ffffff", padding: "10px", borderRadius: "12px" } })
          : h("div", { style: { width: "120px", height: "120px", borderRadius: "12px", backgroundColor: "#ffffff" } }),
      ),
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        {
          name: "Inter",
          data: font,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );

  return svg;
};

const buildPerformanceCardSvg = async (bot: EligibleBot, lookbackDays: number) => {
  const { logoDataUrl, qrDataUrl } = await loadImages();
  const font = await loadFont();
  const pnlColor = bot.totalPnL >= 0 ? "#22c55e" : "#ef4444";

  const svg = await satori(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "36px",
          background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
          color: "#f8fafc",
          fontFamily: "Inter",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px" } },
        logoDataUrl
          ? h("img", { src: logoDataUrl, width: 42, height: 42, style: { borderRadius: "8px" } })
          : h("div", { style: { width: "42px", height: "42px", borderRadius: "8px", backgroundColor: "#ffffff" } }),
        h("div", { style: { fontSize: "20px", fontWeight: 700 } }, "PabloBots Performance"),
      ),
      h(
        "div",
        { style: { marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" } },
        h("div", { style: { fontSize: "28px", fontWeight: 700 } }, bot.symbol),
        h("div", { style: { fontSize: "18px", color: "#94a3b8" } }, `${bot.exchange} • ${bot.trading_type}`),
      ),
      h(
        "div",
        { style: { display: "flex", gap: "24px", marginTop: "12px" } },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { style: { fontSize: "34px", fontWeight: 700, color: pnlColor } }, formatCurrency(bot.totalPnL)),
          h("div", { style: { fontSize: "16px", color: "#e2e8f0" } }, `Fees: $${bot.totalFees.toFixed(2)}`),
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { style: { fontSize: "26px", fontWeight: 700, color: "#38bdf8" } }, formatWinRate(bot.winRate)),
          h("div", { style: { fontSize: "16px", color: "#e2e8f0" } }, `${bot.totalTrades} trades in ${lookbackDays}d`),
        ),
      ),
      h(
        "div",
        { style: { display: "flex", justifyContent: "flex-end" } },
        qrDataUrl
          ? h("img", { src: qrDataUrl, width: 120, height: 120, style: { backgroundColor: "#ffffff", padding: "10px", borderRadius: "12px" } })
          : h("div", { style: { width: "120px", height: "120px", borderRadius: "12px", backgroundColor: "#ffffff" } }),
      ),
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        {
          name: "Inter",
          data: font,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );

  return svg;
};

const renderSvgToPng = async (svg: string) => {
  await ensureWasmReady();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH },
  });
  return resvg.render().asPng();
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

const sendTelegramPhoto = async (target: PromoTarget, file: { name: string; data: Uint8Array; caption?: string }) => {
  const form = new FormData();
  form.append("chat_id", target.chat_id);
  if (file.caption) {
    form.append("caption", file.caption);
    form.append("parse_mode", "HTML");
  }
  form.append("photo", new Blob([file.data], { type: "image/png" }), `${file.name}.png`);

  const response = await fetch(
    `https://api.telegram.org/bot${target.bot_token}/sendPhoto`,
    {
      method: "POST",
      body: form,
    },
  );
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram photo");
  }
  return result;
};

const sendTelegramMediaGroup = async (
  target: PromoTarget,
  files: { name: string; data: Uint8Array; caption?: string }[],
) => {
  const media = files.map((file, idx) => ({
    type: "photo",
    media: `attach://${file.name}`,
    caption: idx === 0 ? file.caption : undefined,
    parse_mode: idx === 0 ? "HTML" : undefined,
  }));

  const form = new FormData();
  form.append("chat_id", target.chat_id);
  form.append("media", JSON.stringify(media));
  files.forEach((file) => {
    form.append(file.name, new Blob([file.data], { type: "image/png" }), `${file.name}.png`);
  });

  const response = await fetch(
    `https://api.telegram.org/bot${target.bot_token}/sendMediaGroup`,
    {
      method: "POST",
      body: form,
    },
  );
  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram media group");
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
          let botCard: Uint8Array | null = null;
          let performanceCard: Uint8Array | null = null;
          let renderErrorMessage: string | null = null;

          try {
            const [botSvg, performanceSvg] = await Promise.all([
              buildBotCardSvg(bot),
              buildPerformanceCardSvg(bot, settings.lookback_days),
            ]);
            botCard = await renderSvgToPng(botSvg);
            performanceCard = await renderSvgToPng(performanceSvg);
          } catch (renderError) {
            renderErrorMessage = renderError?.message || String(renderError);
            console.warn("⚠️ Card rendering failed, falling back to text only.", renderError);
          }

          for (const target of (targets || []) as PromoTarget[]) {
            try {
              if (botCard && performanceCard) {
                try {
                  await sendTelegramMediaGroup(target, [
                    { name: "bot_card", data: botCard, caption },
                    { name: "performance_card", data: performanceCard },
                  ]);
                } catch (mediaError: any) {
                  console.warn("⚠️ Media group failed, trying single photos:", mediaError);
                  await sendTelegramPhoto(target, { name: "bot_card", data: botCard, caption });
                  await sendTelegramPhoto(target, { name: "performance_card", data: performanceCard });
                }
              } else {
                await sendTelegramMessage(target, caption);
              }

              await logResult(supabaseClient, {
                target_id: target.id,
                bot_id: bot.id,
                user_id: bot.user_id,
                status: "sent",
                message: "Promo auto-post sent (manual run)",
                sent_at: new Date().toISOString(),
                payload: { caption, render_error: renderErrorMessage },
              });
              results.push({ bot_id: bot.id, target_id: target.id, status: "sent" });
            } catch (sendError: any) {
              try {
                await sendTelegramMessage(target, caption);
              } catch (fallbackError) {
                console.warn("⚠️ Media and text send failed:", fallbackError);
              }
              await logResult(supabaseClient, {
                target_id: target.id,
                bot_id: bot.id,
                user_id: bot.user_id,
                status: "failed",
                error_message: sendError?.message || String(sendError),
                payload: { caption, render_error: renderErrorMessage },
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
