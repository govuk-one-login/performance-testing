import { type Options, type Scenario } from 'k6/options'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { timeGroup } from '../common/utils/request/timing'
import {
  generateAuthAuthorisationInitiated,
  generateAuthCodeVerified,
  generateAuthCreateAccount,
  generateRandomIP,
  generateRandomPhoneNumber,
  generateTicfWorkQueueAssigned,
  type SubjectGroupCounts
} from '../common/requestGenerator/txmaReqGen'
import { uuidv4 } from '../common/utils/jslib/index'

interface SubjectGroupLoad {
  subjects: number
  seedRate: number
  assignRate: number
  groups: number
  drainGapSeconds: number
}

const loads: Record<string, SubjectGroupLoad> = {
  smoke: { subjects: 10, seedRate: 1, assignRate: 1, groups: 1, drainGapSeconds: 60 },
  sg1k: { subjects: 100_000, seedRate: 1000, assignRate: 1000, groups: 1, drainGapSeconds: 300 },
  sg3k: { subjects: 100_000, seedRate: 1000, assignRate: 3300, groups: 1, drainGapSeconds: 300 },
  sgSoak: { subjects: 100_000, seedRate: 1000, assignRate: 500, groups: 3, drainGapSeconds: 300 }
}

function arrivalRateScenario(rate: number, durationSeconds: number, startTimeSeconds: number, fn: string): Scenario {
  return {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration: `${durationSeconds}s`,
    startTime: `${startTimeSeconds}s`,
    preAllocatedVUs: Math.max(10, Math.ceil(rate / 5)),
    maxVUs: Math.max(20, rate),
    exec: fn
  }
}

function createSubjectGroupProfile(load: SubjectGroupLoad): Record<string, Scenario> {
  const seedSeconds = Math.ceil(load.subjects / load.seedRate)
  const assignSeconds = Math.ceil((load.subjects * load.groups) / load.assignRate)
  return {
    seedSubjects: arrivalRateScenario(load.seedRate, seedSeconds, 0, 'seedSubjects'),
    assignGroup: arrivalRateScenario(load.assignRate, assignSeconds, seedSeconds + load.drainGapSeconds, 'assignGroup')
  }
}

const profiles: ProfileList = {}
Object.keys(loads).forEach(name => {
  profiles[name] = createSubjectGroupProfile(loads[name])
})

const loadProfile = selectProfile(profiles)
const load = loads[loadProfile.name]
const groupMap = {
  seedSubjects: [
    'B03_SubjectGroups_01_SendAuthAuthorisationInitiated',
    'B03_SubjectGroups_02_SendAuthCodeVerified',
    'B03_SubjectGroups_03_SendAuthCreateAccount'
  ],
  assignGroup: ['B03_SubjectGroups_04_SendTicfWorkQueueAssigned']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

const env = {
  sqs_queue: getEnv('TiCF_SQS_QUEUE'),
  subjectRunId: getEnv('SUBJECT_RUN_ID', false)
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

interface RunData {
  runId: string
  batchId: string
}

const groupCounts: SubjectGroupCounts = {
  uniqueAccountCount: load.subjects,
  uniqueSubjectCount: load.subjects,
  countType: 'actual'
}

export function setup(): RunData {
  describeProfile(loadProfile)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')
  const runId = env.subjectRunId ?? timestamp
  console.log(`Subject run id: ${runId}, batch id: ${timestamp}`)
  return { runId, batchId: timestamp }
}

function subjectId(runId: string, index: number): string {
  return `urn:fdc:gov.uk:2022:perfSG-${runId}-${index}`
}

function groupUri(batchId: string, groupIndex: number): string {
  return `urn:fdc:HMRC.gov.uk:2022:GROUP:PERF-${batchId}-${groupIndex}`
}

export function seedSubjects(data: RunData): void {
  const groups = groupMap.seedSubjects
  const index = exec.scenario.iterationInTest
  const userID = subjectId(data.runId, index)
  const emailID = `perfSubjectGroup-${data.runId}-${index}@digital.cabinet-office.gov.uk`
  const journeyID = `perfJourney${uuidv4()}`
  const testID = `perfTestID${data.runId}`
  const pairWiseID = `performanceTestRpPairwiseId${uuidv4()}`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()

  iterationsStarted.add(1)

  timeGroup(groups[0], () =>
    sqs.sendMessage(env.sqs_queue, JSON.stringify(generateAuthAuthorisationInitiated(journeyID, randomIP)))
  )
  timeGroup(groups[1], () =>
    sqs.sendMessage(env.sqs_queue, JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID, randomIP)))
  )
  timeGroup(groups[2], () =>
    sqs.sendMessage(
      env.sqs_queue,
      JSON.stringify(
        generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID, randomIP, randomPhoneNumber)
      )
    )
  )

  iterationsCompleted.add(1)
}

export function assignGroup(data: RunData): void {
  const groups = groupMap.assignGroup
  const index = exec.scenario.iterationInTest
  const userID = subjectId(data.runId, index % load.subjects)
  const uri = groupUri(data.batchId, Math.floor(index / load.subjects))

  iterationsStarted.add(1)

  timeGroup(groups[0], () =>
    sqs.sendMessage(
      env.sqs_queue,
      JSON.stringify(generateTicfWorkQueueAssigned(userID, uri, data.batchId, groupCounts))
    )
  )

  iterationsCompleted.add(1)
}
