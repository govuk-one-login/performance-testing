/*
To get p95 and p99 durations for each group in durations.csv file
    1. First, run the create-summary.sh file to get the durations.csv file (make sure durations.csv file is in the same directory as this file)
    2. Install the required dependencies by running the following command:
     npm install csv-parser
    3. Compile the TypeScript file by running the following command:
     npx tsc percentiles.ts
    4. Run the JavaScript file by running the following command:
     node percentiles.js
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

fs.createReadStream('durations.csv')
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
    data.forEach((requestData) => {
      const durations = requestData.durations.sort((a, b) => a - b);
      const n = durations.length;
      const p95Index = Math.floor(n * 0.95);
      const p99Index = Math.floor(n * 0.99);
      const p95 = durations[p95Index];
      const p99 = durations[p99Index];
      console.log(`Request: ${requestData.request}`);
      console.log(`95th percentile duration: ${p95} ms`);
      console.log(`99th percentile duration: ${p99} ms`);
    });
    console.log(`Total rows processed: ${processedRows}`);
    console.log(`Total rows in the CSV file: ${totalRows}`);
  });