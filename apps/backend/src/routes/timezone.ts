import { Hono } from 'hono';
import { TimezoneService } from '../service/timezone.service';

const timezones = new Hono();

timezones.get('/', (c) => {
    const timezoneService = new TimezoneService();
    const data = timezoneService.listSupportedTimezones();
    return c.json({ data });
});

export default timezones;
