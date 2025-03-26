import { GeoLocation } from "./geo.js";
import { LaunchTimeData } from "./launch.js";
import { WindAtAltitude } from "./wind.js";


// Declare some ID strings so they do not have to be in-line everywhere
const launchSiteLatitudeId = 'launch_site_latitude';
const launchSiteLongitudeId = 'launch_site_longitude';
const waiverLatitudeId = 'waiver_latitude';
const waiverLongitudeId = 'waiver_longitude';
const waiverRadiusId = 'waiver_radius';
const waiverAltitudeId = 'waiver_altitude';
const btnFetchWindForecastId = 'btn_fetch_wind_forecast';
const btnSaveCsvFileId = 'btn_save_csv_file';

// IDs of the launch time inputs
const launchDateId = 'launch_date';
const launchTimeId = 'launch_time';

// IDs of the launch site buttons
const selLaunchSiteNameId = 'select_launch_site';

// Drift result display IDs
const statusDisplayId = 'status_display';

// Pulled from wind.js
const openMeteoWindAltitudes = [10, 80, 120, 180];
const openMeteoPressureLevels = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 70, 50, 30, 20, 15, 10];

// Hold an instance of a db object for us to store the IndexedDB data in
let dbLaunchSites = null;

let openMeteoWindJSON = null;

var launchSiteNames = [];

/**
 * Create an object containing a launch site location based on the current UI data.
 * @returns {GeoLocation} Coordinates of launch site if successful. Otherwise returns null.
 */
function getLaunchSiteLocation() {
    const latitude = parseFloat(document.getElementById(launchSiteLatitudeId).value);
    if (isNaN(latitude)) {
        return null;
    } else if ((latitude > 90.0) || (latitude < -90.0)) {
        return null;
    }

    const longitude = parseFloat(document.getElementById(launchSiteLongitudeId).value);
    if (isNaN(longitude)) {
        return null;
    } else if ((longitude > 180.0) || (longitude < -180.0)) {
        return null;
    }

    return new GeoLocation(latitude, longitude);
}

/**
 * Check if the provided string contains a valid numeric value.
 * @param {string} str - String to be tested.
 * @returns {boolean} True if the string can be converted into a number. False otherwise.
 */
function isNumeric(str) {
    if (typeof str != 'string') {
        return false;
    }

    // Use type coercion to parse the entire string (parseFloat does not do that)
    // and use parseFloat to ensure strings of pure whitespace fail
    return !isNaN(str) && !isNaN(parseFloat(str));
}

/**
 * Copy values retrieved from the database into the UI fields.
 * @param {cursor} dbCursor - Cursor returned from the launch site database.
 */
function updateLaunchSiteDisplay(dbCursor) {
    document.getElementById(launchSiteLatitudeId).value = dbCursor.latitude;
    document.getElementById(launchSiteLongitudeId).value = dbCursor.longitude;
}

function askUserToRefreshWindForecast() {
    const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
        if (null != fetchWindForecastButton) {
            if (fetchWindForecastButton.disabled) {
                // Allow the user to request a new wind forecast.
                fetchWindForecastButton.disabled = false;

                // Prevent the user from saving a CSV with the out of date forecast.
                const saveCsvFileButton = document.getElementById(btnSaveCsvFileId);
                if (null != saveCsvFileButton) {
                    saveCsvFileButton.disabled = true;
                }

                // Notify the user they need to request a new wind forecast.
                const statusDisplayElement = document.getElementById(statusDisplayId);
                if (null != statusDisplayElement) {
                    statusDisplayElement.textContent = 'Please refresh the wind forecast when you are ready.';
                }
                console.log('Asking user to refresh wind forecast.');
            } else {
                console.log('Forecast refresh request is already displayed.');
            }
        }
}

/**
 * Fired when the whole page has loaded, including all dependent resources except
 * those that are loaded lazily.
 */
