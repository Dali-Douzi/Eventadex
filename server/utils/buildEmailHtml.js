'use strict';

/**
 * Builds a complete, fully inline-styled HTML email from an EmailTemplate
 * document and a variables map.
 *
 * Layout (top → bottom):
 *   ┌────────────────────────────────────────┐
 *   │  Header banner image (optional)        │
 *   │  Header band (color, optional)         │
 *   │    └─ Logo (left|center|right)         │
 *   │    └─ Header text                      │
 *   │  Body text (variable substitution)     │
 *   │  QR code  <img src="cid:qrcode">       │
 *   │  CTA button (optional)                 │
 *   │  Footer (optional)                     │
 *   └────────────────────────────────────────┘
 *
 * The QR code is rendered as <img src="cid:qrcode">.
 * The caller MUST attach the actual image with cid: 'qrcode' in the
 * nodemailer attachments array.
 *
 * If the template's bodyText contains {{qrCode}} the QR block is injected at
 * that position. If not, it is appended automatically after the body text.
 *
 * Supported variables (double-brace):
 *   {{firstName}}, {{lastName}}, {{eventName}},
 *   {{sessionName}}, {{sessionDate}}, {{qrCode}}
 *
 * Legacy single-brace format is also supported for backward compatibility.
 *
 * @param  {object} template  – EmailTemplate document or plain object
 * @param  {object} variables – variable values to inject
 * @returns {string}            Complete HTML email string
 */
