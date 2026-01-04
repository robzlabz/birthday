export class TimezoneService {
    /**
     * Returns all supported timezones from the Intl API.
     */
    listSupportedTimezones(): string[] {
        return Intl.supportedValuesOf("timeZone");
    }

    /**
     * Determines which timezones are currently at a target hour (e.g., 9 AM)
     * and which ones recently passed it (for catch-up logic).
     */
    getTimezoneWindows(now: Date, targetHour: number) {
        const allTimezones = this.listSupportedTimezones();
        const activeTz: string[] = [];
        const missedTz: string[] = [];

        for (const tz of allTimezones) {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false
            });

            try {
                const localHour = parseInt(formatter.format(now));

                if (localHour === targetHour) {
                    activeTz.push(tz);
                } else if (localHour > targetHour && localHour < targetHour + 2) {
                    // Catch-up logic for timezones that passed 9 AM in the last 2 hours.
                    missedTz.push(tz);
                }
            } catch (e) {
                console.error(`[TimezoneService] Error formatting time for zone ${tz}:`, e);
            }
        }

        return { activeTz, missedTz };
    }
}
