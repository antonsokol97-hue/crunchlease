import { createElement as h } from 'react';
import { readFileSync } from 'node:fs';
import type { APIRoute } from 'astro';
import satori from 'satori';
import sharp from 'sharp';
import { SITE_NAME, TOOL_REGISTRY, CATEGORY_META } from '../../config';
import type { ToolMeta } from '../../lib/types';

// Per-tool OG images (SPEC.md §8): tool name + primary-metric line, rendered at
// build time. Fonts come from @fontsource (WOFF, which satori supports).
const root = process.cwd();
const fontHeading = readFileSync(
  `${root}/node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff`,
);
const fontBody = readFileSync(`${root}/node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff`);

const ACCENT = '#085efb';
const TEXT = '#0a0a0a';
const MUTED = '#737373';
const BORDER = '#e5e5e5';

export function getStaticPaths() {
  return TOOL_REGISTRY.map((tool) => ({ params: { slug: tool.slug }, props: { tool } }));
}

export const GET: APIRoute = async ({ props }) => {
  const tool = props.tool as ToolMeta;
  const category = CATEGORY_META[tool.category].name;

  const tree = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        backgroundColor: '#ffffff',
        fontFamily: 'DM Sans',
      },
    },
    // Header: brand mark + name
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '16px' } },
      h(
        'div',
        {
          style: {
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '32px',
            fontFamily: 'Plus Jakarta Sans',
          },
        },
        '$',
      ),
      h('div', { style: { fontSize: '28px', color: MUTED } }, SITE_NAME),
    ),
    // Body: tool name + description
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
      h('div', { style: { fontSize: '30px', color: ACCENT } }, category),
      h('div', { style: { fontSize: '68px', fontFamily: 'Plus Jakarta Sans', color: TEXT, lineHeight: 1.1 } }, tool.name),
      h('div', { style: { fontSize: '30px', color: MUTED, lineHeight: 1.4 } }, tool.shortDescription),
    ),
    // Footer rule
    h('div', {
      style: { borderTop: `2px solid ${BORDER}`, paddingTop: '24px', fontSize: '24px', color: MUTED, display: 'flex' },
    }, `${SITE_NAME} · free commercial real estate calculators`),
  );

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Plus Jakarta Sans', data: fontHeading, weight: 700, style: 'normal' },
      { name: 'DM Sans', data: fontBody, weight: 400, style: 'normal' },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
