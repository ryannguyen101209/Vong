import { useI18n } from '../i18n/index.jsx';
import { HCM_WARDS } from '../lib/hcm-wards.js';

const WARD_AREA = new Map(HCM_WARDS.map((ward) => [ward.key, ward.area]));

/**
 * The <option>s for a city's areas. Saigon's 168 wards are grouped under the
 * former district they mostly came from, so people can find theirs. `current`
 * keeps an area that is no longer offered (an older listing's district) selectable.
 */
export function AreaOptions({ keys, current = '' }) {
  const { t } = useI18n();
  const option = (key) => <option key={key} value={key}>{t(`districts.${key}`)}</option>;
  const kept = current && !keys.includes(current) ? option(current) : null;
  if (!keys.some((key) => WARD_AREA.has(key))) return <>{kept}{keys.map(option)}</>;

  const groups = new Map();
  for (const key of keys) {
    const area = WARD_AREA.get(key) ?? '';
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(key);
  }
  return (
    <>
      {kept}
      {[...groups].map(([area, wards]) => (
        <optgroup key={area} label={t('sell.formerArea', { area })}>{wards.map(option)}</optgroup>
      ))}
    </>
  );
}
