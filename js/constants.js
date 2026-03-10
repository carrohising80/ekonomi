'use strict';

/* =============================================
   CATEGORIES
   ============================================= */

const FIXED_CATEGORIES = [
  { id: 'bostad',     label: 'Bostad',           icon: '🏠', bg: '#EFF6FF' },
  { id: 'forsakring', label: 'Försäkringar',      icon: '🛡️', bg: '#F5F3FF' },
  { id: 'lan',        label: 'Lån & krediter',    icon: '💳', bg: '#FFF7ED' },
  { id: 'streaming',  label: 'Streaming & appar', icon: '📺', bg: '#FDF4FF' },
  { id: 'annat',      label: 'Övrigt fast',       icon: '📌', bg: '#F3F4F6' },
];

const VARIABLE_CATEGORIES = [
  { id: 'mat',       label: 'Mat & dagligvaror', icon: '🛒', bg: '#F0FDF4' },
  { id: 'transport', label: 'Transport & bil',   icon: '🚗', bg: '#EFF6FF' },
  { id: 'noje',      label: 'Nöje & fritid',     icon: '🎭', bg: '#FDF4FF' },
  { id: 'halsa',     label: 'Hälsa & träning',   icon: '💪', bg: '#F0FDF4' },
  { id: 'klader',    label: 'Kläder & skönhet',  icon: '👗', bg: '#FFF7ED' },
  { id: 'barn',      label: 'Barn',              icon: '👶', bg: '#FFF7ED' },
  { id: 'annat',     label: 'Övrigt rörligt',    icon: '📦', bg: '#F3F4F6' },
];

const FREQ_LABELS = {
  2:  'varannan månad',
  3:  'var 3:e månad',
  4:  'var 4:e månad',
  6:  'var 6:e månad',
  12: 'en gång per år',
  24: 'vartannat år',
};

const PERSON_LABELS = {
  mig:    '👤 Mig',
  elias:  '👦 Elias',
  oliver: '👦 Oliver',
  zoe:    '🐶 Zoe',
  ovrigt: '📦 Övrigt',
};

/* =============================================
   ICONS (inline SVGs)
   ============================================= */

const I = {
  plus:  '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit:  '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
};
