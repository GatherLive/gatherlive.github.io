// Images download as AES-GCM ciphertext. Keys arrive with the active question.
export const MAX_IMAGE = 3 * 1024 * 1024;
export const MAX_PACKED = MAX_IMAGE + 16384 + 33;
export const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const bytesFromKey = (key: string) => {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid image key.');
  return Uint8Array.from(key.match(/../g), part => parseInt(part, 16));
};
export async function sealImage(bytes: Uint8Array<ArrayBuffer>, mime: string, secret: string) {
  const type = TYPES.indexOf(mime);
  if (type < 0 || bytes.byteLength > MAX_IMAGE) throw new Error('Unsupported image.');
  const header = new Uint8Array(17);
  header.set([71, 73, 77, 1, type]);
  crypto.getRandomValues(header.subarray(5));
  const key = await crypto.subtle.importKey('raw', bytesFromKey(secret), 'AES-GCM', false, ['encrypt']);
  // Padding conceals exact file sizes, which can identify small public icons.
  const payload = new Uint8Array(Math.ceil((bytes.byteLength + 4) / 16384) * 16384);
  new DataView(payload.buffer).setUint32(0,bytes.byteLength);payload.set(bytes,4);
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv:header.subarray(5), additionalData:header.subarray(0,5)}, key, payload);
  const packed = new Uint8Array(header.length + ciphertext.byteLength);
  packed.set(header); packed.set(new Uint8Array(ciphertext), header.length);
  return packed;
}
export async function openImage(packed: Uint8Array<ArrayBuffer> | ArrayBuffer, secret: string) {
  const bytes = new Uint8Array(packed);
  if (bytes.length < 37 || bytes.length > MAX_PACKED || bytes[0] !== 71 || bytes[1] !== 73 || bytes[2] !== 77 || bytes[3] !== 1 || !TYPES[bytes[4]]) throw new Error('Invalid image data.');
  const key = await crypto.subtle.importKey('raw', bytesFromKey(secret), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(5,17), additionalData:bytes.subarray(0,5)}, key, bytes.subarray(17));
  if(plain.byteLength<4)throw new Error('Invalid image data.');
  const length=new DataView(plain).getUint32(0);
  if(length>MAX_IMAGE||length>plain.byteLength-4)throw new Error('Invalid image data.');
  return new Blob([new Uint8Array(plain,4,length)], {type:TYPES[bytes[4]]});
}
