import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent1'
    },
    sendEventSmokeTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent2'
    },
    sendEventSmokeTest3: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent3'
    },
    sendEventSmokeTest4: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent4'
    },
    sendEventSmokeTest5: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent5'
    },
    sendEventSmokeTest6: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent6'
    },
    sendEventSmokeTest7: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' }
      ],
      exec: 'sendEvent7'
    }
  },
  load: {
    sendEventLoadTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent1'
    },
    sendEventLoadTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent2'
    },
    sendEventLoadTest3: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent3'
    },
    sendEventLoadTest4: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent4'
    },
    sendEventLoadTest5: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent5'
    },
    sendEventLoadTest6: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent6'
    },
    sendEventLoadTest7: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per second for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'sendEvent7'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  sqs_queue: __ENV.DATA_BTM_SQS
}

const awsConfig = new AWSConfig({
  region: __ENV.DATA_BTM_AWS_REGION,
  accessKeyId: __ENV.DATA_BTM_AWS_ACCESS_KEY_ID,
  secretAccessKey: __ENV.DATA_BTM_AWS_SECRET_ACCESS_KEY,
  sessionToken: __ENV.DATA_BTM_AWS_SESSION_TOKEN
})

const eventData = {
  payload: __ENV.DATA_BTM_SQS_PAYLOAD,
  payloadData1: __ENV.DATA_BTM_SQS_PAYLOAD_DATA1,
  payloadData2: __ENV.DATA_BTM_SQS_PAYLOAD_DATA2,
  payloadData3: __ENV.DATA_BTM_SQS_PAYLOAD_DATA3,
  payloadTimestamp: __ENV.DATA_BTM_SQS_PAYLOAD_TIMESTAMP
}

const payloadData1Array = eventData.payloadData1.split(',')
const payloadData2Array = eventData.payloadData2.split(',')
const payloadData3Array = eventData.payloadData3.split(',')
const payloadTimestampArray = eventData.payloadTimestamp.split(',')
const payloadTimestampMin: number = Number(payloadTimestampArray[0])
const payloadTimestampMax: number = Number(payloadTimestampArray[1])

let messageBody: string
let randomTimestamp: number
let timestampFormatted: string

const sqs = new SQSClient(awsConfig)

export function sendEvent1 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[0])
  messageBody = messageBody.replace('DATA2', payloadData2Array[0])
  messageBody = messageBody.replace('DATA3', payloadData3Array[0])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent1 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent2 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[1])
  messageBody = messageBody.replace('DATA2', payloadData2Array[1])
  messageBody = messageBody.replace('DATA3', payloadData3Array[1])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent2 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent3 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[2])
  messageBody = messageBody.replace('DATA2', payloadData2Array[2])
  messageBody = messageBody.replace('DATA3', payloadData3Array[2])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent3 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent4 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[3])
  messageBody = messageBody.replace('DATA2', payloadData2Array[3])
  messageBody = messageBody.replace('DATA3', payloadData3Array[3])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent4 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent5 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[4])
  messageBody = messageBody.replace('DATA2', payloadData2Array[4])
  messageBody = messageBody.replace('DATA3', payloadData3Array[4])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent5 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent6 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[5])
  messageBody = messageBody.replace('DATA2', payloadData2Array[5])
  messageBody = messageBody.replace('DATA3', payloadData3Array[5])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent6 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}

export function sendEvent7 (): void {
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[6])
  messageBody = messageBody.replace('DATA2', payloadData2Array[6])
  messageBody = messageBody.replace('DATA3', payloadData3Array[6])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('sendEvent7 === debug === messageBody \n', messageBody)
  sqs.sendMessage(env.sqs_queue, messageBody)
}
