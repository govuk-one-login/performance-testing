import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'
import { Trend } from 'k6/metrics'

const profiles: ProfileList = {
  smoke: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'FaceToFace'
    }

  },
  load: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '120s' }, // Ramps up to target load
        { target: 60, duration: '120s' } // Holds at target load
      ],
      exec: 'FaceToFace'
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
  envURL: __ENV.ENV_URL
}

const transactionDuration = new Trend('duration')

export function FaceToFace (): void {
  let res: Response
  let csrfToken: string

  group('B01_FaceToFace_LaunchLandingPage GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B01_FaceToFace_LaunchLandingPage' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Proving your identity in person')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_Continue POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/landingPage', {
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace_Continue' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Choose a photo ID you can take to a Post Office')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B03_FaceToFace_ChoosePhotoId POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/photoIdSelection', {
      photoIdChoice: 'ukPassport',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B03_FaceToFace_ChoosePhotoId' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('When does your UK passport expire')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B04_FaceToFace_PassportDetails POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/passportDetails', {
      'passportExpiryDate-day': '1',
      'passportExpiryDate-month': '1',
      'passportExpiryDate-year': '2025',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B04_FaceToFace_PassportDetails' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('What is your name')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B05_FaceToFace_UserDetails POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/nameEntry', {
      surname: 'NameTest',
      firstName: 'FirstNameTest',
      middleName: '',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B05_FaceToFace_UserDetails' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('What is your date of birth')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B06_FaceToFace_UserBirthdate POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/dateOfBirth', {
      'dateOfBirth-day': '1',
      'dateOfBirth-month': '1',
      'dateOfBirth-year': '1985',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B06_FaceToFace_UserBirthdate' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Check your details')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
}
