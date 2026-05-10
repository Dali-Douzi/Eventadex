'use strict';

/**
 * Unit tests for buildEmailHtml utility.
 * Covers: HTML escaping, variable substitution, QR block placement,
 * optional blocks (header, footer, button), and output structure.
 */

const { buildEmailHtml } = require('../utils/buildEmailHtml');

const BASE = {
  subject:     'Test Subject',
  headerText:  'Welcome',
  bodyText:    'Hello {{firstName}}!',
  footerText:  'Footer text',
  buttonLabel: 'Click here',
  buttonColor: '#2563eb',
};

// ─── HTML escaping — variable values ─────────────────────────────────────────

describe('HTML escaping — variable values (registrant-supplied data)', () => {
  it('escapes & in firstName', () => {
    const html = buildEmailHtml(BASE, { firstName: 'Tom & Jerry' });
    expect(html).toContain('Tom &amp; Jerry');
    expect(html).not.toContain('Tom & Jerry');
  });

  it('escapes < and > in firstName', () => {
    const html = buildEmailHtml(BASE, { firstName: '<b>Bold</b>' });
    expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(html).not.toContain('<b>Bold</b>');
  });

  it('escapes " in lastName', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: 'Hello {{lastName}}!' },
      { lastName: 'O"Brien' }
    );
    expect(html).toContain('O&quot;Brien');
  });

  it('escapes special chars in eventName', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: '{{eventName}}' },
      { eventName: 'Annual <Summit> & Awards' }
    );
    expect(html).toContain('Annual &lt;Summit&gt; &amp; Awards');
  });

  it('escapes special chars in sessionName', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: '{{sessionName}}' },
      { sessionName: 'Hall <A> & B' }
    );
    expect(html).toContain('Hall &lt;A&gt; &amp; B');
  });

  it('escapes special chars in sessionDate', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: '{{sessionDate}}' },
      { sessionDate: '1 Jan <2026>' }
    );
    expect(html).toContain('1 Jan &lt;2026&gt;');
  });
});

// ─── HTML escaping — template fields (admin-supplied) ────────────────────────

describe('HTML escaping — template fields (admin-supplied content)', () => {
  it('escapes & in headerText', () => {
    const html = buildEmailHtml({ ...BASE, headerText: 'Tech & Innovation Summit' }, {});
    expect(html).toContain('Tech &amp; Innovation Summit');
  });

  it('escapes < in headerText', () => {
    const html = buildEmailHtml({ ...BASE, headerText: 'Score: <100>' }, {});
    expect(html).toContain('Score: &lt;100&gt;');
  });

  it('escapes & in footerText', () => {
    const html = buildEmailHtml({ ...BASE, footerText: 'Terms & Conditions' }, {});
    expect(html).toContain('Terms &amp; Conditions');
  });

  it('escapes < in buttonLabel', () => {
    const html = buildEmailHtml({ ...BASE, buttonLabel: 'Go <here>' }, {});
    expect(html).toContain('Go &lt;here&gt;');
  });

  it('escapes & in bodyText', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: 'Price: $10 & tax' }, {});
    expect(html).toContain('Price: $10 &amp; tax');
  });

  it('escapes < in subject (used in <title>)', () => {
    const html = buildEmailHtml({ ...BASE, subject: 'Conf <2026>' }, {});
    expect(html).toContain('Conf &lt;2026&gt;');
  });
});

// ─── Variable substitution ────────────────────────────────────────────────────

describe('Variable substitution', () => {
  it('substitutes {{firstName}} in bodyText', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: 'Hi {{firstName}}!' }, { firstName: 'Alice' });
    expect(html).toContain('Hi Alice!');
  });

  it('substitutes all supported double-brace variables', () => {
    const tmpl = {
      ...BASE,
      bodyText: '{{firstName}} {{lastName}} — {{eventName}} — {{sessionName}} — {{sessionDate}}',
    };
    const vars = {
      firstName:   'Alice',
      lastName:    'Smith',
      eventName:   'Summit',
      sessionName: 'Morning',
      sessionDate: '2026-06-01',
    };
    const html = buildEmailHtml(tmpl, vars);
    expect(html).toContain('Alice Smith');
    expect(html).toContain('Summit');
    expect(html).toContain('Morning');
    expect(html).toContain('2026-06-01');
  });

  it('supports legacy single-brace {firstName} format', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: 'Hello {firstName}!' },
      { firstName: 'Bob' }
    );
    expect(html).toContain('Hello Bob!');
  });

  it('leaves unreferenced variables as empty string (no leftover braces)', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: 'Hi {{firstName}}!' }, {});
    // firstName defaults to '' — should not show literal "{{firstName}}"
    expect(html).not.toContain('{{firstName}}');
    expect(html).toContain('Hi !');
  });
});

