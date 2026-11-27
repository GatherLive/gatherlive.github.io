import type {DataRecord} from '../../../shared/types.js';

export const SELF_STUDY_FORMAT = 'gather.self-study';

export function packSelfStudyQuiz(quiz: DataRecord) {
    const bytes = new TextEncoder().encode(JSON.stringify(quiz));
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return {format: SELF_STUDY_FORMAT, version: 1, encoding: 'base64url', payload};
}

export function unpackSelfStudyQuiz(envelope: DataRecord): DataRecord {
    if (envelope.version !== 1) throw new Error('This Solo play file version is unsupported.');
    if (envelope.encoding == null && envelope.quiz && typeof envelope.quiz === 'object' && !Array.isArray(envelope.quiz)) {
        return envelope.quiz;
    }
    try {
        if (envelope.encoding !== 'base64url' || typeof envelope.payload !== 'string' || !/^[A-Za-z0-9_-]+$/.test(envelope.payload)) throw new Error();
        const binary = atob(envelope.payload.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    } catch {
        throw new Error('This Solo play file could not be read. Ask your AI for a complete Gather Solo play JSON file.');
    }
}
