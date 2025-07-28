/* Stores all date and time values that a launch is active. */
class LaunchTimeData {
    /**
     * The date on which this launch occurs. Includes starting hour.
     * @private
     * @type {Date}
     */
    #launchDate = null;

    /**
     * The date on which this launch concludes. Includes final hour.
     * @private
     * @type {Date}
     */
    #endDateWithHour = null;

    /**
     * The hour (0 - 23) when this launch ends.
     * @private
     * @type {number}
     */
    #endHour = 0;

    /**
     * The difference in hours of the launch's start time from now.
     * @private
     * @type {number}
     */
    #startHourOffset = 0;
    
    /**
     * The difference in hours of the launch's end time from now.
     * @private
     * @type {number}
     */
    #endHourOffset = 0;

    /**
     * Initializes launch Date and times based on provided strings. Also determines hour offsets from the current time.
     * @param {string} launchDateValue - String representing the date when this launch occurs (YYYY-MM-DD).
     * @param {string} startTimeValue - String representing the hour this launch begins (HH:MM).
     * @param {string} endTimeValue - String representing the hour this launch ends (HH:MM).
     * @throws {TypeError} Invalidly formated date or time string.
     */
    constructor(launchDateValue, startTimeValue, endTimeValue) {
        if (launchDateValue.length < 10) {
            window.alert(`Invalid launch date: ${launchDateValue}`);
            throw new TypeError(`Invalid launch date string: ${launchDateValue}`);
        }
        if (startTimeValue.length < 2) {
            window.alert(`Invalid launch start time: ${startTimeValue}`);
            throw new TypeError(`Invalid launch start time string: ${startTimeValue}`);
        }
        if (endTimeValue.length < 2) {
            window.alert(`Invalid launch end time: ${endTimeValue}`);
            throw new TypeError(`Invalid launch end time string: ${endTimeValue}`);
        }

        let numYear = parseInt(launchDateValue.substring(0, 4));
        let numMonth = parseInt(launchDateValue.substring(5, 7));
        let numDay = parseInt(launchDateValue.substring(8, 10));

        // Verify the date components are valid
        if (isNaN(numYear) || isNaN(numMonth) || isNaN(numDay)) {
            window.alert(`Invalid launch date string: ${launchDateValue}`);
            throw new TypeError(`Invalid launch date string: ${launchDateValue}`);
        }
    
        // Convert into just a date ignoring hours, minutes, and seconds
        let today = new Date();
        let currentHour = today.getHours();
        today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
        // Ignoring minute and second components
        let startHour = parseInt(startTimeValue.substring(0, 2));
        if (isNaN(startHour)) {
            window.alert(`Invalid launch start time: ${startTimeValue}`);
            throw new TypeError(`Invalid launch start time: ${startTimeValue}`);
        }

        this.#endHour = parseInt(endTimeValue.substring(0, 2));
        if (isNaN(this.#endHour)) {
            window.alert(`Invalid launch end time: ${endTimeValue}`);
            throw new TypeError(`Invalid launch end time: ${endTimeValue}`);
        }
        if (this.#endHour < startHour) {
            window.alert(`Launch ends before it starts`);
            throw new TypeError(`Launch ends before it starts`);
        }

        // Store the launch's date and starting hour.
        this.#launchDate = new Date(numYear, numMonth - 1, numDay, startHour);

        // Store the launch's date and ending hour.
        this.#endDateWithHour = new Date(numYear, numMonth - 1, numDay, this.#endHour);

        // Calculate the offset of this launch's start time from now in hours.
        let rightNow = new Date();

        // Now we can store offsets from now to the start and end hours.
        this.#startHourOffset = Math.ceil((this.#launchDate - rightNow) / 3600000);
        this.#endHourOffset = Math.ceil((this.#endDateWithHour - rightNow) / 3600000);
    }

    /**
     * Get the date on which this launch occurs including the starting hour.
     * @type {Date}
     */
    get launchDate() {
        return this.#launchDate;
    }

    /**
     * Get the hour (0 - 23) when this launch ends.
     * @type {number}
     */
    get endHour() {
        return this.#endHour;
    }

    /**
     * Get the difference in hours of the launch's start time from now.
     * @type {number}
     */
    get startHourOffset() {
        return this.#startHourOffset;
    }
    
    /**
     * Get the difference in hours of the launch's end time from now.
     * @type {number}
     */
    get endHourOffset() {
        return this.#endHourOffset;
    }

    /**
     * Generates a string version of the date and start time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getStartTimeAsISOString() {
        const startMonth = this.#launchDate.getMonth() + 1;
        return `${this.#launchDate.getFullYear()}-${startMonth.toString().padStart(2, '0')}-${this.#launchDate.getDate().toString().padStart(2, '0')}T${this.#launchDate.getHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and end time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getEndTimeAsISOString() {
        const endMonth = this.#endDateWithHour.getMonth() + 1;
        return `${this.#endDateWithHour.getFullYear()}-${endMonth.toString().padStart(2, '0')}-${this.#endDateWithHour.getDate().toString().padStart(2, '0')}T${this.#endDateWithHour.getHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and start time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getUTCStartTimeAsISOString() {
        const startUTCMonth = this.#launchDate.getUTCMonth() + 1;
        return `${this.#launchDate.getUTCFullYear()}-${startUTCMonth.toString().padStart(2, '0')}-${this.#launchDate.getUTCDate().toString().padStart(2, '0')}T${this.#launchDate.getUTCHours().toString().padStart(2, '0')}:00`;
    }

    /**
     * Generates a string version of the date and end time according to the ISO 8601 standard.
     * @returns {string} Date formatted according to ISO 8601 standard.
     */
    getUTCEndTimeAsISOString() {
        const endUTCMonth = this.#endDateWithHour.getUTCMonth() + 1;
        return `${this.#endDateWithHour.getUTCFullYear()}-${endUTCMonth.toString().padStart(2, '0')}-${this.#endDateWithHour.getUTCDate().toString().padStart(2, '0')}T${this.#endDateWithHour.getUTCHours().toString().padStart(2, '0')}:00`;
    }
}

export { LaunchTimeData };