import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    fraudScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' } // Ramps up to target load
      ],
      exec: 'fraudScenario1'
    }
  },
  load: {
    fraudScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'fraudScenario1'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  httpDebug: 'full',
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95th percntile response time <1000ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

type drivingLicenceIssuer = "DVA" | "DLVA";
var optionLicence: drivingLicenceIssuer = (Math.random() <=0,5) ? "DLVA" : "DVA"




export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  ipvCoreStub: __ENV.coreStub,
  fraudEndPoint: __ENV.fraudURL
}

const stubCreds = {
  userName: __ENV.CORE_STUB_USERNAME,
  password: __ENV.CORE_STUB_PASSWORD
}

const transactionDuration = new Trend('duration')

export function fraudScenario1 (): void {
  let res: Response
  let csrfToken: string
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  group(
    'B01_Fraud_01_CoreStubEditUserContinue POST',
    function () {
      const startTime = Date.now()
      res = http.post(
        env.ipvCoreStub + '/edit-user',
        {
          cri: 'fraud-cri-build',
          rowNumber: '197',
          firstName: userDetails.firstName,
          surname: userDetails.lastName,
          'dateOfBirth-day': `${userDetails.day}`,
          'dateOfBirth-month': `${userDetails.month}`,
          'dateOfBirth-year': `${userDetails.year}`,
          buildingNumber: `${userDetails.buildNum}`,
          buildingName: userDetails.buildName,
          street: userDetails.street,
          townCity: userDetails.city,
          postCode: userDetails.postCode,
          validFromDay: '26',
          validFromMonth: '02',
          validFromYear: '2021',
          validUntilDay: '',
          validUntilMonth: '',
          validUntilYear: '',
          'SecondaryUKAddress.buildingNumber': '',
          'SecondaryUKAddress.buildingName': '',
          'SecondaryUKAddress.street': '',
          'SecondaryUKAddress.townCity': '',
          'SecondaryUKAddress.postCode': '',
          'SecondaryUKAddress.validFromDay': '',
          'SecondaryUKAddress.validFromMonth': '',
          'SecondaryUKAddress.validFromYear': '',
          'SecondaryUKAddress.validUntilDay': '',
          'SecondaryUKAddress.validUntilMonth': '',
          'SecondaryUKAddress.validUntilYear': ''
        },
        {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          tags: { name: 'B01_Fraud_01_CoreStubEditUserContinue' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('We need to check your details')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group('B01_Fraud_02_ContinueToCheckFraudDetails POST', function () {
    const startTime1 = Date.now()
    res = http.post(
      env.fraudEndPoint + '/check',
      {
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        redirects: 1,
        tags: { name: 'B01_Fraud_02_ContinueToCheckFraudDetails1' }
      }
    )
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_Fraud_02_ContinueToCheckFraudDetails2' }
      }
    )
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}

export function drivingScenario(): void {
  let res: Response
  let csrfToken: string
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  group('B02_Driving_01_CoreStubEditUserContinue GET',
  function(){
    const startTime=Date.now()
    res=http.get(env.ipvCoreStub+
      "authorize?cri=driving-licence-cri-build&rowNumber=5")

    const endTime=Date.now();

    check(res,{
      "is status 302": (r) => r.status === 302,
      "verify page content": (r) => (r.body as string).includes('Who was your UK driving licence issued by?')
    })
      ? transactionDuration.add(endTime-startTime)
      : fail('Response Validation Failed')
      csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_Driving_02_SelectingOption_POST', function(){
    

    switch(optionLicence){

      case "DLVA":
      
          const startTime2=Date.now();
            res=http.post(env.fraudEndPoint +"/licence-issuer",
            {
          
              licenceIssuerRadio: 'DVLA',
              submitButton: '',
              'x-csrf-token': csrfToken

      })
      const endTime2=Date.now();

      check(res,{
        'is status 302': (r) => r.status === 302
      })
        ?transactionDuration.add(endTime2-startTime2)
        :fail("Response Validation Failed")

        break;
      case "DVA":
        const startTime3=Date.now();
        res=http.post(env.fraudEndPoint +"/licence-issuer",
        {
      
          licenceIssuerRadio: 'DVA',
          submitButton: '',
          'x-csrf-token': csrfToken

  })
  const endTime3=Date.now();
      check(res,{
       'is status 302': (r) => r.status === 302
  })
       ?transactionDuration.add(endTime3-startTime3)
       :fail("Response Vaildation Failed")

        break;
      default:
       console.log("Wrong option used");
  
    }

  } )

  sleep(Math.random() * 3)

  group('B02_Driving_03_EditUser POST', function(){

    switch(optionLicence){
      case "DLVA":
        
        const startTime4=Date.now()
          res=http.post(env.fraudEndPoint+"/details",{

            surname: '',
            firstName: '',
            middleNames: '',
            'dateOfBirth-day': '',
            'dateOfBirth-month': '',
            'dateOfBirth-year':  '',
            dvlaDependent: '',
            'issueDate-day': '',
            'issueDate-month': '',
            'issueDate-year': '',
            'expiryDate-day': '',
            'expiryDate-month': '',
            'expiryDate-year':  '',
            drivingLicenceNumber: '',
            issueNumber: '',
            postcode:'',
            continue:'',
            'x-csrf-token': ''

          })
      const endTime4=Date.now()
      
      check(res,{
        'is status 302': (r) => r.status === 302,
        'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
      })
        ?transactionDuration.add(endTime4-startTime4)
        :fail("Response Validation Failed")
        break;

      case "DVA":

        const startTime5=Date.now()
        res=http.post(env.fraudEndPoint+"/details",{

          surname: '',
          firstName: '',
          middleNames: '',
          'dateOfBirth-day': '',
          'dateOfBirth-month': '',
          'dateOfBirth-year':  '',
          dvaDependent: '',
          'dateOfissue-day': '',
          'dateOfissue-month': '',
          'dateOfissue-year': '',
          'expiryDate-day': '',
          'expiryDate-month': '',
          'expiryDate-year':  '',
          dvaLicenceNumber: '',
          issueNumber: '',
          postcode:'',
          continue:'',
          'x-csrf-token': ''

        })
    const endTime5=Date.now()
    
    check(res,{
      'is status 302': (r) => r.status === 302,
      'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
    })
      ?transactionDuration.add(endTime5-startTime5)
      :fail("Response Validation Failed")
      break;

    }
  })

}

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
}

interface User {
  firstName: string
  lastName: string
  day: number
  month: number
  year: number
  buildNum: number
  buildName: string
  street: string
  city: string
  postCode: string
}

function getUserDetails (): User {
  return {
    firstName: `perfFirst${Math.floor(Math.random() * 99998) + 1}`,
    lastName: `perfLast${Math.floor(Math.random() * 99998) + 1}`,
    day: Math.floor(Math.random() * 29) + 1,
    month: Math.floor(Math.random() * 12) + 1,
    year: Math.floor(Math.random() * 71) + 1950,
    buildNum: Math.floor(Math.random() * 999) + 1,
    buildName: `RandomBuilding${Math.floor(Math.random() * 99998) + 1}`,
    street: `RandomStreet${Math.floor(Math.random() * 99998) + 1}`,
    city: `RandomCity${Math.floor(Math.random() * 999) + 1}`,
    postCode: `AB${Math.floor(Math.random() * 99) + 1} CD${Math.floor(Math.random() * 99) + 1}`
  }
}
