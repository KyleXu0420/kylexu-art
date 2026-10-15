// Structured data (schema.org JSON-LD) so search engines and AI assistants can tell who this site is
// about and what each page is. One Person, referenced by @id from every page that names him.
import { works } from '../data/art';

export const SITE = 'https://www.kylexu.art';
export const PERSON_ID = SITE + '/#kyle';

export const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Kyle Xu',
  alternateName: '徐匡泓',
  jobTitle: 'AI Product Designer',
  description: 'Kyle Xu designs how AI products behave, and the interface that keeps people in control of it: AI products and complex B2B software.',
  url: SITE + '/',
  email: 'mailto:kylexu@umich.edu',
  image: SITE + '/og-about.jpg',
  sameAs: ['https://www.linkedin.com/in/kyle-xu-a111161a4/', 'https://github.com/KyleXu0420'],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'University of Michigan', department: 'School of Information (M.S. Information, HCI)' },
    { '@type': 'CollegeOrUniversity', name: "Xi'an University of Architecture and Technology" },
  ],
  knowsAbout: ['AI product design', 'Human–agent interaction', 'AI UX', 'Agent workflows', 'Design systems', 'Information architecture', 'Design engineering', 'Motion design', 'Creative coding', 'B2B SaaS'],
  knowsLanguage: ['en', 'zh'],
};

export const website = { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'Kyle Xu', publisher: { '@id': PERSON_ID }, inLanguage: 'en' };

/** a case study or an artwork: a CreativeWork by Kyle */
export function work(o: { name: string; description: string; path: string; image?: string; date?: string; genre?: string; about?: string }) {
  return {
    '@type': 'CreativeWork', name: o.name, description: o.description, url: SITE + o.path,
    ...(o.image ? { image: SITE + o.image } : {}), ...(o.date ? { dateCreated: o.date } : {}),
    ...(o.genre ? { genre: o.genre } : {}), ...(o.about ? { about: o.about } : {}),
    creator: { '@id': PERSON_ID }, inLanguage: 'en',
  };
}

export const graph = (...nodes: object[]) => ({ '@context': 'https://schema.org', '@graph': nodes });

/** the pages a crawler should know, with the works read from the Art list */
export const pages = ['/', '/about', '/projects/heygen', '/projects/eaton', '/art', ...works.map((w) => '/art/' + w.slug)];
