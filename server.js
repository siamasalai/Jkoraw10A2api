const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const apiRoutes = require('./controllerAPI/api-controller'); // Adjust path as per your folder structure

// Initialize Express app
const app = express();

// Use CORS to allow cross-origin requests
app.use(cors());

// Use body-parser to parse JSON bodies into JS objects
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Start server
const port = 7090;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
