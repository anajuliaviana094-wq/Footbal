"use client";

import { useEffect, useRef } from "react";
import type { Frame, MatchEvent } from "@/engine/types";

export interface PitchTeam {
  fill: string;
  stroke: string;
  /** número da camisa por slot (11) */
  shirts: (number | null)[];
  /** id do jogador por slot */
  ids: (number | null)[];
  /** nome curto por slot */
  names: (string | null)[];
}

interface Props {
  frames: Frame[];
  /** tick atual (fracionário) */
  getTick: () => number;
  home: PitchTeam;
  away: PitchTeam;
  /** eventos recentes para destaque */
  getHighlights: () => { type: MatchEvent["type"]; playerId?: number; side: MatchEvent["side"]; age: number }[];
}

const W = 1050;
const H = 680;

/** Campo 2D (estilo transmissão): 22 jogadores com nome, bola com rastro e destaque do lance. */
export function PitchCanvas({ frames, getTick, home, away, getHighlights }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ frames, home, away, getTick, getHighlights });
  useEffect(() => {
    propsRef.current = { frames, home, away, getTick, getHighlights };
  });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const { frames, home, away, getTick, getHighlights } = propsRef.current;
      // em telas pequenas as peças ficam maiores para continuarem legíveis
      const boost = Math.max(1, Math.min(1.9, 760 / Math.max(1, canvas.clientWidth)));
      drawPitch(ctx);
      if (frames.length) {
        const t = Math.max(0, Math.min(frames.length - 1, getTick()));
        const i0 = Math.floor(t);
        const i1 = Math.min(frames.length - 1, i0 + 1);
        const k = ease(t - i0);
        const f0 = frames[i0];
        const f1 = frames[i1];
        const lerp = (a: [number, number] | null, b: [number, number] | null): [number, number] | null => {
          if (!a || !b) return b ?? a;
          return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
        };
        // rastro da bola nos últimos ticks
        const ball = lerp(f0.b, f1.b)!;
        ctx.strokeStyle = "rgba(255,230,120,0.85)";
        ctx.lineWidth = 3.5 * boost;
        ctx.lineCap = "round";
        ctx.beginPath();
        const from = Math.max(0, i0 - 3);
        for (let j = from; j <= i0; j++) {
          const [x, y] = toPx(frames[j].b);
          if (j === from) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const [tx, ty] = toPx(ball);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        const highlights = getHighlights();
        const posById = new Map<number, [number, number]>();
        for (let i = 0; i < 22; i++) {
          const pos = lerp(f0.p[i], f1.p[i]);
          if (!pos) continue;
          const team = i < 11 ? home : away;
          const slot = i % 11;
          const [x, y] = toPx(pos);
          const id = team.ids[slot];
          if (id) posById.set(id, [x, y]);
          drawPlayer(ctx, x, y, team.fill, team.stroke, team.shirts[slot], team.names[slot], boost);
        }
        const [bx, by] = toPx(ball);
        // anel destacando o lance
        ctx.strokeStyle = "#ffd23f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, 26 * boost, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.ellipse(bx + 3, by + 4, 8 * boost, 5 * boost, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(bx, by, 7.5 * boost, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (const h of highlights) {
          const p = h.playerId ? posById.get(h.playerId) : undefined;
          if (!p) continue;
          const alpha = Math.max(0, 1 - h.age / 6);
          ctx.globalAlpha = alpha;
          if (h.type === "yellow" || h.type === "second_yellow" || h.type === "red") {
            ctx.fillStyle = h.type === "yellow" ? "#fde047" : "#ef4444";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            roundRect(ctx, p[0] - 9, p[1] - 52, 18, 26, 3);
            ctx.fill();
            ctx.stroke();
          } else if (h.type === "injury") {
            ctx.fillStyle = "#fff";
            ctx.fillRect(p[0] - 12, p[1] - 44, 24, 24);
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(p[0] - 3.5, p[1] - 40, 7, 16);
            ctx.fillRect(p[0] - 8, p[1] - 35.5, 16, 7);
          } else if (h.type === "goal") {
            ctx.strokeStyle = "#ffd23f";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 26 + h.age * 6, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="block h-auto w-full rounded-xl" style={{ aspectRatio: `${W} / ${H}` }} />;
}

function ease(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

const PAD = 30;
function toPx([x, y]: [number, number]): [number, number] {
  return [PAD + x * (W - PAD * 2), PAD + y * (H - PAD * 2)];
}

function drawPitch(ctx: CanvasRenderingContext2D) {
  // gramado com corte em xadrez + vinheta
  const cols = 16;
  const rows = 10;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#2e8b3d" : "#33974a";
      ctx.fillRect((W / cols) * i, (H / rows) * j, W / cols + 1, H / rows + 1);
    }
  const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  const l = PAD;
  const r = W - PAD;
  const t = PAD;
  const b = H - PAD;
  const mx = W / 2;
  const my = H / 2;
  ctx.strokeRect(l, t, r - l, b - t);
  ctx.beginPath();
  ctx.moveTo(mx, t);
  ctx.lineTo(mx, b);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(mx, my, 4, 0, Math.PI * 2);
  ctx.fill();
  const boxH = 320;
  const boxW = 130;
  const smallH = 150;
  const smallW = 48;
  ctx.strokeRect(l, my - boxH / 2, boxW, boxH);
  ctx.strokeRect(r - boxW, my - boxH / 2, boxW, boxH);
  ctx.strokeRect(l, my - smallH / 2, smallW, smallH);
  ctx.strokeRect(r - smallW, my - smallH / 2, smallW, smallH);
  ctx.beginPath();
  ctx.arc(l + boxW - 20, my, 60, -Math.PI / 3.2, Math.PI / 3.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r - boxW + 20, my, 60, Math.PI - Math.PI / 3.2, Math.PI + Math.PI / 3.2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(l - 12, my - 40, 12, 80);
  ctx.fillRect(r, my - 40, 12, 80);
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, stroke: string, shirt: number | null, name: string | null, k: number) {
  const r = 16 * k;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.ellipse(x + 3, y + 5, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3.5 * k;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  if (shirt !== null) {
    ctx.fillStyle = textColor(fill);
    ctx.font = `bold ${Math.round(15 * k)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(shirt), x, y + 1);
  }
  if (name) {
    ctx.font = `600 ${Math.round(11 * k)}px system-ui, sans-serif`;
    const w = ctx.measureText(name).width + 10 * k;
    const h = 16 * k;
    const ty = y + r + 3 * k;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, x - w / 2, ty, w, h, 4 * k);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, x, ty + h / 2 + 0.5);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160 ? "#0b1220" : "#ffffff";
}
