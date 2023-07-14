import { sleep } from 'k6'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'

const loadProfileVar = {
  smokeMaxVU: __ENV.DATA_BTM_PROFILE_SMOKE_MAX_VU,
  smokeTarget: __ENV.DATA_BTM_PROFILE_SMOKE_TARGET,
  smokeDuration: __ENV.DATA_BTM_PROFILE_SMOKE_DURATION,

  loadMaxVU1: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU1,
  loadTarget1: __ENV.DATA_BTM_PROFILE_LOAD_TARGET1,
  loadDuration: __ENV.DATA_BTM_PROFILE_LOAD_DURATION,

  loadMaxVU2: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU2,
  loadTarget2: __ENV.DATA_BTM_PROFILE_LOAD_TARGET2,

  loadMaxVU3: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU3,
  loadTarget3: __ENV.DATA_BTM_PROFILE_LOAD_TARGET3,

  loadMaxVU4: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU4,
  loadTarget4: __ENV.DATA_BTM_PROFILE_LOAD_TARGET4,

  loadMaxVU5: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU5,
  loadTarget5: __ENV.DATA_BTM_PROFILE_LOAD_TARGET5,

  loadMaxVU6: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU6,
  loadTarget6: __ENV.DATA_BTM_PROFILE_LOAD_TARGET6,

  loadMaxVU7: __ENV.DATA_BTM_PROFILE_LOAD_MAX_VU7,
  loadTarget7: __ENV.DATA_BTM_PROFILE_LOAD_TARGET7
}

const smokeMaxVUInt = parseInt(loadProfileVar.smokeMaxVU, 10)
const smokeTargetInt = parseInt(loadProfileVar.smokeTarget, 10)

const loadMaxVUInt1 = parseInt(loadProfileVar.loadMaxVU1, 10)
const loadTargetInt1 = parseInt(loadProfileVar.loadTarget1, 10)

const loadMaxVUInt2 = parseInt(loadProfileVar.loadMaxVU2, 10)
const loadTargetInt2 = parseInt(loadProfileVar.loadTarget2, 10)

const loadMaxVUInt3 = parseInt(loadProfileVar.loadMaxVU3, 10)
const loadTargetInt3 = parseInt(loadProfileVar.loadTarget3, 10)

const loadMaxVUInt4 = parseInt(loadProfileVar.loadMaxVU4, 10)
const loadTargetInt4 = parseInt(loadProfileVar.loadTarget4, 10)

const loadMaxVUInt5 = parseInt(loadProfileVar.loadMaxVU5, 10)
const loadTargetInt5 = parseInt(loadProfileVar.loadTarget5, 10)

const loadMaxVUInt6 = parseInt(loadProfileVar.loadMaxVU6, 10)
const loadTargetInt6 = parseInt(loadProfileVar.loadTarget6, 10)

const loadMaxVUInt7 = parseInt(loadProfileVar.loadMaxVU7, 10)
const loadTargetInt7 = parseInt(loadProfileVar.loadTarget7, 10)

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent1'
    },
    sendEventSmokeTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent2'
    },
    sendEventSmokeTest3: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent3'
    },
    sendEventSmokeTest4: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent4'
    },
    sendEventSmokeTest5: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent5'
    },
    sendEventSmokeTest6: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent6'
    },
    sendEventSmokeTest7: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent7'
    },
    sendEventSmokeTest8: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: smokeMaxVUInt,
      stages: [
        { target: smokeTargetInt, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEventDebug'
    }
  },
  load: {
    sendEventLoadTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt1,
      stages: [
        { target: loadTargetInt1, duration: loadProfileVar.loadDuration }
      ],
      exec: 'sendEvent1'
    },
    sendEventLoadTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt2,
      stages: [
        { target: loadTargetInt2, duration: loadProfileVar.loadDuration }
      ],
      exec: 'sendEvent2'
    },
    sendEventLoadTest3: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt3,
      stages: [
        { target: loadTargetInt3, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent3'
    },
    sendEventLoadTest4: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt4,
      stages: [
        { target: loadTargetInt4, duration: loadProfileVar.smokeDuration }
      ],
      exec: 'sendEvent4'
    },
    sendEventLoadTest5: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt5,
      stages: [
        { target: loadTargetInt5, duration: loadProfileVar.loadDuration }
      ],
      exec: 'sendEvent5'
    },
    sendEventLoadTest6: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt6,
      stages: [
        { target: loadTargetInt6, duration: loadProfileVar.loadDuration }
      ],
      exec: 'sendEvent6'
    },
    sendEventLoadTest7: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: loadMaxVUInt7,
      stages: [
        { target: loadTargetInt7, duration: loadProfileVar.loadDuration }
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

export function sendEventDebug (): void {
  console.log('1 === debug === executing sendEventDebug \n')
  console.log('2 === debug === env.sqs_queue \n', env.sqs_queue)
  console.log('3 === debug === awsConfig \n', awsConfig)
  console.log('4 === debug === payload \n', eventData.payload)
  randomTimestamp = Math.floor(Math.random() * (payloadTimestampMax - payloadTimestampMin + 1)) + payloadTimestampMin
  timestampFormatted = new Date(randomTimestamp * 1000).toISOString()
  messageBody = eventData.payload.replace('UUID', uuidv4())
  messageBody = messageBody.replace('DATA1', payloadData1Array[0])
  messageBody = messageBody.replace('DATA2', payloadData2Array[0])
  messageBody = messageBody.replace('DATA3', payloadData3Array[0])
  messageBody = messageBody.replace(/""timestamp"":\s*""\d+""/, `""timestamp"": ${randomTimestamp}`)
  messageBody = messageBody.replace('TIMESTAMP', randomTimestamp.toString())
  messageBody = messageBody.replace('TIMESTAMP_FORMATTED', timestampFormatted).replace('Z', '')
  console.log('5 === debug === messageBody \n\n', messageBody)
  console.log('6 === debug === payloadData1Array \n', payloadData1Array)
  console.log('7 === debug === payloadData2Array \n', payloadData2Array)
  console.log('8 === debug === payloadData3Array \n', payloadData3Array)
  console.log('9 === debug === payloadTimestampArray \n', payloadTimestampArray)
  sqs.sendMessage(env.sqs_queue, messageBody)
  sleep(2)
}