window.onload = () => {
    const launchDateElement = document.getElementById(launchDateId);
    const startTimeElement = document.getElementById(launchTimeId);

    const currentDate = new Date();

    // Add leading zeros if the numbers are single digit
    let monthString;
    if (currentDate.getMonth() < 9) {
        monthString = '0' + (currentDate.getMonth() + 1).toString();
    } else {
        monthString = (currentDate.getMonth() + 1).toString();
    }

    let dayString;
    if (currentDate.getDate() < 10) {
        dayString = '0' + currentDate.getDate().toString();
    } else {
        dayString = currentDate.getDate().toString();
    }

    // Initialize the date element to today
    launchDateElement.value = `${currentDate.getFullYear()}-${monthString}-${dayString}`;

    // Prevent the user from selecting a date older than 9 days in the past
    let oldestDate = new Date();
    oldestDate.setTime(oldestDate.getTime() - (9 * 86400000));

    launchDateElement.min = `${oldestDate.getFullYear()}-${(oldestDate.getMonth() + 1).toString().padStart(2, '0')}-${oldestDate.getDate().toString().padStart(2, '0')}`;

    // Cannot forecast more than 380 hours into the future. Using 15 days for now.
    const maxDate = new Date();
    maxDate.setTime(maxDate.getTime() + (15 * 86400000));

    //launchDateElement.max = `${maxDate.getFullYear()}-${monthString}-${dayString}`;
    launchDateElement.max = `${maxDate.getFullYear()}-${(maxDate.getMonth() + 1).toString().padStart(2, '0')}-${maxDate.getDate().toString().padStart(2, '0')}`;

    // Initialize the time elements to the current hour plus a max offset
    const currentHour = currentDate.getHours();
    if (currentHour < 10) {
        startTimeElement.value = `0${currentHour}:00`;
    } else {
        startTimeElement.value = `${currentHour}:00`;
    }

    // Open our database of launch sites
    const dbSitesOpenRequest = window.indexedDB.open('DriftCast_Sites', 1);

    // Event handlers to act on the database being opened successfully
    dbSitesOpenRequest.onsuccess = (event) => {
        // Store the result of opening the database in the db variable. This is used a lot below
        dbLaunchSites = dbSitesOpenRequest.result;

        const loadingObjectStore = dbLaunchSites.transaction('DriftCast_Sites').objectStore('DriftCast_Sites');

        const countRequest = loadingObjectStore.count();
        countRequest.onsuccess = () => {
            console.log(`Loading ${countRequest.result} launch sites from our database.`);
            if (countRequest.result > 0) {
                let copyDataToUi = true;
                const selLaunchSiteNames = document.getElementById(selLaunchSiteNameId);

                // Ensure we do not add duplicate entries
                clearLaunchSiteSelector();

                loadingObjectStore.openCursor().onsuccess = (event) => {
                    const cursor = event.target.result;
                    // Check if the cursor still contains valid launch site data
                    if (cursor) {
                        const launchSiteOption = document.createElement('option');
                        launchSiteOption.value = cursor.value.name;
                        launchSiteOption.text = cursor.value.name;
                        selLaunchSiteNames.add(launchSiteOption);

                        // Update our cached data associated with the selector
                        launchSiteNames.push(cursor.value.name);

                        // Copy the first launch site's data into our UI elements
                        if (copyDataToUi) {
                            updateLaunchSiteDisplay(cursor.value);
                            copyDataToUi = false;
                        }
                        
                        // Continue on to the next item in the cursor
                        cursor.continue();
                    } else {
                        // There is no more data to load
                        return;
                    }
                };
            }
        }
    };

    // Handling any errors, though not really sure what a good response should be
    dbSitesOpenRequest.onerror = (event) => {
        console.error('Error loading launch site database.');
        console.error(event);
    };

    // Create our database since it does not currently exist
    dbSitesOpenRequest.onupgradeneeded = (event) => {
        dbLaunchSites = event.target.result;
        console.log('Creating our database.');

        dbLaunchSites.onerror = (event) => {
            console.error('Error loading database.');
        };

        // Create an objectStore for this database
        const objectStore = dbLaunchSites.createObjectStore('DriftCast_Sites', { keyPath: 'name' });

        // Define what data items the objectStore will contain
        objectStore.createIndex('latitude', 'latitude', { unique: false });
        objectStore.createIndex('longitude', 'longitude', { unique: false });
        objectStore.createIndex('elevation', 'elevation', { unique: false });
        objectStore.createIndex(waiverLatitudeId, waiverLatitudeId, { unique: false });
        objectStore.createIndex(waiverLongitudeId, waiverLongitudeId, { unique: false });
        objectStore.createIndex(waiverRadiusId, waiverRadiusId, { unique: false });
        objectStore.createIndex(waiverAltitudeId, waiverAltitudeId, { unique: false });
    };

    // Handle selection of a different launch site from our list
    document.getElementById(selLaunchSiteNameId).addEventListener('change', (changeEvent) => {
        if (null != dbLaunchSites) {
            // Retrieve the selected launch site's details from our database
            dbLaunchSites.transaction('DriftCast_Sites')
                .objectStore('DriftCast_Sites')
                .get(changeEvent.target.value)
                .onsuccess = (dbEvent) => {
                    updateLaunchSiteDisplay(dbEvent.target.result);
                };
        }
    });

    const launchSiteLatitudeInput = document.getElementById(launchSiteLatitudeId);
    if (null != launchSiteLatitudeInput) {
        launchSiteLatitudeInput.addEventListener('change', (event) => {
            askUserToRefreshWindForecast();
        });
    }

    const launchSiteLongitudeInput = document.getElementById(launchSiteLongitudeId);
    if (null != launchSiteLongitudeInput) {
        launchSiteLongitudeInput.addEventListener('change', (event) => {
            askUserToRefreshWindForecast();
        });
    }

    // Treat the wind forecast data as invalid when any input options are modified.
    launchDateElement.addEventListener('change', (event) => {
        askUserToRefreshWindForecast();
    });

    // Try to keep the end time within a valid range of the start time
    startTimeElement.addEventListener('change', (event) => {
        askUserToRefreshWindForecast();
    });

    document.getElementById(btnFetchWindForecastId).addEventListener('click', async () => {
        // Let the user know something is happening in the background.
        const statusDisplayElement = document.getElementById(statusDisplayId);
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Downloading the wind forecast...';
            statusDisplayElement.scrollIntoView({ behavior: "instant", block: "end" });
        }

        // Prevent the user from requesting another forecast while this one is pending.
        const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
        if (null != fetchWindForecastButton) {
            fetchWindForecastButton.disabled = true;
        }

        // Might as well prevent the user from generating a CSV with stale data.
        const saveCsvFileButton = document.getElementById(btnSaveCsvFileId);
        if (null != saveCsvFileButton) {
            saveCsvFileButton.disabled = true;
        }

        // Calculate new drift and landing results
        requestOpenMeteoWind();
    });

    document.getElementById(btnSaveCsvFileId).addEventListener('click', async () => {
        //saveWindForecastJson();
        saveORWindCSV();
    });
}

