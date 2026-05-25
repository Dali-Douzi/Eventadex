/* ─────────────────────────────────────────────────────────────────────────────
   Eventadex — Registration Form Embed Script  v1.0
   ─────────────────────────────────────────────────────────────────────────────
   Drop ONE line anywhere on your page and the registration form appears there:

     <script src="https://your-domain/embed.js" data-slug="your-org-slug"></script>

   The script:
     1. Finds its own <script> tag to know where to inject the form.
     2. Reads data-slug to know which registration form to load.
     3. Inserts an <iframe> pointing to your form with ?embed=true.
     4. Listens for height messages from the iframe and auto-resizes it so
        there are never any scroll bars inside the embed.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── 1. Locate this <script> tag ──────────────────────────────────────── */
  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  }());

  /* ── 2. Read config from the tag ──────────────────────────────────────── */
  var slug     = script.getAttribute('data-slug');
  var BASE_URL = (function () {
    try { return new URL(script.src).origin; } catch (e) { return window.location.origin; }
  }());

  if (!slug) {
    console.error('[Eventadex] The embed script is missing a data-slug attribute.\n' +
      'Example: <script src="…/embed.js" data-slug="my-org-slug"></script>');
    return;
  }

  /* ── 3. Build the wrapper div + iframe ────────────────────────────────── */
  var wrapper = document.createElement('div');
  wrapper.id             = 'eventadex-embed-' + slug;
  wrapper.style.cssText  = 'width:100%;position:relative;';

  var iframe = document.createElement('iframe');
  iframe.src = BASE_URL + '/' + slug + '?embed=true';
  iframe.setAttribute('title',               'Event Registration');
  iframe.setAttribute('frameborder',         '0');
  iframe.setAttribute('scrolling',           'no');
  iframe.setAttribute('allowtransparency',   'true');
  iframe.setAttribute('allowpaymentrequest', 'true');
  /* Initial height — replaced immediately by the first postMessage from the form */
  iframe.style.cssText = [
    'width:100%;',
    'height:700px;',
    'border:none;',
    'display:block;',
    'overflow:hidden;',
    'transition:height 0.25s ease;',
  ].join('');

  wrapper.appendChild(iframe);

  /* Insert wrapper right after this <script> tag */
  script.parentNode.insertBefore(wrapper, script.nextSibling);

  /* ── 4. Auto-resize whenever the form changes height ──────────────────── */
  window.addEventListener('message', function (evt) {
    /* Only trust messages from the Eventadex domain */
    try {
      if (new URL(evt.origin).origin !== new URL(BASE_URL).origin) return;
    } catch (e) { return; }

    if (evt.data && evt.data.type === 'reg-height' &&
        typeof evt.data.height === 'number' && evt.data.height > 0) {
      /* Add a small buffer so nothing is clipped */
      iframe.style.height = (evt.data.height + 48) + 'px';
    }
  });

}());
