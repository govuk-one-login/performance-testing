import { sleep, group, check } from 'k6';
import { Options } from 'k6/options';
import http, { Response } from 'k6/http';

export let options: Options = {
    // scenarios: {
    //     mobile: {
    //         executor: 'ramping-arrival-rate',
    //         startRate: 1,
    //         timeUnit: '1h',
    //         preAllocatedVUs: 1,
    //         maxVUs: 50,
    //         stages: [
    //             { target: 783, duration: '1m30s' }, //Ramps up to target load
    //             { target: 783, duration: '30s' },   //Holds at target load
    //         ],
    //     },
    // },
    stages: [
        { target: 1, duration: '20s' },
    ]
};

export const environments = {
    staging: {
        rpStub: "https://di-auth-stub-relying-party-staging-app.london.cloudapps.digital",
        baseUrl: "https://www.review-b.staging.account.gov.uk/dca/oauth2"
    }
};

export default () => {
    let res: Response;
    let env = environments['staging'];

    group('GET - {Auth Stub}', function () {
        res = http.get(env.rpStub);

        const jar = http.cookieJar();
        const cookies = jar.cookiesForURL(env.rpStub);
        check(res, {
            "is status 200": r => r.status === 200,
            "has cookie 'JSESSIONID'": () => cookies.JSESSIONID.length > 0,
            "has cookie '__VCAP_ID__'": () => cookies.__VCAP_ID__.length > 0 && cookies.__VCAP_ID__[0].length === 28,
        });
    });

    sleep(1);

    group('POST - {Auth App Stub} /oidc/auth', () => {
        res = http.post(env.rpStub + '/oidc/auth', null);

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Are you on an iPhone and using the Safari web browser?'),
        });
    });

    sleep(1);

    group('POST - /simpleDevice', () => {
        res = http.post(env.baseUrl + '/simpleDevice',
            {
                'select-option': 'yes',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Do you have a valid UK photocard driving licence?'),
        });
    });

    sleep(1);

    group('POST - /validDrivingLicence', () => {
        res = http.post(env.baseUrl + '/validDrivingLicence',
            {
                'driving-licence-choice': 'yes',
            }
        )

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Using the ID Check App'),
        });
    });

    sleep(1);

    group('GET - /workingCamera', () => {
        res = http.get(env.baseUrl + '/workingCamera');

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Does your phone have a working camera?'),
        });
    });

    sleep(1);

    group('POST - /workingCamera', () => {
        res = http.post(env.baseUrl + '/workingCamera',
            {
                'working-camera-choice': 'yes',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('The app uses flashing colours'),
        });
    });

    sleep(1);

    group('POST - /flashingWarning', () => {
        res = http.post(env.baseUrl + '/flashingWarning',
            {
                'flashing-colours-choice': 'yes',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Using the GOV.UK ID Check app'),
        });
    });
};