/**
 * Calculates a value within a range based on a ratio from the provided source data.
 * @param   {number} sourceValue - The position of this value within the source range is mapped to the target range.
 * @param   {number} sourceLower - Lower limit of the source range.
 * @param   {number} sourceUpper - Upper limit of the source range.
 * @param   {number} targetLower - Lower limit of the target range.
 * @param   {number} targetUpper - Upper limit of the target range.
 * @returns {number} Value from the target range equivalent to the source data's position.
 */
function linearInterpolate(sourceValue, sourceLower, sourceUpper, targetLower, targetUpper) {
    if (0 == (sourceUpper - sourceLower)) {
        console.debug(`Invalid linear range ${sourceLower} to ${sourceUpper}. Defaulting to targetLower.`);
        return targetLower;
    }

    return targetLower + ((sourceValue - sourceLower) * (((targetUpper - targetLower) / (sourceUpper - sourceLower))));
}

/**
 * Generate a URI to fetch a wind forecast based on user provided information.
 */
async function requestOpenMeteoWind() {
    // Clear out any previously fetched wind forecast data.
    openMeteoWindJSON = null;

    const statusDisplayElement = document.getElementById(statusDisplayId);

    const launchTimes = new LaunchTimeData( document.getElementById(launchDateId).value,
                                            document.getElementById(launchTimeId).value,
                                            document.getElementById(launchTimeId).value);

    // Verify the launch hour offsets are within our expectations
    if (launchTimes.startHourOffset < -216) {
        // Let the user know something bad happened.
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Wind speeds older than 9 days are not available.';
        }

        // Allow the user to request a new wind forecast.
        const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
        if (null != fetchWindForecastButton) {
            fetchWindForecastButton.disabled = false;
        }
        return openMeteoWindJSON;
    }
    if (launchTimes.startHourOffset > 360) {
        // Let the user know something bad happened.
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Cannot forecast more than 15 days into the future.';
        }

        // Allow the user to request a new wind forecast.
        const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
        if (null != fetchWindForecastButton) {
            fetchWindForecastButton.disabled = false;
        }
        return openMeteoWindJSON;
    }

    // Default to using the launch site's location for our apogee position
    const launchLocation = getLaunchSiteLocation();
    if (null == launchLocation) {
        // Let the user know something bad happened.
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Unable to get wind forecast without valid launch site coordinates.';
        }

        // Allow the user to request a new wind forecast.
        const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
        if (null != fetchWindForecastButton) {
            fetchWindForecastButton.disabled = false;
        }
        return openMeteoWindJSON;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // Duplicating getOpenMeteoWindPredictionData()
    ////////////////////////////////////////////////////////////////////////////////

    // Begin forming a request for Open-Meteo's API with the launch location.
    let fetchRequest = `https://api.open-meteo.com/v1/forecast?latitude=${launchLocation.latitude}&longitude=${launchLocation.longitude}`;

    // Specify the launch's active hours.
    fetchRequest += `&start_hour=${launchTimes.getStartTimeAsISOString()}&end_hour=${launchTimes.getStartTimeAsISOString()}`;

    // Request wind speeds to be in meters per second.
    fetchRequest += '&wind_speed_unit=mph';

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
    
    try {
        const openMeteoPromise = await fetch(fetchRequest);

        if (openMeteoPromise.ok) {
            console.log('Open-Meteo fetch promise is OK.');
            openMeteoWindJSON = await openMeteoPromise.json();

            if (null == openMeteoWindJSON) {
                console.debug('Open-Meteo wind forecast is null.');
                
                // Let the user know something bad happened.
                if (null != statusDisplayElement) {
                    statusDisplayElement.textContent = 'The wind forecast was not available.'
                }

                // Allow the user to request a new wind forecast.
                const fetchWindForecastButton = document.getElementById(btnFetchWindForecastId);
                if (null != fetchWindForecastButton) {
                    fetchWindForecastButton.disabled = false;
                }
            } else {
                // No need to continue showing our text feedback now that results are ready.
                if (null != statusDisplayElement) {
                    statusDisplayElement.textContent = 'Ready to generate CSV file.'
                }

                // Allow the user to save now that valid drift and landing data is available.
                const saveCsvFileButton = document.getElementById(btnSaveCsvFileId);
                if (null != saveCsvFileButton) {
                    saveCsvFileButton.disabled = false;
                    saveCsvFileButton.scrollIntoView({ behavior: "instant", block: "start" });
                }
            }
        } else {
            console.error(`Open-Meteo response status: ${openMeteoPromise.status}`);

            if (null != statusDisplayElement) {
                statusDisplayElement.textContent = `Open-Meteo response status: ${openMeteoPromise.status}`;
            }
        }
    } catch (error) {
        console.error(error.message);

        const statusDisplayElement = document.getElementById(statusDisplayId);
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = `Encounterd an error: ${error.message}`;
        }
    }
}

