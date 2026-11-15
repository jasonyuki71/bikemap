import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

console.log('Mapbox loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1IjoiaHlobyIsImEiOiJjbXdoZzVpOG0wMzN1MzBxNG1jMGtyd29zIn0.FXkj0Xq02A50Ty3wFfwgLA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
});

map.on('load', async () => {
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
        'line-color': '#0ffb4e',
        'line-width': 3,
        'line-opacity': 0.6,
        },
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#0ffb4e',
            'line-width': 3,
            'line-opacity': 0.6,
        },
    });

    try {
        const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');

        const stations = jsonData.data.stations;
        const trips = await d3.csv(
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
            trip => {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);
            return trip;
            }
        );

    computeStationTraffic(stations, trips);

    console.log('Station with traffic:', stations[0]);
    console.log('Number of trips:', trips.length);
    console.log('First trip:', trips[0]);

    console.log('Stations:', stations);
    console.log('First station:', stations[0]);
    const svg = d3.select('#map svg');

    function getCoords(station) {
        return map.project([station.lon, station.lat]);
    }
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(stations, station => station.totalTraffic)])
        .range([0, 25]);

    const stationFlow = d3.scaleQuantize()
        .domain([0, 1])
        .range(['darkorange', 'purple', 'steelblue']);

    function getStationColor(station) {
        const ratio = station.totalTraffic === 0
            ? 0.5
            : station.departures / station.totalTraffic;

        return stationFlow(ratio);
    }

    const circles = svg
        .selectAll('circle')
        .data(stations)
        .join('circle')
        .attr('r', station => radiusScale(station.totalTraffic))
        .attr('fill', getStationColor)
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'white')
        .attr('stroke-width', 1);
        circles.append('title')
        .text(station =>
            `${station.totalTraffic} trips (${station.departures} departures, ${station.arrivals} arrivals)`
        );

    function updatePositions() {
        circles
        .attr('cx', station => getCoords(station).x)
        .attr('cy', station => getCoords(station).y);
    }

    updatePositions();

    map.on('move', updatePositions);
    map.on('resize', updatePositions);

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    function updateScatterPlot(timeFilter) {
        const filteredTrips = filterTripsByTime(trips, timeFilter);
        computeStationTraffic(stations, filteredTrips);

        radiusScale.range(timeFilter === -1 ? [0, 25] : [0, 50]);

        circles
            .attr('r', station => radiusScale(station.totalTraffic))
            .attr('fill', getStationColor);
        circles.select('title')
            .text(station =>
                `${station.totalTraffic} trips (${station.departures} departures, ${station.arrivals} arrivals)`
            );
    }

    function updateTimeDisplay() {
        const timeFilter = Number(timeSlider.value);

        if (timeFilter === -1) {
            selectedTime.textContent = '';
            anyTimeLabel.style.display = 'block';
        } else {
            selectedTime.textContent = formatTime(timeFilter);
            anyTimeLabel.style.display = 'none';
        }
        updateScatterPlot(timeFilter);
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
    } catch (error) {
    console.error('Error loading or drawing stations:', error);
    }
});

function formatTime(minutes) {
    const date = new Date(2024, 0, 1);
    date.setMinutes(minutes);

    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
        trips,
        group => group.length,
        trip => trip.start_station_id
    );

    const arrivals = d3.rollup(
        trips,
        group => group.length,
        trip => trip.end_station_id
    );

    for (const station of stations) {
        const id = station.short_name;

        station.departures = departures.get(id) ?? 0;
        station.arrivals = arrivals.get(id) ?? 0;
        station.totalTraffic = station.departures + station.arrivals;
    }
    return stations;
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
    if (timeFilter === -1) return trips;

    return trips.filter(trip => {
        const start = minutesSinceMidnight(trip.started_at);
        const end = minutesSinceMidnight(trip.ended_at);

        return (
            Math.abs(start - timeFilter) <= 60 ||
            Math.abs(end - timeFilter) <= 60
        );
    });
}
