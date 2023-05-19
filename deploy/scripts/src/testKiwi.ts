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
    },

    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'CIC'
    }

  },
  load: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 50, duration: '15m' }, // Ramps up to target load
        { target: 50, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 50 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'FaceToFace'
    },
    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 800,
      stages: [
        { target: 50, duration: '15m' }, // Ramps up to target load
        { target: 50, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 50 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'CIC'
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

export function CIC (): void {
  let res: Response
  let csrfToken: string

  group('B01_CIC_01_LaunchLandingPage GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B01_CIC_01_LaunchLandingPage' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('What is your name?')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  group('B01_CIC_02_UserDetails POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/nameEntry', {
      surname: 'NameTest',
      firstName: 'FirstNameTest',
      middleName: '',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B01_CIC_02_UserDetails' }
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

  group('B01_CIC_03_UserBirthdate POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/dateOfBirth', {
      'dateOfBirth-day': '1',
      'dateOfBirth-month': '1',
      'dateOfBirth-year': '1985',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B01_CIC_03_UserBirthdate' }
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

export function FaceToFace (): void {
  let res: Response
  let csrfToken: string

  group('B02_FaceToFace_01_LaunchLandingPage GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B02_FaceToFace_01_LaunchLandingPage' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('How to prove your identity at a Post Office')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_02_Continue POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/landingPage', {
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace_02_Continue' }
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

  group('B02_FaceToFace03_ChoosePhotoId POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/photoIdSelection', {
      photoIdChoice: 'ukPassport',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace03_ChoosePhotoId' }
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

  group('B02_FaceToFace_04_PassportDetails POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/ukPassportDetails', {
      'ukPassportExpiryDate-day': '1',
      'ukPassportExpiryDate-month': '1',
      'ukPassportExpiryDate-year': '2025',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace_04_PassportDetails' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter a UK postcode')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_05_FindPostOffice POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/findBranch', {
      postcode: 'SW1A 2AA',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace_05_FindPosttOffice' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Choose a Post Office where you can prove your identity')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_06_ChoosePostOffice POST', function () {
    const startTime = Date.now()
    res = http.post(env.envURL + '/locations', {
      branches: '1',
      continue: '',
      'x-csrf-token': csrfToken

    }, {
      tags: { name: 'B02_FaceToFace_06_ChoosePostOffice' }
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
