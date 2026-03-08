// ==============================
// NETWORK CONFIGURATION
// ==============================
// This points directly to your friend's Mac!
const BACKEND_URL = "http://10.200.2.192:3000"; 

let map;

// ==============================
// INITIALIZATION
// ==============================
document.addEventListener("DOMContentLoaded", function () {
    // If the map exists on this page, load it and fetch the user's location
    if (document.getElementById('map')) {
        initMap();
        getUserLocation();
    }
    
    // Always fetch the latest data from the Mac when ANY page loads
    fetchServerData();
});

// ==============================
// MAP INITIALIZATION
// ==============================
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// ==============================
// USER GPS LOCATION
// ==============================
function getUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;
        if (map) {
            L.marker([lat, lon]).addTo(map).bindPopup("📍 Your Location");
        }
    });
}

// ==============================
// FETCH DATA FROM MAC SERVER
// ==============================
async function fetchServerData() {
    try {
        let res = await fetch(`${BACKEND_URL}/api/data`);
        let data = await res.json();

        // 1. Update Dashboard Counters
        if (document.getElementById("totalAlerts")) document.getElementById("totalAlerts").innerText = data.totalAlerts;
        if (document.getElementById("highAlerts")) document.getElementById("highAlerts").innerText = data.highAlerts;
        if (document.getElementById("mediumAlerts")) document.getElementById("mediumAlerts").innerText = data.mediumAlerts;
        if (document.getElementById("lowAlerts")) document.getElementById("lowAlerts").innerText = data.lowAlerts;

        // 2. Update Map Markers
        if (map) {
            data.reports.forEach(report => {
                addMarker(report.lat, report.lon, report.disaster, report.priority, false);
            });
        }

        // 3. Update Timeline Page
        let timelineEl = document.getElementById("timeline");
        if (timelineEl) {
            timelineEl.innerHTML = ""; // Clear old items
            data.timeline.forEach(item => {
                let li = document.createElement("li");
                li.innerText = item;
                timelineEl.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Cannot connect to the Mac backend:", error);
    }
}

// ==============================
// CORE NETWORK SENDER FUNCTION
// ==============================
// We use this single function to send data from the Search bar, Report page, AND SOS page
async function sendDataToServer(lat, lon, disaster, priority, place) {
    let payload = {
        lat: lat,
        lon: lon,
        disaster: disaster,
        priority: priority,
        place: place
    };

    let res = await fetch(`${BACKEND_URL}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        addMarker(lat, lon, disaster, priority, true);
        fetchServerData(); // Refresh all stats right after saving
    } else {
        throw new Error("Server rejected the request.");
    }
}

// ==============================
// QUICK REPORT (DASHBOARD SEARCH BAR)
// ==============================
async function submitQuickReport() {
    let input = document.getElementById("quickReportInput");
    let message = input.value;
    if (!message) return;

    let btn = input.nextElementSibling;
    let originalText = btn.innerText;
    btn.innerText = "Sending to Mac...";
    btn.disabled = true;

    try {
        let place = extractLocation(message);
        let coords = await getLocation(place);
        let disaster = detectDisaster(message);
        let priority = detectPriority(disaster);

        // Send to Mac!
        await sendDataToServer(coords[0], coords[1], disaster, priority, place);

        input.value = ""; // Clear input on success
    } catch (error) {
        alert("Failed to send data to the Mac. Make sure the server is running.");
        console.error(error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==============================
// FULL PAGE REPORT (REPORT.HTML)
// ==============================
async function submitReport() {
    let message = document.getElementById("message").value;
    if (!message) return;

    let btn = document.querySelector("button");
    let originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        let place = extractLocation(message);
        let coords = await getLocation(place);
        let disaster = detectDisaster(message);
        let priority = detectPriority(disaster);

        // Send to Mac!
        await sendDataToServer(coords[0], coords[1], disaster, priority, place);

        if (document.getElementById("result")) {
            document.getElementById("result").innerText = `✅ Report sent securely: ${disaster} in ${place}`;
        }
        document.getElementById("message").value = "";
    } catch (error) {
        console.error(error);
        alert("Error sending report to backend.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==============================
// SOS BUTTON (SOS.HTML)
// ==============================
function sendSOS() {
    let btn = document.querySelector(".sos");
    let originalText = btn.innerText;
    btn.innerText = "Locating...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async function (pos) {
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;

        try {
            btn.innerText = "Sending to Mac...";
            // Force Priority to High and send to Mac
            await sendDataToServer(lat, lon, "SOS Emergency Triggered", "High", "GPS Location");

            if (document.getElementById("sosStatus")) {
                document.getElementById("sosStatus").innerText = `✅ SOS broadcasted successfully from coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        } catch (err) {
            console.error(err);
            alert("Failed to connect to backend.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }, function (err) {
        alert("Please allow location access to send an SOS.");
        btn.innerText = originalText;
        btn.disabled = false;
    });
}

// ==============================
// NLP & HELPER FUNCTIONS
// ==============================
function extractLocation(text) {
    text = text.toLowerCase();
    if (text.includes(" in ")) return text.split(" in ")[1].trim();
    if (text.includes(" near ")) return text.split(" near ")[1].trim();
    return text;
}

async function getLocation(place) {
    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`;
        let res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'CrisisMapApp/1.0' } });
        if (!res.ok) throw new Error("API response not OK");
        let data = await res.json();
        if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch (e) {
        console.error("Geocoding failed:", e);
    }
    return [20.5937, 78.9629]; // Default coordinates
}

function detectDisaster(text) {
    text = text.toLowerCase();
    if (text.includes("flood") || text.includes("water")) return "Flood";
    if (text.includes("earthquake") || text.includes("quake")) return "Earthquake";
    if (text.includes("fire") || text.includes("smoke")) return "Fire";
    if (text.includes("landslide")) return "Landslide";
    return "General Emergency";
}

function detectPriority(disaster) {
    if (["Flood", "Earthquake"].includes(disaster)) return "High";
    if (["Fire", "Landslide"].includes(disaster)) return "Medium";
    return "Low";
}

function addMarker(lat, lon, disaster, priority, panTo = true) {
    if (!map) return;
    
    // Choose pin color based on priority
    let colorHex = priority === 'High' ? '#ef4444' : priority === 'Medium' ? '#f59e0b' : '#10b981';
    
    let customIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: ${colorHex}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    L.marker([lat, lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(`<b>${disaster}</b><br>Priority: ${priority}`);

    if (panTo) map.setView([lat, lon], 7);
}

// ==============================
// VOLUNTEERS
// ==============================
function addVolunteer() {
    let list = document.getElementById("volunteers");
    if (!list) return;
    let item = document.createElement("li");
    item.innerText = "👷‍♂️ New Volunteer joined to help!";
    list.appendChild(item);
}

// ==============================
// CLEAR DATA (Sends command to Mac)
// ==============================
async function clearAllData() {
    if (confirm("⚠️ Delete all data on the Mac server?")) {
        await fetch(`${BACKEND_URL}/api/clear`, { method: "POST" });
        location.reload();
    }
}