/**
 * Convert wind at altitude data into OpenRocket's expected CSV format.
 */
async function saveORWindCSV() {
    const statusDisplayElement = document.getElementById(statusDisplayId);

    if (null == openMeteoWindJSON) {
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Cannot save Open-Meteo JSON because the object is null.';
        } else {
            console.log('Cannot save Open-Meteo JSON because the object is null.');
        }
        return;
    }

    if ('hourly' in openMeteoWindJSON) {
        console.log(`Open-Meteo JSON contains [hourly] data.`);

        if ('time' in openMeteoWindJSON.hourly) {
            console.log(`Open-Meteo JSON contains ${openMeteoWindJSON.hourly.time.length} [time] data.`);
        } else {
            if (null != statusDisplayElement) {
                statusDisplayElement.textContent = 'Open-Meteo JSON has no [time] data.';
            } else {
                console.log('Open-Meteo JSON has no [time] data.');
            }
            return;
        }
    } else {
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Open-Meteo JSON has no [hourly] data.';
        } else {
            console.log('Open-Meteo JSON has no [hourly] data.');
        }
        return;
    }
            
    let groundElevation = 0;
    if ('elevation' in openMeteoWindJSON) {
        if (null != openMeteoWindJSON.elevation) {
            groundElevation = openMeteoWindJSON.elevation;
        }
    }

    // Create arrays to hold converted data.
    let altitudeWinds = [];
    let pressureWinds = [];

    // Request wind directions at set heights above ground level.
    for (const altitude of openMeteoWindAltitudes) {
        const speedName = `wind_speed_${altitude}m`;
        const directionName = `wind_direction_${altitude}m`;

        if (speedName in openMeteoWindJSON.hourly && directionName in openMeteoWindJSON.hourly) {
            if (openMeteoWindJSON.hourly[speedName].length < 1) {
                console.log(`Altitude wind speed list ${openMeteoWindJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                continue;
            }
            if (openMeteoWindJSON.hourly[directionName].length < 1) {
                console.log(`Altitude wind direction list ${openMeteoWindJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                continue;
            }

            const windSpeed = openMeteoWindJSON.hourly[speedName][0];
            const windDirection = openMeteoWindJSON.hourly[directionName][0];

            if (null == windSpeed || null == windDirection) {
                console.log(`Wind at altitude ${altitude} is null.`);
                continue;
            }

            altitudeWinds.push(new WindAtAltitude(altitude + groundElevation, windSpeed, windDirection));
        }
    }

    for (const pressure of openMeteoPressureLevels) {
        const speedName = `wind_speed_${pressure}hPa`;
        const directionName = `wind_direction_${pressure}hPa`;
        const heightName = `geopotential_height_${pressure}hPa`;

        if (speedName in openMeteoWindJSON.hourly && directionName in openMeteoWindJSON.hourly && heightName in openMeteoWindJSON.hourly) {
            if (openMeteoWindJSON.hourly[speedName].length < 1) {
                console.log(`Altitude wind speed list ${openMeteoWindJSON.hourly[speedName].length} is too small.`);
                continue;
            }
            if (openMeteoWindJSON.hourly[directionName].length < 1) {
                console.log(`Altitude wind direction list ${openMeteoWindJSON.hourly[speedName].length} is too small.`);
                continue;
            }
            if (openMeteoWindJSON.hourly[heightName].length < 1) {
                console.log(`Altitude height list ${openMeteoWindJSON.hourly[heightName].length} is too small.`);
                continue;
            }

            const windSpeed = openMeteoWindJSON.hourly[speedName][0];
            const windDirection = openMeteoWindJSON.hourly[directionName][0];
            const windHeight = openMeteoWindJSON.hourly[heightName][0];

            if (null == windSpeed || null == windDirection || null == windHeight) {
                console.log(`Wind at pressure ${pressure} is null.`);
                continue;
            }

            //if (altitude > 0) {
                pressureWinds.push(new WindAtAltitude(windHeight, windSpeed, windDirection));
            //}
        }
    }

    let groundWindSpeed = 0;
    let groundWindDirection = 0;
    let windList = [];

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
    }

    //console.log(windList);

    // alt	        - Altitude of the level (meters)
    // speed	    - Wind speed
    // direction	- Wind direction (degrees)
    let stringArray = [`alt,speed,dir\n`];

    for (const currentWindAtAltitude of windList) {
        stringArray.push(`${currentWindAtAltitude.altitude},${currentWindAtAltitude.windSpeed},${currentWindAtAltitude.windDirection}\n`);
    }

    //console.log(stringArray);

    const windCsvBlob = new Blob(stringArray);

    // Use the forecast's date and time to create a somewhat unique file name.
    const utcYear = parseInt(openMeteoWindJSON.hourly.time[0].slice(0, 4));
    const utcMonth = parseInt(openMeteoWindJSON.hourly.time[0].slice(5, 7));
    const utcDate = parseInt(openMeteoWindJSON.hourly.time[0].slice(8, 10));
    const utcHour = parseInt(openMeteoWindJSON.hourly.time[0].slice(11, 13));

    const forecastDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDate, utcHour));
    const forecastMonthString = `${forecastDate.getMonth() + 1}`;
    const forecastDateString = `${forecastDate.getDate()}`;
    const forecastHourString = `${forecastDate.getHours()}`;
    const defaultName = `wind_${forecastDate.getFullYear()}-${forecastMonthString.padStart(2, '0')}-${forecastDateString.padStart(2, '0')}T${forecastHourString.padStart(2, '0')}.csv`;

    // Feature detection. The API needs to be supported
    // and the app not run in an iframe.
    const supportsFileSystemAccess = 'showSaveFilePicker' in window && (() => {
        try {
            return window.self === window.top;
        } catch {
            return false;
        }
    })();

    // If the File System Access API is supported
    if (supportsFileSystemAccess) {
        try {
            const filePickerOptions = {
                types: [
                    {
                        description: 'Comma-separated values (CSV)',
                        accept: { 'text/csv': ['.csv'] },
                    },
                ],
                excludeAcceptAllOption: true,
                multiple: false,
                suggestedName: defaultName,
            };

            // Create a file save dialog for the user to select a location and name
            const saveFileHandle = await showSaveFilePicker(filePickerOptions);

            // Create a FileSystemWritableFileStream we can write to
            const writableFile = await saveFileHandle.createWritable();
            
            // Write our blob's contents to the file
            await writableFile.write(windCsvBlob);

            // Close the file and write the contents to disk
            await writableFile.close();
        } catch (err) {
            // Fail silently if the user has simply canceled the dialog.
            if (err.name !== 'AbortError') {
                console.error(err.name, err.message);
            }
        }
    } else {
        // Fallback if the File System Access API is not supported
        // Create the blob URL
        const blobURL = URL.createObjectURL(windCsvBlob);

        // Create the `<a download>` element and append it invisibly.
        const a = document.createElement('a');
        a.href = blobURL;
        a.download = defaultName;
        a.style.display = 'none';
        document.body.append(a);

        // Programmatically click the element.
        a.click();

        // Revoke the blob URL and remove the element.
        setTimeout(() => {
            URL.revokeObjectURL(blobURL);
            a.remove();
        }, 1000);
    }

}

