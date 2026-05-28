export const C = {
  bg: '#071012',
  panel: '#0e1a1d',
  panel2: '#132529',
  ink: '#f4f7f7',
  muted: '#9fb4bd',
  line: '#234047',
  teal: '#2de0c2',
  green: '#86efac',
  amber: '#f4c95d',
  red: '#f87171',
  blue: '#93c5fd',
};

export function base(slide, ctx, kicker, title, note = '') {
  ctx.addShape(slide, { x: 0, y: 0, w: 1280, h: 720, fill: C.bg });
  ctx.addShape(slide, { x: 52, y: 44, w: 44, h: 4, fill: C.teal });
  ctx.addText(slide, {
    text: kicker,
    x: 108,
    y: 33,
    w: 360,
    h: 28,
    fontSize: 14,
    bold: true,
    color: C.teal,
    typeface: ctx.fonts.body,
  });
  ctx.addText(slide, {
    text: title,
    x: 52,
    y: 80,
    w: 860,
    h: 92,
    fontSize: 44,
    bold: true,
    color: C.ink,
    typeface: ctx.fonts.title,
  });
  if (note) {
    ctx.addText(slide, {
      text: note,
      x: 52,
      y: 172,
      w: 860,
      h: 44,
      fontSize: 20,
      color: C.muted,
      typeface: ctx.fonts.body,
    });
  }
  ctx.addText(slide, {
    text: 'Clyde OAuth scope demo',
    x: 52,
    y: 674,
    w: 320,
    h: 24,
    fontSize: 12,
    color: '#6f858e',
    typeface: ctx.fonts.body,
  });
}

export function pill(slide, ctx, text, x, y, w, color = C.teal) {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h: 38,
    fill: '#0b2425',
    line: { style: 'solid', fill: color, width: 1 },
  });
  ctx.addText(slide, {
    text,
    x: x + 16,
    y: y + 8,
    w: w - 32,
    h: 22,
    fontSize: 16,
    bold: true,
    color,
    typeface: ctx.fonts.body,
  });
}

export function card(slide, ctx, x, y, w, h, title, body, accent = C.teal) {
  ctx.addShape(slide, {
    x,
    y,
    w,
    h,
    fill: C.panel,
    line: { style: 'solid', fill: C.line, width: 1 },
  });
  ctx.addShape(slide, { x, y, w: 5, h, fill: accent });
  ctx.addText(slide, {
    text: title,
    x: x + 24,
    y: y + 22,
    w: w - 48,
    h: 34,
    fontSize: 24,
    bold: true,
    color: C.ink,
    typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    text: body,
    x: x + 24,
    y: y + 68,
    w: w - 48,
    h: h - 84,
    fontSize: 18,
    color: C.muted,
    typeface: ctx.fonts.body,
  });
}

export function step(slide, ctx, n, x, y, title, body, accent = C.teal) {
  ctx.addShape(slide, {
    x,
    y,
    w: 58,
    h: 58,
    fill: '#0b2425',
    line: { style: 'solid', fill: accent, width: 1 },
  });
  ctx.addText(slide, {
    text: String(n),
    x,
    y: y + 12,
    w: 58,
    h: 32,
    fontSize: 26,
    bold: true,
    align: 'center',
    color: accent,
    typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    text: title,
    x: x + 78,
    y: y + 2,
    w: 360,
    h: 28,
    fontSize: 22,
    bold: true,
    color: C.ink,
    typeface: ctx.fonts.title,
  });
  ctx.addText(slide, {
    text: body,
    x: x + 78,
    y: y + 36,
    w: 370,
    h: 50,
    fontSize: 16,
    color: C.muted,
    typeface: ctx.fonts.body,
  });
}
