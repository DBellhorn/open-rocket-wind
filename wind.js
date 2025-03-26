import { GeoLocation, moveAlongBearingKilometers, feetToMeters, metersToFeet } from "./geo.js";
import { LaunchTimeData } from "./launch.js";
//import { wind0900 } from "./hedley.js";

const openMeteoWindAltitudes = [10, 80, 120, 180];
const openMeteoPressureLevels = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 70, 50, 30];

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

/* Class containing wind data at all available altitudes from a particular forecast model. */
class WindForecastData {
    /**
     * String identifying which model (RAP or Open-Meteo) was used for this forecast.
     * @private
     * @type {string}
     */
    #model = '';

    /**
     * List of wind data (speed/direction) at various altitudes.
     * @private
     * @type {Array.<WindAtAltitude>}
     */
    #windData = [];

    /**
     * Elevation at the location where this forecast was requested.
     * @private
     * @type {number}
     */
    #groundElevation = 0;

    /**
     * Wind speed (knots) at ground level.
     * @private
     * @type {number}
     */
    #groundWindSpeed = 0;

    /**
     * Wind direction (degrees from 0 north) at ground level.
     * @private
     * @type {number}
     */
    #groundWindDirection = 0;
    
    /**
     * Constructor initializes members to default values.
     */
    constructor() {
        this.#model = '';
        this.#windData = [];
        this.#groundElevation = 0;
        this.#groundWindSpeed = 0;
        this.#groundWindDirection = 0;
    }

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {json} windJSON - A JSON formated object contaning raw data associated with a wind forecast.
     */
    loadWindsAloftData(windJSON) {
        this.#model = windJSON.model;

        // References to different wind data objects based on the prediction model
        var altitudes;
        var windSpeeds;
        var windDirections;

        if ('RAP' == this.#model) {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFtRaw);
            windSpeeds = windJSON.speedRaw;
            windDirections = windJSON.directionRaw;
        } else {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFt);
            windSpeeds = windJSON.speed;
            windDirections = windJSON.direction;
        }

