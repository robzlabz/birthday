import { describe, expect, it } from 'vitest';
import timezones from './timezone';

describe('Timezone Route', () => {
    it('GET / should return a list of supported timezones', async () => {
        const res = await timezones.request('/');
        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data.length).toBeGreaterThan(0);

        // Verify some common timezones are present (sanity check)
        // expect(body.data).toContain('UTC');
        expect(body.data).toContain('Asia/Jakarta');
    });
});