// ─── QR block placement ───────────────────────────────────────────────────────

describe('QR block placement', () => {
  it('injects QR block when {{qrCode}} is in bodyText', () => {
    const html = buildEmailHtml(
      { ...BASE, bodyText: 'Scan: {{qrCode}}' },
      {}
    );
    expect(html).toContain('cid:qrcode');
  });

  it('appends QR block after body when {{qrCode}} is absent', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: 'No QR token here.' }, {});
    expect(html).toContain('cid:qrcode');
  });

  it('supports legacy {qrCode} token for QR placement', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: '{qrCode}' }, {});
    expect(html).toContain('cid:qrcode');
  });

  it('converts newlines to <br> in bodyText', () => {
    const html = buildEmailHtml({ ...BASE, bodyText: 'Line one\nLine two' }, {});
    expect(html).toContain('<br>');
  });
});

// ─── Optional blocks ──────────────────────────────────────────────────────────

describe('Optional template blocks', () => {
  it('renders header block when headerText is set', () => {
    const html = buildEmailHtml({ ...BASE, headerText: 'My Header' }, {});
    expect(html).toContain('My Header');
    expect(html).toContain('<h1');
  });

  it('omits header block when headerText is absent', () => {
    const { headerText: _, ...noHeader } = BASE;
    const html = buildEmailHtml(noHeader, {});
    expect(html).not.toContain('<h1');
  });

  it('renders footer block when footerText is set', () => {
    const html = buildEmailHtml({ ...BASE, footerText: 'My Footer' }, {});
    expect(html).toContain('My Footer');
  });

  it('omits footer block when footerText is absent', () => {
    const { footerText: _, ...noFooter } = BASE;
    const html = buildEmailHtml(noFooter, {});
    // Footer section uses a specific background color — absence means no footer <td>
    const footerCount = (html.match(/background:#f8fafc/g) || []).length;
    expect(footerCount).toBe(0);
  });

  it('renders button when buttonLabel is set', () => {
    const html = buildEmailHtml({ ...BASE, buttonLabel: 'View Details' }, {});
    expect(html).toContain('View Details');
    expect(html).toContain('<a ');
  });

  it('omits button when buttonLabel is absent', () => {
    const { buttonLabel: _, ...noButton } = BASE;
    const html = buildEmailHtml(noButton, {});
    // No <a href="#"> button link when label is absent
    expect(html).not.toContain('href="#"');
  });

  it('renders logo img when logoUrl is set', () => {
    const html = buildEmailHtml({ ...BASE, logoUrl: '/uploads/logo.png' }, {});
    expect(html).toContain('/uploads/logo.png');
    expect(html).toContain('<img');
  });

  it('omits logo when logoUrl is absent', () => {
    const html = buildEmailHtml(BASE, {});
    expect(html).not.toContain('alt="Logo"');
  });

  it('uses buttonColor for the primary color', () => {
    const html = buildEmailHtml({ ...BASE, buttonColor: '#ff0000' }, {});
    expect(html).toContain('#ff0000');
  });

  it('falls back to #2563eb when buttonColor is absent', () => {
    const { buttonColor: _, ...noColor } = BASE;
    const html = buildEmailHtml(noColor, {});
    expect(html).toContain('#2563eb');
  });
});

// ─── Output structure ─────────────────────────────────────────────────────────

describe('HTML document structure', () => {
  it('starts with <!DOCTYPE html>', () => {
    const html = buildEmailHtml(BASE, {});
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/);
  });

  it('contains <html>, <head>, <body> and closing tags', () => {
    const html = buildEmailHtml(BASE, {});
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body');
    expect(html).toContain('</html>');
    expect(html).toContain('</body>');
  });

  it('contains the subject in <title>', () => {
    const html = buildEmailHtml({ ...BASE, subject: 'My Unique Subject' }, {});
    expect(html).toContain('<title>My Unique Subject</title>');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('does not throw with a minimal template (only subject)', () => {
    expect(() => buildEmailHtml({ subject: 'Min' }, {})).not.toThrow();
  });

  it('does not throw with an empty template object', () => {
    expect(() => buildEmailHtml({}, {})).not.toThrow();
  });

  it('does not throw with null/undefined variables', () => {
    expect(() => buildEmailHtml(BASE, { firstName: null, lastName: undefined })).not.toThrow();
  });

  it('returns a non-empty string', () => {
    const html = buildEmailHtml(BASE, {});
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });
});