        // Convert the altitude set into an array so it can be sorted
        altitudes = Array.from(altitudes);
        altitudes.sort((a, b) => {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            }
            return 0;
        });

        // Add a new object to our array containing data for each altitude
        for (const currentAlt of altitudes) {
            let stringAlt = currentAlt.toString();

            // Verify wind speed and direction at this altitude are available
            if (stringAlt in windSpeeds && stringAlt in windDirections) {
                this.#windData.push(new WindAtAltitude(currentAlt, parseInt(windSpeeds[stringAlt]), parseInt(windDirections[stringAlt])));
            } else {
                console.debug(`Failed to find wind data for altitude ${currentAlt}`);
            }
        }

        if ('groundElev' in windJSON) {
            this.#groundElevation = windJSON['groundElev'];
        }
        if ('groundSpd' in windJSON) {
            this.#groundWindSpeed = windJSON['groundSpd'];
        }
        if ('groundSpd' in windJSON) {
            this.#groundWindDirection = windJSON['groundSpd'];
        }
    }

    /**
     * Initialize members with the provided information.
     * @param {number} elevation - Height (meters) above mean sea level at this forecast's location.
     * @param {json} groundSpeed - Speed (knots) the wind is blowing at ground level. 
     * @param {json} groundDirection - Direction (degrees from 0 north) the wind is blowing at ground level.
     * @param {Array.<WindAtAltitude>} windArray - List of wind data at ascending altitudes.
     */
    loadOpenMeteoData(elevation, groundSpeed, groundDirection, windArray) {
        this.#model = 'Open-Meteo';
        this.#groundElevation = elevation;
        this.#groundWindSpeed = groundSpeed;
        this.#groundWindDirection = groundDirection;
        this.#windData = windArray;
    }

    /**
     * Get the latitude component of this location's coordinates.
     * @type {string}
     */
    get model() { return this.#model; }

    /**
     * Get the list of wind data (speed/direction) at various altitudes.
     * @type {Array.<WindAtAltitude>}
     */
    get windData() { return this.#windData; }

    /**
     * The ground's elevation at location of this forecast.
     * @type {number}
     */
    get groundElevation() { return this.#groundElevation; }

    /**
     * The wind speed (knots) at ground level.
     * @type {number}
     */
    get groundWindSpeed() { return this.#groundWindSpeed; }

    /**
     * The wind direction (degrees from 0 north) at ground level.
     * @type {number}
     */
    get groundWindDirection() { return this.#groundWindDirection; }
}

/* Class storing expected results of weathercocking at a particular wind speed. */
class WeathercockWindData {
    /**
     * Initializes to the provided weathercocking results at the specified wind speed.
     * @param {number} speed - Wind speed (in MPH) at ground level.
     * @param {number} dist - Distance (in feet) the rocket travels up wind.
     * @param {number} alt - Altitude (in feet) the rocket is expected to reach.
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(speed, dist, alt) {
        // Verify the provided values are all valid numbers
        if (isNaN(speed)) throw new TypeError(`Invalid weathercock wind speed: ${speed}`);
        if (isNaN(dist)) throw new TypeError(`Invalid weathercock distance: ${dist}`);
        if (isNaN(alt)) throw new TypeError(`Invalid weathercock altitude: ${alt}`);

        /**
         * The wind speed (in MPH) at ground level.
         * @type {number}
         */
        this.windSpeed = speed;

        /**
         * The distance (in feet) the rocket travels up wind.
         * @type {number}
         */
        this.upwindDistance = dist;

        /**
         * The altitude (in feet) the rocket is expected to reach.
         * @type {number}
         */
        this.apogee = alt;
    }
}

/**
 * Requests wind forecast data from WindsAloft server to be provided as a JSON object.
 * @param {GeoLocation} launchLocation - Coordinates of the launch location.
 * @param {number} hourOffset - Offset (in hours) from the current time of the desired forecast.
 * @returns {WindForecastData} Wind forecast data at the specified location and time. 'null' if an error occurred.
 */
async function getWindPredictionData(launchLocation, hourOffset) {
    let windForecast = null;

    const timeAndPlace = {
        "latitude": launchLocation.latitude,
        "longitude": launchLocation.longitude,
        "hour_offset": hourOffset
    };

    const fetchOptions = {
        "method": "POST",
        "headers": {
            "Content-Type": "application/json; charset=utf-8"
        },
        "body": JSON.stringify(timeAndPlace)
    };

    await fetch('get_wind_forecast.php', fetchOptions)
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                console.debug(`Request failed for winds for lat ${launchLocation.latitude}, lon ${launchLocation.longitude}, and hour offset ${hourOffset}`);
                return null;
            }
        })
        .then((windJSON) => {
            if (null != windJSON) {
                windForecast = new WindForecastData();
                windForecast.loadWindsAloftData(windJSON);
            }
        })
        .catch(error => {
            console.debug(`An error was caught while fetching a wind forecast. ${error.message}`);
        });

    return windForecast;

    // let theForecast = new WindForecastData();
    // theForecast.loadWindsAloftData(wind0900);
    // return theForecast;
}

/**
 * Requests wind forecast data from Open-Meteo API to be provided as a JSON object.
 * @param {GeoLocation} launchLocation - Coordinates of the launch location.
 * @param {LaunchTimeData} launchTimes - Date, start time, and end time of the launch.
 * @returns {Array.<WindForecastData>} Wind forecast data at the specified location and time. 'null' if an error occurred.
 */
