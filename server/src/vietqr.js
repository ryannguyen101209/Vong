/*
 * VietQR / NAPAS payload builder.
 *
 * A VietQR code is an EMVCo "Merchant Presented QR" string: a flat list of
 * tag-length-value triples, where the length is always 2 digits, and the final
 * tag (63) is a CRC-16/CCITT-FALSE over everything before it (including the
 * "6304" header of the CRC field itself).
 *
 * Any Vietnamese banking app can scan the resulting string. We follow the field
 * set that NAPAS/VietQR uses in practice for bank-transfer QRs -- notably we do
 * NOT emit tags 59 (merchant name) and 60 (merchant city). EMVCo marks those
 * mandatory for card-style merchant QRs, but the bank-to-account VietQR strings
 * Vietnamese apps are used to reading omit them, and adding them is the more
 * likely way to get a "QR khong hop le" on a real phone.
 */

const GUID_VIETQR = 'A000000727';
const SERVICE_TO_ACCOUNT = 'QRIBFTTA'; // transfer to an account number
const CURRENCY_VND = '704';
const COUNTRY_VN = 'VN';

/** Encode one tag-length-value triple. Length is 2 digits, so value <= 99 chars. */
function tlv(tag, value) {
  const str = String(value);
  if (str.length > 99) {
    throw new Error(`VietQR field ${tag} is too long (${str.length} chars, max 99)`);
  }
  return `${tag}${String(str.length).padStart(2, '0')}${str}`;
}

/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no input or
 * output reflection, no final XOR. Returned as 4 uppercase hex digits.
 */
export function crc16ccitt(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Vietnamese banking apps only reliably render plain uppercase ASCII in the
 * transfer note, so fold diacritics and drop anything else.
 */
export function sanitizeNote(note) {
  return String(note ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (ch) => (ch === 'đ' ? 'd' : 'D'))
    .toUpperCase()
    .replace(/[^A-Z0-9 .,\-]/g, '')
    .trim()
    .slice(0, 25);
}

/**
 * Build the full VietQR payload string. Render it as an actual QR image on the
 * client -- the string itself is what gets encoded.
 */
export function buildVietQrPayload({ bankBin, accountNumber, amount, note }) {
  if (!/^\d{6}$/.test(String(bankBin ?? ''))) {
    throw new Error('bankBin must be the 6-digit NAPAS BIN of the bank');
  }
  if (!/^[A-Za-z0-9]{4,19}$/.test(String(accountNumber ?? ''))) {
    throw new Error('accountNumber must be 4-19 letters or digits');
  }

  const beneficiary = tlv('00', bankBin) + tlv('01', String(accountNumber));
  const merchantAccount =
    tlv('00', GUID_VIETQR) + tlv('01', beneficiary) + tlv('02', SERVICE_TO_ACCOUNT);

  let payload =
    tlv('00', '01') + // payload format indicator
    tlv('01', '12') + // 12 = dynamic (single use, carries an amount)
    tlv('38', merchantAccount) +
    tlv('53', CURRENCY_VND);

  const rounded = Math.round(Number(amount) || 0);
  if (rounded > 0) payload += tlv('54', String(rounded));

  payload += tlv('58', COUNTRY_VN);

  const cleanNote = sanitizeNote(note);
  if (cleanNote) payload += tlv('62', tlv('08', cleanNote));

  // The CRC covers the payload plus this field's own tag and length.
  const withCrcHeader = `${payload}6304`;
  return withCrcHeader + crc16ccitt(withCrcHeader);
}

/**
 * NAPAS bank identification numbers. Verify against napas.com.vn or
 * vietqr.io/danh-sach-api before taking real money with a bank not on this list.
 */
export const BANKS = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'VBA', name: 'Agribank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank' },
  { bin: '970437', code: 'HDB', name: 'HDBank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970440', code: 'SEAB', name: 'SeABank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank' },
  { bin: '970428', code: 'NAB', name: 'Nam A Bank' },
  { bin: '970409', code: 'BAB', name: 'BacA Bank' },
  { bin: '546034', code: 'CAKE', name: 'Cake by VPBank' },
  { bin: '963388', code: 'TIMO', name: 'Timo by Ban Viet Bank' },
];

export function findBank(bin) {
  return BANKS.find((bank) => bank.bin === String(bin));
}
