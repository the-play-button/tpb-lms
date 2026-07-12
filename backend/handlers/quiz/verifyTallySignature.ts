/**
 * Verify Tally webhook signature (HMAC-SHA256)
 */

import { log } from './_shared.js';

export const verifyTallySignature = async (request: Request, signingSecret) => {
    const signature = request.headers.get('Tally-Signature');
    const body = await request.text();

    if (!signature) return { isValid: false, body, noSignature: true };

    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(signingSecret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(body));
        return { isValid, body, noSignature: false };
    } catch (error) {
        log.error('Signature verification error', { error });
        return { isValid: false, body, noSignature: false, error: 'Signature verification failed' };
    }
};
