import { Hono } from 'hono';

const timezones = new Hono();

timezones.get('/', (c) => {
    // get all supported timezones for the UI
    const allTimezones = Intl.supportedValuesOf("timeZone");
    return c.json({ data: allTimezones });
});

export default timezones;
