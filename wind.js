/* Class storing wind speed and direction at a specific altitude. */
class WindAtAltitude {
    /**
     * The altitude (in feet) where this wind is located.
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * The speed of the wind (in MPH).
     * @private
     * @type {number}
     */
    #windSpeed = 0;

    /**
     * Direction of the wind (degrees from 0 North).
     * @private
     * @type {number}
     */
    #windDirection = 0;

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {number} alt - Altitude (in feet).
     * @param {number} speed - Wind speed (in knots).
     * @param {number} dir - Wind direction (in degrees from North).
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(alt, speed, dir) {
        // Verify the provided values are all valid numbers
        if (isNaN(alt)) throw new TypeError(`Invalid wind altitude: ${alt}`);
        if (isNaN(speed)) throw new TypeError(`Invalid wind speed: ${speed}`);
        if (isNaN(dir)) throw new TypeError(`Invalid wind direction: ${dir}`);

        this.#altitude = alt;
        this.#windSpeed = speed;
        this.#windDirection = dir;
    }

    /**
     * Get the altitude where the described wind is located.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the wind's speed at this altitude.
     * @type {number}
     */
    get windSpeed() {
        return this.#windSpeed;
    }

    /**
     * Get the wind's direction at this altitude.
     * @type {number}
     */
    get windDirection() {
        return this.#windDirection;
    }
}

// Export our class definitions
export { WindAtAltitude };