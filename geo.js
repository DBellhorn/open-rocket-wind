/* Stores the latitude and longitude defining a geograpical location. */
class GeoLocation {
    /**
     * The latitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #latitude = 0.0;

    /**
     * The longitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #longitude = 0.0;

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} lat - The latitude component of this location.
     * @param {number} lon - The longitude component of this location.
     * @throws {TypeError} Invalid coordinate.
     */
    constructor(lat, lon) {
        if (isNaN(lat)) throw new TypeError(`Invalid latitude: ${lat}`);
        if (isNaN(lon)) throw new TypeError(`Invalid longitude: ${lon}`);

        this.#latitude = lat;
        this.#longitude = lon;
    }

    /**
     * Latitude component of this location's coordinates.
     * @type {number}
     */
    get latitude() { return this.#latitude; }
    set latitude(lat) { this.#latitude = lat; }

    /**
     * Longitude component of this location's coordinates.
     * @type {number}
     */
    get longitude() { return this.#longitude; }
    set longitude(lon) { this.#longitude = lon; }

    /**
     * Obtain a new object with duplicate data as this one.
     * @returns {GeoLocation} The duplicate object.
     */
    getCopy() {
        return new GeoLocation(this.#latitude, this.#longitude);
    }
}

export { GeoLocation };