/** Byte-level maidata decoding, identical to `src/cli.ts` in the engine:
 *  a BOM selects UTF-16 LE/BE, everything else is strict UTF-8. */
export function decodeMaidata(bytes: Uint8Array): string {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try {
    return new TextDecoder(encoding, {fatal: true}).decode(bytes);
  } catch {
    throw new Error('文件编码无法识别，请保存为 UTF-8（也支持带 BOM 的 UTF-16）。');
  }
}

/** The engine reads files as bytes, so a pasted string is encoded back to bytes
 *  first. That keeps paste and upload on exactly the same code path. */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
