import { Hono } from 'hono';

const timezones = new Hono();

timezones.get('/', (c) => {
    // mendapatkan semua timezone yang didukung
    const allTimezones = Intl.supportedValuesOf("timeZone");
    return c.json({ data: allTimezones });
});

export default timezones;
