/*
To select a file and run the code:
  1. Set the FILE_TYPE environmental variable to either "request" or "group" to select the file.
     - If FILE_TYPE is set to "request", the code will use "http_req_duration.csv".
     - If FILE_TYPE is set to "group", the code will use "durations.csv".
  2. Save the selected CSV file in the same directory as the TypeScript file.
  3. Install the required dependencies by running the following command:
       npm install csv-parser
  4. Compile the TypeScript file by running the following command:
       npx tsc create-durations-percentiles.ts
  5. Run the JavaScript file by running the following command:
       node create-durations-percentiles.js
  6. The script will process the selected CSV file and output the 95th and 99th percentile durations for each request or group.
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

const fileType = process.env.FILE_TYPE;
let fileName: string;

if (fileType === 'request') {
  fileName = 'http_req_duration.csv';
} else if (fileType === 'group') {
  fileName = 'durations.csv';
} else {
  throw new Error('Invalid file type. Please set FILE_TYPE to either "request" or "group".');
}

fs.createReadStream(fileName)
  .pipe(csv({ headers: false })) // Assuming there are no headers in the CSV file
  .on('data', (row: any) => {
    totalRows++;
    const requestData = data.find((d) => d.request === (fileName === 'http_req_duration.csv' ? row[2] : row[1]));
    const durationString = (fileName === 'http_req_duration.csv' ? row[3] : row[2]).replace(/[^0-9.]/g, ''); // Remove non-numeric characters
    const duration = parseFloat(durationString); // Convert duration to a number
    if (!isNaN(duration)) {
      if (requestData) {
        requestData.durations.push(duration);
      } else {
        data.push({
          request: (fileName === 'http_req_duration.csv' ? row[2] : row[1]),
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
      const p95 = Math.round(durations[p95Index]);
      const p99 = Math.round(durations[p99Index]);
      console.log(`Request: ${requestData.request}`);
      console.log(`95th percentile duration: ${p95} ms`);
      console.log(`99th percentile duration: ${p99} ms`);
    });
    console.log(`Total rows processed: ${processedRows}`);
    console.log(`Total rows in the CSV file: ${totalRows}`);
  });