function buildEmailHtml(template, variables = {}) {
  const {
    firstName        = '',
    lastName         = '',
    eventName        = '',
    sessionName      = '',
    sessionDate      = '',
    countdown        = '',       // e.g. "3 days, 14 hours, and 22 minutes"
    countdownImage   = '',       // raw HTML <img …> for the live countdown image
    confirmationUrl  = '#',      // link to the registrant's confirmation/ticket page
  } = variables;

  const primaryColor = template.buttonColor || '#2563eb';

  // ── HTML escaping ─────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Pre-escape variable values (these come from user-submitted registration data)
  const safeFirstName   = escHtml(firstName);
  const safeLastName    = escHtml(lastName);
  const safeEventName   = escHtml(eventName);
  const safeSessionName = escHtml(sessionName);
  const safeSessionDate = escHtml(sessionDate);
  const safeCountdown   = escHtml(countdown);   // text, safe to escape

  // ── Variable substitution helper ─────────────────────────────────────────
  // Operates on already-escaped template text and injects escaped variable values.
  function sub(str) {
    if (!str) return '';
    return str
      .replace(/\{\{firstName\}\}/g,      safeFirstName)
      .replace(/\{\{lastName\}\}/g,       safeLastName)
      .replace(/\{\{eventName\}\}/g,      safeEventName)
      .replace(/\{\{sessionName\}\}/g,    safeSessionName)
      .replace(/\{\{sessionDate\}\}/g,    safeSessionDate)
      .replace(/\{\{countdown\}\}/g,      safeCountdown)
      .replace(/\{\{countdownImage\}\}/g, countdownImage)  // raw HTML — not escaped
      // Legacy single-brace format
      .replace(/\{firstName\}/g,   safeFirstName)
      .replace(/\{lastName\}/g,    safeLastName)
      .replace(/\{eventName\}/g,   safeEventName)
      .replace(/\{sessionName\}/g, safeSessionName);
  }

  // ── QR code block (CID reference) ────────────────────────────────────────
  const qrBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:24px 0 8px;">
      <tr>
        <td align="center">
          <img src="cid:qrcode" alt="Your QR Code" width="200" height="200"
               style="display:block;border-radius:8px;
                      border:1px solid #e2e8f0;"/>
          <p style="margin:10px 0 0;font-size:12px;
                    color:#94a3b8;text-align:center;">
            Present this QR code at check-in
          </p>
        </td>
      </tr>
    </table>`;

  // ── Body HTML ─────────────────────────────────────────────────────────────
  let bodyHtml;

  if (template.customHtml && template.customHtml.trim()) {
    // Detect whether the admin pasted a COMPLETE HTML document (starts with <!DOCTYPE)
    const isFullDocument = /^\s*<!doctype\s+html/i.test(template.customHtml);

    if (isFullDocument) {
      // Full document mode — substitute variables (including {{qrCode}}) and return as-is,
      // bypassing the system's wrapper entirely.
      const qrImg = `<img src="cid:qrcode" alt="Your QR Code" width="200" height="200"
        style="display:block;border-radius:8px;border:1px solid #e2e8f0;"/>`;
      return template.customHtml
        .replace(/\{\{firstName\}\}/g,       safeFirstName)
        .replace(/\{\{lastName\}\}/g,        safeLastName)
        .replace(/\{\{eventName\}\}/g,       safeEventName)
        .replace(/\{\{sessionName\}\}/g,     safeSessionName)
        .replace(/\{\{sessionDate\}\}/g,     safeSessionDate)
        .replace(/\{\{countdown\}\}/g,       safeCountdown)
        .replace(/\{\{countdownImage\}\}/g,  countdownImage)
        .replace(/\{\{confirmationUrl\}\}/g, confirmationUrl)
        .replace(/\{\{qrCode\}\}/g,          qrImg);
    }

    // Body content mode — embed inside the system wrapper
    bodyHtml = template.customHtml
      .replace(/\{\{firstName\}\}/g,       safeFirstName)
      .replace(/\{\{lastName\}\}/g,        safeLastName)
      .replace(/\{\{eventName\}\}/g,       safeEventName)
      .replace(/\{\{sessionName\}\}/g,     safeSessionName)
      .replace(/\{\{sessionDate\}\}/g,     safeSessionDate)
      .replace(/\{\{countdown\}\}/g,       safeCountdown)
      .replace(/\{\{countdownImage\}\}/g,  countdownImage)
      .replace(/\{\{confirmationUrl\}\}/g, confirmationUrl)
      .replace(/\{\{qrCode\}\}/g,          qrBlock);
  } else {
    // Plain body text — escape then substitute
    const rawBody  = template.bodyText || '';
    const hasQrTag = /\{\{qrCode\}\}/.test(rawBody) || /\{qrCode\}/.test(rawBody);

    bodyHtml = sub(escHtml(rawBody))
      .replace(/\{\{qrCode\}\}/g, qrBlock)
      .replace(/\{qrCode\}/g,     qrBlock)
      .replace(/\n/g, '<br>');

    if (!hasQrTag) {
      // Append QR block below body when the admin hasn't placed the token
      bodyHtml += qrBlock;
    }
  }

  // ── CTA button ────────────────────────────────────────────────────────────
  const btnStyle = [
    `background:${primaryColor}`,
    'color:#ffffff',
    'padding:13px 32px',
    'border-radius:6px',
    'text-decoration:none',
    'font-weight:600',
    'display:inline-block',
    'font-size:15px',
    'letter-spacing:0.01em',
    'mso-padding-alt:0',
  ].join(';');

  const buttonBlock = template.buttonLabel
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin:28px 0 4px;">
         <tr>
           <td align="center">
             <a href="${confirmationUrl}" style="${btnStyle}">${sub(escHtml(template.buttonLabel))}</a>
           </td>
         </tr>
       </table>`
    : '';

  // ── Size helpers ──────────────────────────────────────────────────────────
  const logoWidth   = template.logoWidth         ?? null;
  const logoHeight  = template.logoHeight        ?? null;
  const logoFit     = template.logoFit           ?? null;
  const hdrHeight   = template.headerImageHeight ?? 200;
  const hdrFit      = template.headerImageFit    ?? null;
  const ftrHeight   = template.footerImageHeight ?? 120;
  const ftrFit      = template.footerImageFit    ?? null;

  // Logo inline style (used inside header band)
  const logoImgStyle = logoFit === 'fill'
    ? 'display:block;width:100%;height:auto;object-fit:contain;max-width:none;'
    : logoFit === 'max'
    ? 'display:block;width:100%;object-fit:fill;max-width:none;'
    : [
        logoWidth  != null ? `width:${logoWidth}%`    : 'max-width:180px',
        logoHeight != null ? `height:${logoHeight}px` : 'height:48px',
        'display:block',
        'object-fit:contain',
      ].join(';');

  // Header image inline style
  const hdrImgStyle = (hdrFit === 'fill'
    ? `display:block;width:100%;max-width:600px;height:${hdrHeight}px;object-fit:contain;`
    : hdrFit === 'max'
    ? `display:block;width:100%;max-width:600px;height:${hdrHeight}px;object-fit:fill;`
    : `display:block;width:100%;max-width:600px;height:${hdrHeight}px;object-fit:cover;`
  ) + 'border-radius:8px 8px 0 0;';

  // Footer image inline style
  const ftrImgStyle = ftrFit === 'fill'
    ? `display:block;width:100%;max-width:600px;height:${ftrHeight}px;object-fit:contain;`
    : ftrFit === 'max'
    ? `display:block;width:100%;max-width:600px;height:${ftrHeight}px;object-fit:fill;`
    : `display:block;width:100%;max-width:600px;height:${ftrHeight}px;object-fit:cover;`;

  // ── Header image (full-width banner at top of card) ──────────────────────
  const headerImageBlock = template.headerImageUrl
    ? `<tr>
         <td style="padding:0;line-height:0;">
           <img src="cid:headerImage" alt="Header" width="600"
                style="${hdrImgStyle}"/>
         </td>
       </tr>`
    : '';

  // ── Merged header band (logo + header text) ───────────────────────────────
  const hasLogo          = !!template.logoUrl;
  const hasHeaderContent = !!(template.headerText || hasLogo);
  const placement        = template.logoPlacement || 'left';
  const headerPadding    = template.headerPadding ?? 28;
  const topRadius        = !template.headerImageUrl ? '8px 8px 0 0' : '0';

  const h1Style = [
    'margin:0',
    'color:#ffffff',
    'font-size:22px',
    'font-weight:700',
    'line-height:1.35',
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`,
  ].join(';');

  let headerBlock = '';
  if (hasHeaderContent) {
    const tdBase = `background:${primaryColor};padding:${headerPadding}px 36px;border-radius:${topRadius}`;
    const h1Html = template.headerText
      ? `<h1 style="${h1Style};">${sub(escHtml(template.headerText))}</h1>`
      : '';

    if (!hasLogo) {
      headerBlock = `<tr>
         <td style="${tdBase};">
           ${h1Html}
         </td>
       </tr>`;
    } else if (placement === 'center') {
      headerBlock = `<tr>
         <td align="center" style="${tdBase};">
           <img src="cid:logo" alt="Logo"
                style="${logoImgStyle}margin:0 auto${h1Html ? ' 16px' : ' 0'} auto;"/>
           ${h1Html ? `<h1 style="${h1Style};text-align:center;">${sub(escHtml(template.headerText))}</h1>` : ''}
         </td>
       </tr>`;
    } else if (placement === 'right') {
      headerBlock = `<tr>
         <td style="${tdBase};">
           <table width="100%" cellpadding="0" cellspacing="0" border="0">
             <tr>
               <td style="vertical-align:middle;">${h1Html}</td>
               <td style="vertical-align:middle;text-align:right;padding-left:16px;white-space:nowrap;">
                 <img src="cid:logo" alt="Logo" style="${logoImgStyle}"/>
               </td>
             </tr>
           </table>
         </td>
       </tr>`;
    } else {
      // left (default)
      headerBlock = `<tr>
         <td style="${tdBase};">
           <table width="100%" cellpadding="0" cellspacing="0" border="0">
             <tr>
               <td style="vertical-align:middle;padding-right:16px;white-space:nowrap;">
                 <img src="cid:logo" alt="Logo" style="${logoImgStyle}"/>
               </td>
               <td style="vertical-align:middle;">${h1Html}</td>
             </tr>
           </table>
         </td>
       </tr>`;
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const ftrPad    = template.footerImagePadding ?? 0;
  const hasFooter = template.footerText || template.footerImageUrl;
  const ftrTdPad  = template.footerImageUrl && ftrPad === 0 ? '0' : '20px 36px';

  const footerImageHtml = template.footerImageUrl
    ? ftrPad > 0
      ? `<div style="padding:${ftrPad}px;">
           <img src="cid:footerImage" alt="Footer" style="${ftrImgStyle}max-width:100%;"/>
         </div>`
      : `<img src="cid:footerImage" alt="Footer" width="600" style="${ftrImgStyle}"/>`
    : '';

  const footerBlock = hasFooter
    ? `<tr>
         <td style="background:#f8fafc;padding:${ftrTdPad};
                    border-top:1px solid #e2e8f0;
                    border-radius:0 0 8px 8px;overflow:hidden;">
           ${footerImageHtml}
           ${template.footerText
             ? `<p style="margin:0;padding:${template.footerImageUrl ? '16px 36px' : '0'};
                          color:#94a3b8;font-size:12px;line-height:1.7;
                          text-align:center;font-family:-apple-system,BlinkMacSystemFont,
                          'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${sub(escHtml(template.footerText))}
                </p>`
             : ''}
         </td>
       </tr>`
    : '';

  const subject = sub(escHtml(template.subject || 'Registration Confirmation'));

  // ── Assemble final HTML ───────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
             Roboto,Helvetica,Arial,sans-serif;
             -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!--[if mso]>
  <table width="100%"><tr><td align="center">
  <![endif]-->

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center" valign="top">

        <!-- ╔══════════════════════════════════════╗ -->
        <!-- ║            600px card                ║ -->
        <!-- ╚══════════════════════════════════════╝ -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:8px;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);
                      overflow:hidden;">

          ${headerImageBlock}
          ${headerBlock}

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <div style="color:#475569;font-size:15px;line-height:1.75;
                          font-family:-apple-system,BlinkMacSystemFont,
                          'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                ${bodyHtml}
              </div>
              ${buttonBlock}
            </td>
          </tr>

          ${footerBlock}

        </table>
        <!-- /600px card -->

      </td>
    </tr>
  </table>

  <!--[if mso]>
  </td></tr></table>
  <![endif]-->

</body>
</html>`;
}

module.exports = { buildEmailHtml };
