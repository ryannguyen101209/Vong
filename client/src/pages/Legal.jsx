import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import legalEn from '../legal/en.js';
import legalVi from '../legal/vi.js';

const CONTENT = { en: legalEn, vi: legalVi };
export const LEGAL_PAGES = [
  ['terms', '/terms'],
  ['privacy', '/privacy'],
  ['rules', '/rules'],
];

/** A legal page's title in the current language, for links in running text. */
export function legalTitle(lang, page) {
  return (CONTENT[lang] ?? CONTENT.vi)[page].title;
}

/** Paragraphs, with runs of "- " lines grouped into one list. */
function Body({ lines }) {
  const blocks = [];
  for (const line of lines) {
    if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else {
      blocks.push(line);
    }
  }
  return blocks.map((block, index) =>
    Array.isArray(block) ? (
      <ul key={index}>{block.map((item) => <li key={item}>{item}</li>)}</ul>
    ) : (
      <p key={index}>{block}</p>
    )
  );
}

/** Terms, privacy and listing rules share one layout. */
export function Legal({ page }) {
  const { t, lang } = useI18n();
  const content = CONTENT[lang] ?? CONTENT.vi;
  const doc = content[page];

  return (
    <div className="shell section editorial-page legal-page">
      <div className="section-head">
        <p className="eyebrow">{content.updated}</p>
        <h1>{doc.title}</h1>
        <p className="lead">{doc.lead}</p>
      </div>

      <nav className="legal-nav" aria-label={t('footer.legalLinks')}>
        {LEGAL_PAGES.map(([key, path]) => (
          <Link key={key} to={path} className="chip" aria-current={key === page ? 'page' : undefined}>
            {content[key].title}
          </Link>
        ))}
      </nav>

      <div className="prose">
        {doc.sections.map((section) => (
          <section key={section.h}>
            <h2>{section.h}</h2>
            <Body lines={section.p} />
          </section>
        ))}
      </div>

      <div className="card panel" style={{ marginTop: 40 }}>
        <p style={{ margin: 0 }}>{content.draftNote}</p>
      </div>

      <div className="row" style={{ marginTop: 32 }}>
        <Link to="/contact" className="btn btn--ghost">{t('nav.contact')}</Link>
      </div>
    </div>
  );
}
