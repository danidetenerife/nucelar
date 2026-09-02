type EncodedSecret = {
  secret: string;
  version: number;
};

export type DecodedSecret = {
  hexSecret: string;
  version: number;
};

export const TOTP_LOCAL_PERIOD = 30;
export const TOTP_SERVER_PERIOD = 900;
const XOR_MODULO = 33;
const XOR_OFFSET = 9;
const TOTP_DIGITS = 6;

export const ENCODED_SECRETS: EncodedSecret[] = [
  { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 },
  { secret: 'OmE{ZA.J^":0FG\\Uz?[@WW', version: 60 },
  { secret: '{iOFn;4}<1PFYKPV?5{%u14]M>/V0hDH', version: 59 },
];

const xorDecode = (charCode: number, index: number): number =>
  charCode ^ ((index % XOR_MODULO) + XOR_OFFSET);

const xorDecodeToHex = (values: number[]): string => {
  const decoded = values.map((value, index) => xorDecode(value, index));
  const joined = decoded.join('');
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(joined);
  return Array.from(utf8Bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const decodeStringSecret = (encoded: string): string =>
  xorDecodeToHex(encoded.split('').map((char) => char.charCodeAt(0)));

export const decodeIntArraySecret = (values: number[]): string =>
  xorDecodeToHex(values);

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let offset = 0; offset < hex.length; offset += 2) {
    bytes[offset / 2] = parseInt(hex.substring(offset, offset + 2), 16);
  }
  return bytes;
};

export const generateTotp = async (hexSecret: string, timeSec: number, period: number): Promise<string> => {
  const counter = Math.floor(timeSec / period);

  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter >>> 0);

  const secretBytes = hexToBytes(hexSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
  const digest = new Uint8Array(signature);

  const truncationOffset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[truncationOffset] & 0x7f) << 24) |
    ((digest[truncationOffset + 1] & 0xff) << 16) |
    ((digest[truncationOffset + 2] & 0xff) << 8) |
    (digest[truncationOffset + 3] & 0xff);

  const code = truncated % Math.pow(10, TOTP_DIGITS);
  return code.toString().padStart(TOTP_DIGITS, '0');
};
