/*
To get the p95 and p99 durations from the results (after running the create-summary.sh):
  1. Move the durations.csv file to the durations-percentiles-calculations directory
  2. Compile the TypeScript file by running the following command:
       npx tsc create-durations-percentiles.ts
  3. Run the JavaScript file by running the following command:
       node create-durations-percentiles.js
  5. The script will process the CSV file and output the 95th and 99th percentile durations for each request or group.
*/

import * as fs from 'fs';
import * as csv from 'csv-parser';

interface RequestData {
  request: string;
  durations: number[];
}

const data: RequestData[] = [];
let totalRows = 0;
let processedRows = 0;

const fileName = 'durations.csv';

fs.createReadStream(fileName)
  .pipe(csv({ headers: false })) // Assuming there are no headers in the CSV file
  .on('data', (row: any) => {
    totalRows++;
    const requestData = data.find((d) => d.request === row[1]);
    const durationString = row[2].replace(/[^0-9.]/g, ''); // Remove non-numeric characters
    const duration = parseFloat(durationString); // Convert duration to a number
    if (!isNaN(duration)) {
      if (requestData) {
        requestData.durations.push(duration);
      } else {
        data.push({
          request: row[1],
          durations: [duration],
        });
      }
    }
    processedRows++;
  })
  .on('end', () => {
    data.sort((a, b) => a.request.localeCompare(b.request));
    data.forEach((requestData) => {
      const durations = requestData.durations.sort((a, b) => a - b);
      const n = durations.length;
      const p95Index = Math.floor(n * 0.95);
      const p99Index = Math.floor(n * 0.99);
      const p95 = Math.round(durations[p95Index]);
      const p99 = Math.round(durations[p99Index]);
      console.log(`Request: ${requestData.request}`);
      console.log(`95th percentile duration: ${p95} ms`);
      console.log(`99th percentile duration: ${p99} ms`);
    });
    console.log(`Total rows processed: ${processedRows}`);
    console.log(`Total rows in the CSV file: ${totalRows}`);
  });