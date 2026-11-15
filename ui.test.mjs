import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('el panel v17 utiliza un sistema visual propio y no depende de utilidades Tailwind añadidas en runtime', () => {
  assert.match(html, /id="study-v17-design-system"/);
  assert.match(html, /class="study-v17"/);
  assert.match(html, /\.sv-hero\s*\{/);
  assert.match(html, /\.sv-metrics\s*\{/);
});

test('la navegación conserva los identificadores de vistas y usa una banda horizontal compacta', () => {
  for (const view of ['today', 'phases', 'pending', 'exams', 'subjects', 'library', 'flashcards', 'review', 'focus', 'progress']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
  assert.match(html, /#view-mode-buttons\s*\{[^}]*flex-wrap:\s*nowrap/s);
  assert.match(html, /#app-navigation/);
});

test('el panel conserva acciones de navegación y acceso directo a Focus por tema', () => {
  assert.match(html, /data-dashboard-focus=/);
  assert.match(html, /data-dashboard-nav="focus"/);
  assert.match(html, /data-dashboard-nav="library"/);
  assert.match(html, /data-dashboard-nav="flashcards"/);
});

test('el diseño declara adaptación para móvil, tableta y escritorio', () => {
  assert.match(html, /@media\s*\(max-width:\s*1050px\)/);
  assert.match(html, /@media\s*\(max-width:\s*760px\)/);
  assert.match(html, /@media\s*\(max-width:\s*460px\)/);
});

test('el diseño mantiene foco visible por teclado y respeta movimiento reducido', () => {
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
});

test('las pantallas secundarias comparten superficies, campos y botones coherentes', () => {
  assert.match(html, /#view-library-container article/);
  assert.match(html, /#view-focus-container > div:first-child/);
  assert.match(html, /main input:not\(\[type="file"\]\)/);
  assert.match(html, /main button\.bg-indigo-600/);
});
