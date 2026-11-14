import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildComposerShellHtml,
  composeTemplateSendBody,
  extractComposerNoteHtml,
  extractNoteAgainstLockedTemplate,
  isComposerHintParagraph,
  shellHasLockedTemplate,
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
});
