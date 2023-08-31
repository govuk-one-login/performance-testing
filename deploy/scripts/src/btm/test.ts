import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4, randomIntBetween } from '../common/utils/jslib/index'
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
      exec: 'sendEventType1'
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
      exec: 'sendEventType2'
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
      exec: 'sendEventType3'
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
      exec: 'sendEventType4'
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
      exec: 'sendEventType5'
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
      exec: 'sendEventType6'
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
      exec: 'sendEventType7'
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
  payloadEventsString: __ENV.DATA_BTM_SQS_PAYLOAD_EVENTS,
  payloadTimestamp: __ENV.DATA_BTM_SQS_PAYLOAD_TIMESTAMP
}

const payloadEventsArray = JSON.parse(eventData.payloadEventsString)

const payloadTimestampArray = eventData.payloadTimestamp.split(',')
const payloadTimestampMin: number = Number(payloadTimestampArray[0])
const payloadTimestampMax: number = Number(payloadTimestampArray[1])

const sqs = new SQSClient(awsConfig)

export function sendEventType1 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[0])
  sendSQSMessage(messageBody)
}

export function sendEventType2 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[1])
  sendSQSMessage(messageBody)
}

export function sendEventType3 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[2])
  sendSQSMessage(messageBody)
}

export function sendEventType4 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[3])
  sendSQSMessage(messageBody)
}

export function sendEventType5 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[4])
  sendSQSMessage(messageBody)
}

export function sendEventType6 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[5])
  sendSQSMessage(messageBody)
}

export function sendEventType7 (): void {
  let messageBody: string = ''
  messageBody = JSON.stringify(payloadEventsArray[6])
  sendSQSMessage(messageBody)
}

export function sendSQSMessage (messageBody: string): void {
  let randomTimestamp: number = 0
  let timestampFormatted: string = ''
  randomTimestamp = randomIntBetween(payloadTimestampMin, payloadTimestampMax)
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted.replace('Z', ''))
  messageBody = messageBody.replace('UUID', uuidv4())
  sqs.sendMessage(env.sqs_queue, messageBody)
}
