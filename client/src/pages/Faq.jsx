import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { PlusIcon } from '../components/Icons.jsx';

export function Faq() {
  const { t, tList, lang } = useI18n();
  const [fee, setFee] = useState(null);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    api.meta().then((meta) => setFee(meta.fee_vnd)).catch(() => {});
  }, []);

  const items = tList('faq.items', { fee: fee == null ? '…' : formatPrice(fee, lang) });

  return (
    <div className="shell section editorial-page faq-page">
      <div className="section-head">
        <h1>{t('faq.title')}</h1>
        <p className="lead">{t('faq.lead')}</p>
      </div>

      <div className="accordion">
        {items.map((item, index) => {
          const open = openIndex === index;
          return (
            <div className="accordion__item" data-open={open} key={item.q}>
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  className="accordion__trigger"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${index}`}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <span>{item.q}</span>
                  <span className="accordion__icon"><PlusIcon /></span>
                </button>
              </h3>
              {open && (
                <div className="accordion__panel" id={`faq-panel-${index}`}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 36 }}>
        <Link to="/contact" className="btn">{t('nav.contact')}</Link>
      </div>
    </div>
  );
}
