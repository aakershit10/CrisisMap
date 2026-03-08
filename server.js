const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// This allows your Windows machine to send requests to the Mac
app.use(cors()); 
app.use(express.json());

// This is our temporary "Database" stored in the Mac's memory
let db = {
    totalAlerts: 0,
    highAlerts: 0,
    mediumAlerts: 0,
    lowAlerts: 0,
    reports: [],
    timeline: [],
    volunteers: []
};

// 1. Send data to the frontend when requested
app.get('/api/data', (req, res) => {
    res.json(db);
});

// 2. Receive new disaster reports from the frontend
app.post('/api/report', (req, res) => {
    const newReport = req.body;
    
    // Save the report
    db.reports.push(newReport);
    
    // Update counters
    db.totalAlerts++;
    if (newReport.priority === "High") db.highAlerts++;
    else if (newReport.priority === "Medium") db.mediumAlerts++;
    else db.lowAlerts++;

    // Add to timeline
    const time = new Date().toLocaleTimeString();
    db.timeline.unshift(`${time} - ${newReport.disaster} reported at coordinates [${newReport.lat.toFixed(2)}, ${newReport.lon.toFixed(2)}]`);

    res.json({ message: "Report saved successfully!", db: db });
});

// 3. Clear all data
app.post('/api/clear', (req, res) => {
    db = { totalAlerts: 0, highAlerts: 0, mediumAlerts: 0, lowAlerts: 0, reports: [], timeline: [], volunteers: [] };
    res.json({ message: "Database cleared!" });
});

// Start the server and listen on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚨 CrisisMap Backend is LIVE!`);
    console.log(`Tell your friend on Windows to connect to: http://10.7.14.199:${PORT}`);
});