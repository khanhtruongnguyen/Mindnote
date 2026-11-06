import type { NodeColor } from '../types';

export interface ColorScheme {
  id: NodeColor;
  name: string;
  bg: string;
  border: string;
  glow: string;
  badge: string;
  dot: string;
  text: string;
  accent: string;
}

export const COLOR_SCHEMES: Record<NodeColor, ColorScheme> = {
  purple: {
    id: 'purple',
    name: 'Tím Obsidian',
    bg: 'bg-[#1b1728]/95',
    border: 'border-purple-500/40 hover:border-purple-400',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    dot: 'bg-purple-400',
    text: 'text-purple-200',
    accent: '#a855f7',
  },
  blue: {
    id: 'blue',
    name: 'Xanh Lam',
    bg: 'bg-[#131b2c]/95',
    border: 'border-blue-500/40 hover:border-blue-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    text: 'text-blue-200',
    accent: '#3b82f6',
  },
  emerald: {
    id: 'emerald',
    name: 'Xanh Lục',
    bg: 'bg-[#12231b]/95',
    border: 'border-emerald-500/40 hover:border-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    text: 'text-emerald-200',
    accent: '#10b981',
  },
  amber: {
    id: 'amber',
    name: 'Vàng Hổ Phách',
    bg: 'bg-[#251d13]/95',
    border: 'border-amber-500/40 hover:border-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'text-amber-200',
    accent: '#f59e0b',
  },
  rose: {
    id: 'rose',
    name: 'Hồng Đỏ',
    bg: 'bg-[#26151c]/95',
    border: 'border-rose-500/40 hover:border-rose-400',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
    text: 'text-rose-200',
    accent: '#f43f5e',
  },
  cyan: {
    id: 'cyan',
    name: 'Xanh Mòng Két',
    bg: 'bg-[#122228]/95',
    border: 'border-cyan-500/40 hover:border-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-400',
    text: 'text-cyan-200',
    accent: '#06b6d4',
  },
  indigo: {
    id: 'indigo',
    name: 'Chàm Indigo',
    bg: 'bg-[#18182e]/95',
    border: 'border-indigo-500/40 hover:border-indigo-400',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.25)]',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
    text: 'text-indigo-200',
    accent: '#6366f1',
  },
  graphite: {
    id: 'graphite',
    name: 'Than Chì',
    bg: 'bg-[#1e1e24]/95',
    border: 'border-zinc-600/40 hover:border-zinc-400',
    glow: 'shadow-[0_0_20px_rgba(113,113,122,0.2)]',
    badge: 'bg-zinc-700/30 text-zinc-300 border-zinc-600/40',
    dot: 'bg-zinc-400',
    text: 'text-zinc-200',
    accent: '#a1a1aa',
  },
};
