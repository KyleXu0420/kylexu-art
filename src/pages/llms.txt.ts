// llms.txt: the site in a few lines, for AI assistants (llmstxt.org). Facts only, from the site's own copy.
import type { APIRoute } from 'astro';
import { SITE } from '../lib/schema';
import { works } from '../data/art';

export const GET: APIRoute = () => {
  const art = works.map((w) => `- [${w.title}](${SITE}/art/${w.slug}): ${w.year}, ${w.medium.toLowerCase()}.`).join('\n');
  const body = `# Kyle Xu

> AI product designer. Kyle Xu designs how AI products behave, and the interface that keeps people in control of it — AI products and complex B2B software. M.S. in Information (HCI), University of Michigan; trained in architecture before that. Pronouns he/him. Contact: kylexu@umich.edu.

Experience, most recent first: Temper (Design Engineer, contract, 2026) · Dify / LangGenius (AI Product Designer, 2026: the Agent in Dify Enterprise, Droploft, Syncless) · Curio Digital Therapeutics (Founding Product Designer, 2024–2025: MamaLift and MenoLift, FDA-cleared digital therapeutics) · Infloww (Product Designer, AI Specialist, 2024: an AI chat assistant) · Heygen (Product Design Intern, 2023) · Eaton (UX Design Intern, 2022).

## Pages

- [Work](${SITE}/): the claim, selected projects and the full work history.
- [About](${SITE}/about): background, from architecture to AI products; skills, tools, education.

## Case studies

- [Heygen](${SITE}/projects/heygen): the AI video editor re-architected around the script; decisions first, then the full record.
- [Eaton](${SITE}/projects/eaton): RapidLinkX, an IoT configuration tool for airport conveyor drives; why the slower, safer editor shipped.

## Art

${art}

## Elsewhere

- [LinkedIn](https://www.linkedin.com/in/kyle-xu-a111161a4/)
- [GitHub](https://github.com/KyleXu0420)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
