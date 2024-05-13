"use strict";
/*
To select a file and run the code:
  1. Set the FILE_TYPE environmental variable to either "request" or "group" to select the file.
     - If FILE_TYPE is set to "request", the code will use "http_req_duration.csv".
     - If FILE_TYPE is set to "group", the code will use "durations.csv".
  2. Move the durations CSV file to the durations-percentiles-calculations directory
  3. Install the required dependencies by running the following command:
       npm install csv-parser
  4. Compile the TypeScript file by running the following command:
       npx tsc create-durations-percentiles.ts
  5. Run the JavaScript file by running the following command:
       node create-durations-percentiles.js
  6. The script will process the selected CSV file and output the 95th and 99th percentile durations for each request or group.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var csv = require("csv-parser");
var data = [];
var totalRows = 0;
var processedRows = 0;
var fileName = 'durations.csv';
fs.createReadStream(fileName)
    .pipe(csv({ headers: false })) // Assuming there are no headers in the CSV file
    .on('data', function (row) {
    totalRows++;
    var requestData = data.find(function (d) { return d.request === row[1]; });
    var durationString = row[2].replace(/[^0-9.]/g, ''); // Remove non-numeric characters
    var duration = parseFloat(durationString); // Convert duration to a number
    if (!isNaN(duration)) {
        if (requestData) {
            requestData.durations.push(duration);
        }
        else {
            data.push({
                request: row[1],
                durations: [duration],
            });
        }
    }
    processedRows++;
})
    .on('end', function () {
    data.sort(function (a, b) { return a.request.localeCompare(b.request); });
    data.forEach(function (requestData) {
        var durations = requestData.durations.sort(function (a, b) { return a - b; });
        var n = durations.length;
        var p95Index = Math.floor(n * 0.95);
        var p99Index = Math.floor(n * 0.99);
        var p95 = Math.round(durations[p95Index]);
        var p99 = Math.round(durations[p99Index]);
        console.log("Request: ".concat(requestData.request));
        console.log("95th percentile duration: ".concat(p95, " ms"));
        console.log("99th percentile duration: ".concat(p99, " ms"));
    });
    console.log("Total rows processed: ".concat(processedRows));
    console.log("Total rows in the CSV file: ".concat(totalRows));
});