async function getOpenMeteoWindPredictionData(launchLocation, launchTimes) {
    let windForecastList = [];

    // Begin forming a request for Open-Meteo's API with the launch location.
    let fetchRequest = `https://api.open-meteo.com/v1/forecast?latitude=${launchLocation.latitude}&longitude=${launchLocation.longitude}`;

    // Specify the launch's active hours.
    fetchRequest += `&start_hour=${launchTimes.getStartTimeAsISOString()}&end_hour=${launchTimes.getEndTimeAsISOString()}`;

    // Request wind speeds to be in knots.
    fetchRequest += '&wind_speed_unit=kn';

    // Prepare for hourly forecast parameters.
    fetchRequest += '&hourly=';

    // Request wind speeds at set heights above ground level.
    let addComma = false;
    for (const altitude of openMeteoWindAltitudes) {
        if (addComma) {
            fetchRequest += ',';
        } else {
            addComma = true;
        }
        fetchRequest += `wind_speed_${altitude}m`;
    }

    // Request wind directions at set heights above ground level.
    for (const altitude of openMeteoWindAltitudes) {
        fetchRequest += `,wind_direction_${altitude}m`;
    }

    // Request wind speeds at all atmospheric pressure levels.
    for (const pressure of openMeteoPressureLevels) {
        fetchRequest +=`,wind_speed_${pressure}hPa`;
    }

    // Request wind directions at all atmospheric pressure levels.
    for (const pressure of openMeteoPressureLevels) {
        fetchRequest +=`,wind_direction_${pressure}hPa`;
    }

    // Request geopotential height at all atmospheric pressure levels.
    for (const pressure of openMeteoPressureLevels) {
        fetchRequest +=`,geopotential_height_${pressure}hPa`;
    }

    console.log(fetchRequest);


    // // winds_aloft_uri
    // for (let currentOffset = launchTimes.startHourOffset; currentOffset <= launchTimes.endHourOffset; ++currentOffset ) {
    //     console.log(`https://windsaloft.us/winds.php?lat=${launchLocation.latitude}&lon=${launchLocation.longitude}&hourOffset=${currentOffset}&referrer=WEBDRIFTCAST`);
    // }
    
    try {
        const openMeteoPromise = await fetch(fetchRequest);

        if (openMeteoPromise.ok) {
            console.log('Open-Meteo fetch promise is OK.');
            const windJSON = await openMeteoPromise.json();

            console.log('Converted response into a JSON object.');
            if ('hourly' in windJSON) {
                console.log('Open-Meteo JSON contains [hourly] data.');
                const hourCount = launchTimes.endHourOffset - launchTimes.startHourOffset + 1;
                if ('time' in windJSON.hourly) {
                    if (hourCount != windJSON.hourly.time.length) {
                        console.log(`Hour count ${hourCount} is different from wind times count ${windJSON.hourly.time.length}.`);
                    }
                }
            
                let groundElevation = 0;
                if ('elevation' in windJSON) {
                    if (null != windJSON.elevation) {
                        groundElevation = windJSON.elevation;
                    }
                }

                for (let hourIndex = 0; hourIndex < hourCount; ++hourIndex) {
                    // Create arrays to hold converted data.
                    let altitudeWinds = [];
                    let pressureWinds = [];
        
                    // Request wind directions at set heights above ground level.
                    for (const altitude of openMeteoWindAltitudes) {
                        const speedName = `wind_speed_${altitude}m`;
                        const directionName = `wind_direction_${altitude}m`;
        
                        if (speedName in windJSON.hourly && directionName in windJSON.hourly) {
                            if (hourIndex >= windJSON.hourly[speedName].length) {
                                console.log(`Altitude wind speed list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                continue;
                            }
                            if (hourIndex >= windJSON.hourly[directionName].length) {
                                console.log(`Altitude wind direction list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                continue;
                            }
        
                            const windSpeed = windJSON.hourly[speedName][hourIndex];
                            const windDirection = windJSON.hourly[directionName][hourIndex];
        
                            if (null == windSpeed || null == windDirection) {
                                console.log(`Altitude wind at index ${hourIndex} is null.`);
                                continue;
                            }
        
                            altitudeWinds.push(new WindAtAltitude(metersToFeet(altitude), windSpeed, windDirection));
                        }
                    }
        
                    for (const pressure of openMeteoPressureLevels) {
                        const speedName = `wind_speed_${pressure}hPa`;
                        const directionName = `wind_direction_${pressure}hPa`;
                        const heightName = `geopotential_height_${pressure}hPa`;
        
                        if (speedName in windJSON.hourly && directionName in windJSON.hourly && heightName in windJSON.hourly) {
                            if (hourIndex >= windJSON.hourly[speedName].length) {
                                console.log(`Altitude wind speed list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                continue;
                            }
                            if (hourIndex >= windJSON.hourly[directionName].length) {
                                console.log(`Altitude wind direction list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                continue;
                            }
                            if (hourIndex >= windJSON.hourly[heightName].length) {
                                console.log(`Altitude height list ${windJSON.hourly[heightName].length} is too small for hour index ${hourIndex}.`);
                                continue;
                            }
        
                            const windSpeed = windJSON.hourly[speedName][hourIndex];
                            const windDirection = windJSON.hourly[directionName][hourIndex];
                            const windHeight = windJSON.hourly[heightName][hourIndex];
        
                            if (null == windSpeed || null == windDirection || null == windHeight) {
                                console.log(`Pressure wind at index ${hourIndex} is null.`);
                                continue;
                            }
        
                            const altitude = windHeight - groundElevation;
        
                            //if (altitude > 0) {
                                pressureWinds.push(new WindAtAltitude(metersToFeet(altitude), windSpeed, windDirection));
                            //}
                        }
                    }
        
                    let groundWindSpeed = 0;
                    let groundWindDirection = 0;
                    let windList = [];
                    let hourForecast = new WindForecastData();

                    // Combine altitude and pressure based winds into a single, ascending list.
                    // Preference is placed on altitude based winds as they seem most consistent.
                    if (pressureWinds.length > 0) {
                        if (pressureWinds[0].altitude > 0) {
                            // Use any altitude based data which is closer to ground.
                            for (const altWind of altitudeWinds) {
                                if (altWind.altitude < pressureWinds[0].altitude) {
                                    if (0 == windList.length) {
                                        // Set ground wind values based on the lowest entry.
                                        groundWindSpeed = altWind.windSpeed;
                                        groundWindDirection = altWind.windDirection;
                                        windList.push(new WindAtAltitude(0, groundWindSpeed, groundWindDirection));
                                    }
                                    windList.push(altWind);
                                } else {
                                    break;
                                }
                            }

                            // Now add all the atmospheric pressure based wind.
                            for (const presWind of pressureWinds) {
                                if (0 == windList.length) {
                                    // Set ground wind values if no altitude entry was used.
                                    groundWindSpeed = presWind.windSpeed;
                                    groundWindDirection = presWind.windDirection;
                                    windList.push(new WindAtAltitude(0, groundWindSpeed, groundWindDirection));
                                }
                                windList.push(presWind);
                            }
                        } else {
                            // Find the first wind entry above ground level.
                            let windIndex = 1
                            for (; windIndex < pressureWinds.length; ++windIndex) {
                                if (pressureWinds[windIndex].altitude > 0) {
                                    // Interpolate wind speed at zero altitude.
                                    const groundAltitudeRatio = Math.abs(pressureWinds[windIndex - 1].altitude) / (pressureWinds[windIndex].altitude - pressureWinds[windIndex - 1].altitude);
                                    const speedDelta = Math.abs(pressureWinds[windIndex].windSpeed - pressureWinds[windIndex - 1].windSpeed);
                                    if (0 == speedDelta) {
                                        groundWindSpeed = pressureWinds[windIndex].windSpeed;
                                    } else {
                                        groundWindSpeed = groundAltitudeRatio * speedDelta;
                                        if (pressureWinds[windIndex].windSpeed < pressureWinds[windIndex - 1].windSpeed) {
                                            groundWindSpeed += pressureWinds[windIndex].windSpeed;
                                        } else {
                                            groundWindSpeed += pressureWinds[windIndex - 1].windSpeed;
                                        }
                                    }

                                    // Interpolate wind direction at zero altitude.
                                    let directionDelta = Math.abs(pressureWinds[windIndex].windDirection - pressureWinds[windIndex - 1].windDirection);
                                    if (0 == directionDelta) {
                                        groundWindDirection = pressureWinds[windIndex].windDirection;
                                    } else if (directionDelta < 180.0) {
                                        // Perform normal interpolation since the directions do not span across North.
                                        if (pressureWinds[windIndex].windDirection < pressureWinds[windIndex - 1].windDirection) {
                                            groundWindDirection = pressureWinds[windIndex].windDirection;
                                        } else {
                                            groundWindDirection = pressureWinds[windIndex - 1].windDirection;
                                        }
                                        groundWindDirection += (groundAltitudeRatio * directionDelta);
                                    } else {
                                        // Adjust directions to avoid spaning across North.
                                        const firstDirection = pressureWinds[windIndex - 1].windDirection - 180.0;
                                        const secondDirection = pressureWinds[windIndex].windDirection - 180.0;
                                        directionDelta = Math.abs(firstDirection - secondDirection);

                                        // Now proceed with the interpolation.
                                        groundWindDirection = (firstDirection < secondDirection) ? firstDirection : secondDirection;
                                        groundWindDirection += (groundAltitudeRatio * directionDelta) + 180.0;
                                    }
                                    windList.push(new WindAtAltitude(0, groundWindSpeed, groundWindDirection));
                                    break;
                                }
                            }

                            // Add all the remaining wind entries above ground level.
                            for (; windIndex < pressureWinds.length; ++windIndex) {
                                windList.push(pressureWinds[windIndex]);
                            }
                        }

                        hourForecast.loadOpenMeteoData(groundElevation, groundWindSpeed, groundWindDirection, windList);
                    }
                    windForecastList.push(hourForecast);
                }

                console.log('Finished parsing Open-Meteo JSON.');
                console.log(windForecastList);
            } else {
                console.debug('JSON object returned by Open-Meteo does not contain an [hourly] member.');
                console.debug(windJSON);
            }
        } else {
            console.error(`Open-Meteo response status: ${openMeteoPromise.status}`);
        }
    } catch (error) {
        console.error(error.message);
    }









/*
    let testWind = {
        "latitude": 30.616829,
        "longitude": -97.506,
        "generationtime_ms": 91.3820266723633,
        "utc_offset_seconds": 0,
        "timezone": "GMT",
        "timezone_abbreviation": "GMT",
        "elevation": 196,
        "hourly_units": {
          "time": "iso8601",
          "wind_speed_10m": "kn",
          "wind_speed_80m": "kn",
          "wind_speed_120m": "kn",
          "wind_speed_180m": "kn",
          "wind_direction_10m": "°",
          "wind_direction_80m": "°",
          "wind_direction_120m": "°",
          "wind_direction_180m": "°",
          "wind_speed_1000hPa": "kn",
          "wind_speed_975hPa": "kn",
          "wind_speed_950hPa": "kn",
          "wind_speed_925hPa": "kn",
          "wind_speed_900hPa": "kn",
          "wind_speed_850hPa": "kn",
          "wind_speed_800hPa": "kn",
          "wind_speed_700hPa": "kn",
          "wind_speed_600hPa": "kn",
          "wind_speed_500hPa": "kn",
          "wind_speed_400hPa": "kn",
          "wind_speed_300hPa": "kn",
          "wind_speed_250hPa": "kn",
          "wind_speed_200hPa": "kn",
          "wind_speed_150hPa": "kn",
          "wind_speed_100hPa": "kn",
          "wind_speed_70hPa": "kn",
          "wind_speed_50hPa": "kn",
          "wind_speed_30hPa": "kn",
          "wind_direction_1000hPa": "°",
          "wind_direction_975hPa": "°",
          "wind_direction_950hPa": "°",
          "wind_direction_925hPa": "°",
          "wind_direction_900hPa": "°",
          "wind_direction_850hPa": "°",
          "wind_direction_800hPa": "°",
          "wind_direction_700hPa": "°",
          "wind_direction_600hPa": "°",
          "wind_direction_500hPa": "°",
          "wind_direction_400hPa": "°",
          "wind_direction_300hPa": "°",
          "wind_direction_250hPa": "°",
          "wind_direction_200hPa": "°",
          "wind_direction_150hPa": "°",
          "wind_direction_100hPa": "°",
          "wind_direction_70hPa": "°",
          "wind_direction_50hPa": "°",
          "wind_direction_30hPa": "°",
          "geopotential_height_1000hPa": "m",
          "geopotential_height_975hPa": "m",
          "geopotential_height_950hPa": "m",
          "geopotential_height_925hPa": "m",
          "geopotential_height_900hPa": "m",
          "geopotential_height_850hPa": "m",
          "geopotential_height_800hPa": "m",
          "geopotential_height_700hPa": "m",
          "geopotential_height_600hPa": "m",
          "geopotential_height_500hPa": "m",
          "geopotential_height_400hPa": "m",
          "geopotential_height_300hPa": "m",
          "geopotential_height_250hPa": "m",
          "geopotential_height_200hPa": "m",
          "geopotential_height_150hPa": "m",
          "geopotential_height_100hPa": "m",
          "geopotential_height_70hPa": "m",
          "geopotential_height_50hPa": "m",
          "geopotential_height_30hPa": "m"
        },
        "hourly": {
          "time": [
            "2024-12-21T15:00",
            "2024-12-21T16:00",
            "2024-12-21T17:00",
            "2024-12-21T18:00",
            "2024-12-21T19:00",
            "2024-12-21T20:00",
            "2024-12-21T21:00",
            "2024-12-21T22:00"
          ],
          "wind_speed_10m": [3.8, 4.7, 5.1, 4.7, 4.7, 5.2, 5.1, 4.2],
          "wind_speed_80m": [6, 5.1, 5.8, 5.5, 5.1, 5.9, 5.7, 5.3],
          "wind_speed_120m": [7, 6.9, 7.6, 7.4, 6.9, 6.3, 6.5, 7.5],
          "wind_speed_180m": [12.5, 12.7, 6.8, 5.5, 5.9, 6.4, 7.4, 8.2],
          "wind_direction_10m": [55, 85, 94, 95, 114, 124, 108, 127],
          "wind_direction_80m": [69, 86, 92, 98, 115, 122, 112, 123],
          "wind_direction_120m": [75, 90, 83, 99, 112, 108, 121, 130],
          "wind_direction_180m": [101, 106, 95, 96, 117, 121, 125, 126],
          "wind_speed_1000hPa": [5.4, 5.7, 5.7, 5.7, 5, 5.3, 5.4, 4.9],
          "wind_speed_975hPa": [10.7, 10.2, 6.9, 6.6, 6.1, 6.2, 5.7, 5.8],
          "wind_speed_950hPa": [6, 7.9, 7.4, 7, 6.8, 6.4, 5.8, 6.2],
          "wind_speed_925hPa": [4.6, 5.7, 5.8, 6.8, 6.6, 6, 4.9, 6],
          "wind_speed_900hPa": [7.9, 10.2, 9.5, 9, 7.1, 7.4, 4.5, 6],
          "wind_speed_850hPa": [9.3, 9, 7.9, 7.9, 5.9, 6.2, 3.3, 4],
          "wind_speed_800hPa": [7.6, 7.3, 6.7, 9.2, 7.6, 9.2, 10.1, 10.5],
          "wind_speed_700hPa": [6.2, 6.9, 6.7, 8.1, 7.3, 9.1, 10.4, 11.4],
          "wind_speed_600hPa": [18.5, 19.8, 19.8, 20.8, 21.2, 21.8, 20.8, 20],
          "wind_speed_500hPa": [23.8, 23.5, 22.9, 20.6, 20.5, 20.9, 23.8, 22.1],
          "wind_speed_400hPa": [22.6, 22.7, 22.7, 22.1, 22, 17.1, 12.4, 7.8],
          "wind_speed_300hPa": [24.8, 26.4, 27.3, 24.5, 20.2, 17.5, 15.7, 12.3],
          "wind_speed_250hPa": [25.3, 25.2, 24.5, 19.1, 17.9, 13, 11.9, 11],
          "wind_speed_200hPa": [32.4, 35.4, 34.6, 31.4, 28.9, 28.6, 28.8, 27],
          "wind_speed_150hPa": [38, 38, 36.7, 36, 34.3, 35.2, 34.1, 31.8],
          "wind_speed_100hPa": [32.4, 30.7, 29.7, 30.6, 32, 30.5, 29.9, 28.8],
          "wind_speed_70hPa": [23.5, 19.8, 20.2, 21.5, 21.3, 21.5, 20.7, 19.2],
          "wind_speed_50hPa": [23.3, 22.8, 20.6, 20.1, 22.8, 22.1, 22.3, 23.5],
          "wind_speed_30hPa": [22.5, 20, 18.8, 17.2, 18.1, 21.4, 22.7, 20.1],
          "wind_direction_1000hPa": [69, 96, 98, 106, 106, 123, 105, 127],
          "wind_direction_975hPa": [110, 112, 97, 108, 111, 119, 108, 126],
          "wind_direction_950hPa": [104, 125, 112, 117, 121, 122, 120, 130],
          "wind_direction_925hPa": [155, 173, 158, 158, 148, 142, 139, 142],
          "wind_direction_900hPa": [200, 212, 208, 214, 207, 200, 198, 191],
          "wind_direction_850hPa": [253, 259, 254, 274, 270, 254, 297, 259],
          "wind_direction_800hPa": [278, 292, 284, 270, 264, 249, 261, 269],
          "wind_direction_700hPa": [299, 293, 264, 265, 254, 274, 268, 275],
          "wind_direction_600hPa": [282, 287, 287, 291, 293, 302, 308, 311],
          "wind_direction_500hPa": [299, 309, 315, 314, 305, 300, 313, 310],
          "wind_direction_400hPa": [297, 301, 301, 302, 313, 323, 317, 318],
          "wind_direction_300hPa": [290, 295, 306, 307, 312, 321, 336, 357],
          "wind_direction_250hPa": [293, 299, 302, 305, 319, 323, 311, 315],
          "wind_direction_200hPa": [286, 294, 287, 288, 290, 283, 284, 280],
          "wind_direction_150hPa": [279, 279, 278, 278, 281, 276, 279, 282],
          "wind_direction_100hPa": [290, 288, 286, 283, 288, 294, 300, 293],
          "wind_direction_70hPa": [298, 281, 276, 277, 290, 299, 284, 282],
          "wind_direction_50hPa": [268, 275, 283, 285, 285, 275, 278, 276],
          "wind_direction_30hPa": [288, 283, 272, 281, 270, 272, 273, 272],
          "geopotential_height_1000hPa": [249, 250, 246, 239, 226, 215, 212, 211],
          "geopotential_height_975hPa": [452, 454, 452, 447, 436, 427, 425, 424],
          "geopotential_height_950hPa": [665, 666, 664, 661, 651, 643, 642, 642],
          "geopotential_height_925hPa": [886, 886, 884, 880, 871, 863, 863, 863],
          "geopotential_height_900hPa": [1114, 1114, 1111, 1107, 1098, 1090, 1090, 1090],
          "geopotential_height_850hPa": [1587, 1587, 1585, 1582, 1573, 1563, 1564, 1564],
          "geopotential_height_800hPa": [2085, 2084, 2082, 2079, 2071, 2062, 2062, 2062],
          "geopotential_height_700hPa": [3174, 3173, 3170, 3167, 3159, 3151, 3150, 3151],
          "geopotential_height_600hPa": [4409, 4409, 4404, 4401, 4392, 4386, 4386, 4388],
          "geopotential_height_500hPa": [5821, 5822, 5818, 5815, 5806, 5799, 5798, 5800],
          "geopotential_height_400hPa": [7470.37, 7470.37, 7466.67, 7465.43, 7458.02, 7453.09, 7449.38, 7454.32],
          "geopotential_height_300hPa": [9477.42, 9477.42, 9475.81, 9475.81, 9467.74, 9464.52, 9459.68, 9467.74],
          "geopotential_height_250hPa": [10683.81, 10685.71, 10683.81, 10681.91, 10678.1, 10670.48, 10664.76, 10672.38],
          "geopotential_height_200hPa": [12104.65, 12106.98, 12104.65, 12102.33, 12097.67, 12088.37, 12081.4, 12086.05],
          "geopotential_height_150hPa": [13880.6, 13883.58, 13883.58, 13883.58, 13880.6, 13868.66, 13868.66, 13871.64],
          "geopotential_height_100hPa": [16358.33, 16362.5, 16366.67, 16362.5, 16370.83, 16358.33, 16362.5, 16362.5],
          "geopotential_height_70hPa": [18519.12, 18524.59, 18530.05, 18530.05, 18519.12, 18513.66, 18508.2, 18513.66],
          "geopotential_height_50hPa": [20558.62, 20572.41, 20565.52, 20558.62, 20579.31, 20558.62, 20565.52, 20551.72],
          "geopotential_height_30hPa": [23747.66, 23757.01, 23757.01, 23757.01, 23747.66, 23738.32, 23738.32, 23738.32]
        }
    };
*/
    return windForecastList;
}

/**
 * Calculates where a rocket's altitude is located within a wind band.
 * @param   {number} rocketAltitude - Current altitude (feet) of the rocket.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including altitudes (feet).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Percentage of this wind band above the floor where the rocket is located. -1 if outside the range.
 */
function getWindBandPercentage(rocketAltitude, windData, floorIndex) {
    // Run a safety check to avoid a potential out of bounds error.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Provided index ${floorIndex} will exceed the bounds of the wind data array ${windData.length}`);
        return -1;
    }
    // Also cannot proceed if rocket is outside this wind band's altitude range.
    const altitudeFloor = windData[floorIndex].altitude;
    const altitudeCeiling = windData[floorIndex + 1].altitude;
    if (rocketAltitude < altitudeFloor || rocketAltitude > altitudeCeiling) {
        console.debug(`Rocket altitude ${rocketAltitude} is outside the provided range between ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    const rangeHeight = Math.abs(altitudeCeiling - altitudeFloor);
    if (0 == rangeHeight) {
        console.debug(`Attempting linear interpolation with values resulting in a range of zero.  ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    return Math.abs(rocketAltitude - altitudeFloor) / rangeHeight;
}

/**
 * Obtain the average wind speed (knots) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind speed (knots). -1 if outside the range.
 */
function getAverageWindSpeed(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const speedFloor = windData[floorIndex].windSpeed;
    const speedRange = windData[floorIndex + 1].windSpeed - speedFloor;
    const speedAtAltitude = speedFloor + (bandPercentage * speedRange);
    return (speedFloor + speedAtAltitude) / 2.0;
}

/**
 * Obtain the average wind direction (degrees from 0 north) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind direction (degrees from 0 north). -1 if outside the range.
 */
function getAverageWindDirection(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const directionA = windData[floorIndex].windDirection;
    const targetDirection = directionA + (bandPercentage * (windData[floorIndex + 1].windDirection - directionA));
    let averageDirection = directionA + targetDirection;
    if (Math.abs(directionA - targetDirection) < 180.0) {
        averageDirection /= 2.0;
    } else {
        // Maintain a northerly direction as the bearing oscillates around zero degrees
        averageDirection = (averageDirection - 360.0) / 2.0;
        if (averageDirection < 0.0) {
            averageDirection += 360.0;
        }
    }
    return averageDirection;
}

/**
 * Calculates a drift distance and applies it to the rocket's location.
 * @param {GeoLocation} rocketLocation - Initial location and to be updated as the destination.
 * @param {number} windSpeed - Velocity (knots) the wind is blowing.
 * @param {number} windDirection - Bearing (degrees from North) to move.
 * @param {number} decentRate - Velocity (ft/s) the rocket is currently falling.
 * @param {number} descentDistance - Distance (feet)
 */
function driftWithWind(rocketLocation, windSpeed, windDirection, decentRate, descentDistance) {
    // Ensure the decent rate is valid
    if (isNaN(decentRate) || 0 == decentRate) {
        console.debug(`Cannot use the current decent rate: ${decentRate}`);
        return;
    }
    decentRate = Math.abs(decentRate);

    // Use the average of wind speed and direction within this range to calculate drift
    const decentDuration = descentDistance / decentRate;

    // The movement function expects a distance in meters, so convert the wind speed
    // from knots into ft/s before multiplying by the decent rate.
    const driftDistance = decentDuration * (windSpeed * 1.68781);

    // Wind bearing indicates where the wind is blowing from, but we want to drift
    // downwind here.  Therefore the direction is inverted before applying movement.
    if (windDirection < 180) {
        windDirection += 180;
    } else {
        windDirection -= 180;
    }

    // Now a decent position can be calculated
    moveAlongBearingKilometers(rocketLocation, feetToMeters(driftDistance), windDirection);

    return driftDistance;
}

// Export our class definitions
export { WindAtAltitude, WindForecastData, WeathercockWindData };

// Export our functions
export { getWindPredictionData, getOpenMeteoWindPredictionData, getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind };