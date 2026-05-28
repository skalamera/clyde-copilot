import { base, card, C } from './shared.mjs';

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  base(slide, ctx, 'USER CONTROLS', 'Users control connection, scanning, and retention', 'The app exposes Google Sync settings inside Clyde.');
  card(slide, ctx, 72, 236, 334, 250, 'Connect or disconnect', 'Users start OAuth from Clyde settings. They can disconnect Google Sync in the same settings panel.', C.teal);
  card(slide, ctx, 472, 236, 334, 250, 'Manual or periodic scan', 'Users can run a scan manually or enable periodic sync. Periodic sync can be turned off.', C.blue);
  card(slide, ctx, 872, 236, 334, 250, 'Approve or dismiss', 'Suggested actions stay pending until the user approves or dismisses them. Auto-approve is a Pro setting and is visibly labeled.', C.amber);
  ctx.addText(slide, { text: 'The Google connection is for Clyde’s user-approved productivity features. It does not grant background write access to Google services.', x: 160, y: 548, w: 960, h: 54, fontSize: 22, align: 'center', color: C.muted, typeface: ctx.fonts.body });
  return slide;
}
