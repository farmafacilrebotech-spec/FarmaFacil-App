import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPOSER_NOTE_HINT,
  COMPOSER_UI_HINTS,
  buildComposerShellHtml,
  composeTemplateSendBody,
  extractComposerNoteHtml,
  extractNoteAgainstLockedTemplate,
  isComposerHintParagraph,
  shellHasLockedTemplate,
  stripComposerUiHints,
} from './composer-template-lock.ts';

describe('composer-template-lock', () => {
  it('preserva plantilla al unir nota', () => {
    const locked =
      '<table role="presentation"><tr><td>Plantilla Lanzadera completa</td></tr></table>';
    const shell = buildComposerShellHtml('<p>3065</p>', locked);
    assert.equal(shellHasLockedTemplate(shell), true);
    assert.match(extractComposerNoteHtml(shell), /3065/);
    const sent = composeTemplateSendBody({
      noteHtml: '<p>3065</p>',
      lockedTemplateHtml: locked,
    });
    assert.match(sent, /3065/);
    assert.match(sent, /Plantilla Lanzadera completa/);
  });

  it('sin nota envía solo la plantilla', () => {
    const locked = '<p>Cuerpo corporativo</p>';
    const sent = composeTemplateSendBody({
      noteHtml: '<p><br/></p>',
      lockedTemplateHtml: locked,
    });
    assert.equal(sent.includes('Cuerpo corporativo'), true);
    assert.equal(isComposerHintParagraph('<p><br/></p>'), true);
  });

  it('no trata el HTML de plantilla como nota (anti-duplicado)', () => {
    const locked =
      '<table><tr><td>Invitación piloto contenido original único</td></tr></table>';
    // Simula draft.htmlBody = plantilla íntegra tras applyTemplate
    const note = extractNoteAgainstLockedTemplate(locked, locked);
    assert.equal(isComposerHintParagraph(note), true);
    const shell = buildComposerShellHtml(note, locked);
    const count = (shell.match(/contenido original único/g) || []).length;
    assert.equal(count, 1);
  });

  it('EMAIL-10: hints UI del compositor no viajan al HTML enviado', () => {
    const locked =
      '<table role="presentation"><tr><td><img src="https://example.com/logo.png" alt="logo"/>Piloto corporativo</td></tr></table>';
    // Caso real: nota del usuario + párrafo hint residual del editor
    const dirtyNote = `<p>Nota personalizada UI-FINAL Piloto — validación compositor real.</p><p style="margin:0;color:#6B7280;font-size:12px;line-height:1.4;">${COMPOSER_NOTE_HINT}</p>`;
    const cleaned = stripComposerUiHints(dirtyNote);
    assert.match(cleaned, /Nota personalizada UI-FINAL/);
    assert.equal(cleaned.includes(COMPOSER_NOTE_HINT), false);
    for (const hint of COMPOSER_UI_HINTS) {
      assert.equal(cleaned.includes(hint), false);
    }

    const sent = composeTemplateSendBody({
      noteHtml: dirtyNote,
      lockedTemplateHtml: locked,
    });
    assert.match(sent, /Nota personalizada UI-FINAL/);
    assert.match(sent, /Piloto corporativo/);
    assert.match(sent, /<img\b/i);
    assert.equal(sent.includes(COMPOSER_NOTE_HINT), false);
    assert.equal(
      sent.includes('Plantilla corporativa de debajo se conserva intacta'),
      false
    );

    // Solo hint → no anteponer nota
    const onlyHint = composeTemplateSendBody({
      noteHtml: `<p><br/></p><p>${COMPOSER_NOTE_HINT}</p>`,
      lockedTemplateHtml: locked,
    });
    assert.equal(onlyHint.includes('data-ff-user-note'), false);
    assert.equal(onlyHint.includes(COMPOSER_NOTE_HINT), false);
    assert.match(onlyHint, /Piloto corporativo/);

    // Extracción desde shell sucio
    const shell = buildComposerShellHtml('<p><br/></p>', locked).replace(
      COMPOSER_NOTE_HINT,
      `Nota real del usuario.</p><p style="color:#6B7280">${COMPOSER_NOTE_HINT}`
    );
    // Forzar shell con nota+hint como en DOM tras type()
    const dirtyShell = `<div data-ff-composer-note="1">${dirtyNote}</div>
<div data-ff-template-locked="1" contenteditable="false">${locked}</div>`;
    const extracted = extractComposerNoteHtml(dirtyShell);
    assert.match(extracted, /Nota personalizada/);
    assert.equal(extracted.includes(COMPOSER_NOTE_HINT), false);
    void shell;
  });
});
