import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignInScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'
import {
  generateAuthCreateAccount,
  generateAuthReqParsedEnrichment,
  generateAuthLogInSuccessEnrichment
} from '../common/requestGenerator/txmaReqGen'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sendRegularEventWithEnrichment', LoadProfile.smoke)
  },
  load: {
    ...createScenario('sendRegularEventWithEnrichment', LoadProfile.full, 100, 3)
  },
  spikeI2HighTraffic: {
    ...createScenario('sendRegularEventWithEnrichment', LoadProfile.spikeI2HighTraffic, 1804, 3)
  },
  perf006Iteration2PeakTest: {
    sendRegularEventWithEnrichment: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1857,
      stages: [
        { target: 619, duration: '283s' },
        { target: 619, duration: '30m' }
      ],
      exec: 'sendRegularEventWithEnrichment'
    }
  },
  perf006I3PeakTest: {
    sendRegularEventWithEnrichment: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 3408,
      stages: [
        { target: 1136, duration: '518s' },
        { target: 1136, duration: '30m' }
      ],
      exec: 'sendRegularEventWithEnrichment'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignInScenario('sendRegularEventWithEnrichment', 3389, 3, 1542)
  },
  peakTest2000: {
    sendRegularEventWithEnrichment: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 3000,
      maxVUs: 6000,
      stages: [
        { target: 2000, duration: '911s' },
        { target: 2000, duration: '30m' }
      ],
      exec: 'sendRegularEventWithEnrichment'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignInScenario('sendRegularEventWithEnrichment', 2423, 3, 66)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignInScenario('sendRegularEventWithEnrichment', 6261, 3, 169)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignInScenario('sendRegularEventWithEnrichment', 3309, 3, 89)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignInScenario('sendRegularEventWithEnrichment', 7753, 3, 208)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignInScenario('sendRegularEventWithEnrichment', 3820, 3, 571)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignInScenario('sendRegularEventWithEnrichment', 6472, 3, 571)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignInScenario('sendRegularEventWithEnrichment', 3367, 3, 181)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignInScenario('sendRegularEventWithEnrichment', 3654, 3, 171)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignInScenario('sendRegularEventWithEnrichment', 7135, 3, 631)
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

const env = {
  sqs_queue: getEnv('DATA_TXMA_SQS')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

export function setup(): string {
  describeProfile(loadProfile)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const pairWiseID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestRpPairwiseId`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const journeyID = 'journeyID'
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID))
  const authReqParsedPayloadEnrichment = JSON.stringify(generateAuthReqParsedEnrichment(journeyID, testID))

  console.log('Sending primer event 1')
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  console.log('Primer event 1 sent')

  console.log('Sending primer event 2')
  sqs.sendMessage(env.sqs_queue, authReqParsedPayloadEnrichment)
  console.log('Primer event 2 sent')
  return authCreateAccPayload
}

export function sendRegularEventWithEnrichment(authCreateAccPayload: string): void {
  iterationsStarted.add(1)
  const authCreatePayload = JSON.parse(authCreateAccPayload)
  const testID = JSON.stringify(authCreatePayload.event_id).substring(1, 26)
  const eventID = `${testID}_${uuidv4()}`
  const journeyID = 'journeyID'
  const authLogInSuccessPayloadEnrichment = JSON.stringify(
    generateAuthLogInSuccessEnrichment(
      eventID,
      `${authCreatePayload.user.user_id}`,
      `${authCreatePayload.user.email}`,
      journeyID
    )
  )
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayloadEnrichment)
  iterationsCompleted.add(1)
}
