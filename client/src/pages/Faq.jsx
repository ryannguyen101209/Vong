import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { ChevronDownIcon } from '../components/Icons.jsx';

/* Order of the questions. Each id has a `faq.<id>Q` and a `faq.<id>A` string. */
const QUESTIONS = ['cost', 'whyFee', 'howLong', 'escrow', 'reachSeller', 'scam', 'edit', 'paid', 'area', 'app'];

export function Faq() {
  const { t, lang } = useI18n();
  const [fee, setFee] = useState(null);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    api.meta().then((meta) => setFee(meta.fee_vnd)).catch(() => {});
  }, []);

  const vars = { fee: fee == null ? '…' : formatPrice(fee, lang) };

  return (
    <div className="info">
      <div className="shell info__col">
        <div className="info__head">
          <h1>{t('faq.title')}</h1>
          <p>{t('faq.lead')}</p>
        </div>

        {/* A question, and the answer beneath it as a reply. One open at a time. */}
        <ul className="qa">
          {QUESTIONS.map((id, index) => {
            const open = openIndex === index;
            return (
              <li className="qa__item" key={id}>
                <h2 className="qa__q">
                  <button
                    type="button"
                    id={`faq-q-${id}`}
                    aria-expanded={open}
                    aria-controls={`faq-a-${id}`}
                    onClick={() => setOpenIndex(open ? -1 : index)}
                  >
                    <span>{t(`faq.${id}Q`)}</span>
                    <ChevronDownIcon size={20} />
                  </button>
                </h2>
                <div className="qa__a" id={`faq-a-${id}`} role="region" aria-labelledby={`faq-q-${id}`} hidden={!open}>
                  <p>{t(`faq.${id}A`, vars)}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="info__actions">
          <Link to="/contact" className="btn">{t('nav.contact')}</Link>
        </div>
      </div>
    </div>
  );
}