async function saveWindForecastJson() {
    if (null == openMeteoWindJSON) {
        console.log('Cannot save Open-Meteo JSON because the object is null.');
        return;
    }

    if ('hourly' in openMeteoWindJSON) {
        console.log(`Open-Meteo JSON contains ${openMeteoWindJSON.hourly.length} [hourly] data.`);

        if ('time' in openMeteoWindJSON.hourly) {
            console.log(`Open-Meteo JSON contains ${openMeteoWindJSON.hourly.time.length} [time] data.`);
        } else {
            console.log('Open-Meteo JSON has no [time] data.');
            return;
        }
    } else {
        console.log('Open-Meteo JSON has no [hourly] data.');
        return;
    }

    // Stringify the JSON object
    const jsonString = JSON.stringify(openMeteoWindJSON);

    // Create a Blob object with the JSON string and set the content type as "application/json"
    const forecastBlob = new Blob([jsonString], { type: "application/json" });

    // Use the forecast's date and time to create a somewhat unique file name.
    const utcYear = parseInt(openMeteoWindJSON.hourly.time[0].slice(0, 4));
    const utcMonth = parseInt(openMeteoWindJSON.hourly.time[0].slice(5, 7));
    const utcDate = parseInt(openMeteoWindJSON.hourly.time[0].slice(8, 10));
    const utcHour = parseInt(openMeteoWindJSON.hourly.time[0].slice(11, 13));

    const forecastDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDate, utcHour));
    const forecastMonthString = `${forecastDate.getMonth() + 1}`;
    const forecastDateString = `${forecastDate.getDate()}`;
    const forecastHourString = `${forecastDate.getHours()}`;
    const defaultName = `wind_${forecastDate.getFullYear()}-${forecastMonthString.padStart(2, '0')}-${forecastDateString.padStart(2, '0')}T${forecastHourString.padStart(2, '0')}.json`;

    // Feature detection. The API needs to be supported
    // and the app not run in an iframe.
    const supportsFileSystemAccess = 'showSaveFilePicker' in window && (() => {
        try {
            return window.self === window.top;
        } catch {
            return false;
        }
    })();

    // If the File System Access API is supported
    if (supportsFileSystemAccess) {
        try {
            const filePickerOptions = {
                types: [
                    {
                        description: 'JSON format',
                        accept: { 'application/json': ['.json'] },
                    },
                ],
                excludeAcceptAllOption: true,
                multiple: false,
                suggestedName: defaultName,
            };

            // Create a file save dialog for the user to select a location and name
            const saveFileHandle = await showSaveFilePicker(filePickerOptions);

            // Create a FileSystemWritableFileStream we can write to
            const writableFile = await saveFileHandle.createWritable();
            
            // Write our blob's contents to the file
            await writableFile.write(forecastBlob);

            // Close the file and write the contents to disk
            await writableFile.close();
        } catch (err) {
            // Fail silently if the user has simply canceled the dialog.
            if (err.name !== 'AbortError') {
                console.error(err.name, err.message);
            }
        }
    } else {
        // Fallback if the File System Access API is not supported
        // Create the blob URL
        const blobURL = URL.createObjectURL(forecastBlob);

        // Create the `<a download>` element and append it invisibly.
        const a = document.createElement('a');
        a.href = blobURL;
        a.download = defaultName;
        a.style.display = 'none';
        document.body.append(a);

        // Programmatically click the element.
        a.click();

        // Revoke the blob URL and remove the element.
        setTimeout(() => {
            URL.revokeObjectURL(blobURL);
            a.remove();
        }, 1000);
    }
}
