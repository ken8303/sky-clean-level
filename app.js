const weatherEndpoint = "https://api.open-meteo.com/v1/forecast";
const geocodeEndpoint = "https://geocoding-api.open-meteo.com/v1/search";

const elements = {
  locateButton: document.querySelector("#locate-button"),
  refreshButton: document.querySelector("#refresh-button"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#location-search"),
  placeLabel: document.querySelector("#place-label"),
  cloudCover: document.querySelector("#cloud-cover"),
  currentSummary: document.querySelector("#current-summary"),
  nightList: document.querySelector("#night-list"),
  status: document.querySelector("#status-message"),
  panel: document.querySelector(".forecast-panel"),
};

let activeLocation = null;

const weatherCodes = new Map([
  [0, "Clear"],
  [1, "Mostly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Freezing fog"],
  [51, "Light drizzle"],
  [53, "Drizzle"],
  [55, "Heavy drizzle"],
  [61, "Light rain"],
  [63, "Rain"],
  [65, "Heavy rain"],
  [71, "Light snow"],
  [73, "Snow"],
  [75, "Heavy snow"],
  [80, "Light showers"],
  [81, "Showers"],
  [82, "Heavy showers"],
  [95, "Thunderstorm"],
]);

function setStatus(message) {
  elements.status.textContent = message;
}

function setLoading(isLoading) {
  elements.panel.classList.toggle("is-loading", isLoading);
}

function formatHour(isoTime) {
  return isoTime.slice(11, 16);
}

function formatDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat([], { weekday: "long", month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

function formatPlace(location) {
  if (location.name) {
    const parts = [location.name, location.admin1, location.country].filter(Boolean);
    return parts.join(", ");
  }

  return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
}

function getSkyCleanLevel(cloudCover) {
  return Math.max(0, Math.min(100, 100 - Math.round(cloudCover)));
}

function summarizeSkyCleanLevel(value, weatherCode) {
  const condition = weatherCodes.get(weatherCode) || "Forecast ready";

  if (value >= 88) return `${condition}. The sky is very clean and open.`;
  if (value >= 60) return `${condition}. Good sky clean level with some cloud around.`;
  if (value >= 35) return `${condition}. Mixed sky, partly clean and partly cloudy.`;
  if (value >= 12) return `${condition}. Low sky clean level right now.`;
  return `${condition}. The sky is heavily covered.`;
}

function getHourlyRows(data) {
  return data.hourly.time.map((time, index) => ({
    index,
    time,
    cloudCover: data.hourly.cloud_cover[index],
    temperature: data.hourly.temperature_2m[index],
    weatherCode: data.hourly.weather_code[index],
    isDay: data.hourly.is_day[index],
  }));
}

function getCurrentHourIndex(rows, currentTime) {
  const exactIndex = rows.findIndex((row) => row.time === currentTime);
  if (exactIndex >= 0) return exactIndex;

  const nextIndex = rows.findIndex((row) => row.time > currentTime);
  return Math.max(nextIndex, 0);
}

function getPreviousDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  const previousYear = date.getFullYear();
  const previousMonth = String(date.getMonth() + 1).padStart(2, "0");
  const previousDay = String(date.getDate()).padStart(2, "0");
  return `${previousYear}-${previousMonth}-${previousDay}`;
}

function getNightGroups(rows, startIndex) {
  const groups = new Map();
  const futureRows = rows.slice(startIndex);

  futureRows.forEach((row) => {
    const date = row.time.slice(0, 10);
    const hour = Number(row.time.slice(11, 13));
    if (hour > 6 && hour < 18) return;

    const groupDate = hour <= 6 ? getPreviousDate(date) : date;
    if (!groups.has(groupDate)) groups.set(groupDate, []);
    groups.get(groupDate).push(row);
  });

  return [...groups.entries()].slice(0, 3).map(([date, hours]) => ({
    title: `${formatDay(date)} night`,
    hours,
  }));
}

function renderNights(groups) {
  elements.nightList.replaceChildren(
    ...groups.map((group) => {
      const section = document.createElement("article");
      section.className = "night-group";

      const hours = group.hours
        .map((row) => {
          const skyCleanLevel = getSkyCleanLevel(row.cloudCover);
          return `
            <div class="night-hour">
              <span class="night-time">${formatHour(row.time)}</span>
              <strong>${skyCleanLevel}%</strong>
              <div class="mini-cloud" aria-hidden="true"><span style="width: ${skyCleanLevel}%"></span></div>
            </div>
          `;
        })
        .join("");

      section.innerHTML = `
        <h3 class="night-title">${group.title}</h3>
        <div class="night-grid">${hours}</div>
      `;
      return section;
    }),
  );
}

async function fetchForecast(location) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: "cloud_cover,temperature_2m,weather_code,is_day",
    hourly: "cloud_cover,temperature_2m,weather_code,is_day",
    forecast_days: "5",
    timezone: "auto",
  });

  const response = await fetch(`${weatherEndpoint}?${params}`);
  if (!response.ok) throw new Error("Weather service did not respond.");
  return response.json();
}

async function renderForecast(location) {
  activeLocation = location;
  setLoading(true);
  setStatus("Getting the latest sky clean forecast...");

  try {
    const forecast = await fetchForecast(location);
    const currentSkyCleanLevel = getSkyCleanLevel(forecast.current.cloud_cover);
    const rows = getHourlyRows(forecast);
    const currentHourIndex = getCurrentHourIndex(rows, forecast.current.time);

    elements.placeLabel.textContent = formatPlace(location);
    elements.cloudCover.textContent = currentSkyCleanLevel;
    elements.currentSummary.textContent = summarizeSkyCleanLevel(currentSkyCleanLevel, forecast.current.weather_code);
    renderNights(getNightGroups(rows, currentHourIndex));
    setStatus(`Updated ${new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date())}`);
  } catch (error) {
    setStatus(error.message || "Could not load the forecast. Please try again.");
  } finally {
    setLoading(false);
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus("This browser does not support current location. Try searching for a place.");
    return;
  }

  setStatus("Waiting for location permission...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      renderForecast({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    () => {
      setStatus("Location was not available. Search for a place instead.");
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
  );
}

async function searchLocation(name) {
  setLoading(true);
  setStatus("Finding that place...");

  try {
    const params = new URLSearchParams({ name, count: "1", language: "en", format: "json" });
    const response = await fetch(`${geocodeEndpoint}?${params}`);
    if (!response.ok) throw new Error("Location search did not respond.");

    const data = await response.json();
    if (!data.results?.length) throw new Error("No matching place found.");

    const [result] = data.results;
    await renderForecast({
      name: result.name,
      admin1: result.admin1,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
    });
  } catch (error) {
    setStatus(error.message || "Could not find that place.");
  } finally {
    setLoading(false);
  }
}

elements.locateButton.addEventListener("click", locateUser);
elements.refreshButton.addEventListener("click", () => {
  if (activeLocation) {
    renderForecast(activeLocation);
  } else {
    setStatus("Choose a location first.");
  }
});

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const locationName = elements.searchInput.value.trim();
  if (locationName) searchLocation(locationName);
});

searchLocation("London");
