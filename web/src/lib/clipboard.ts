/**
 * Copies text to the clipboard.
 *
 * `navigator.clipboard` only exists on secure pages (https or localhost). The server is often opened over plain http
 * on a LAN or VPN address, where it is undefined, so fall back to a hidden textarea and `execCommand('copy')`.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  // inside an open modal the focus trap would steal focus from a node placed on <body>, so attach to the active dialog
  (document.activeElement?.closest('[role="dialog"]') ?? document.body).appendChild(box);
  box.select();
  box.setSelectionRange(0, text.length);
  try {
    if (!document.execCommand('copy')) throw new Error('Copy is not allowed in this browser');
  } finally {
    box.remove();
  }
}
