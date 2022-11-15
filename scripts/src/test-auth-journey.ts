import { sleep, group, check } from 'k6';
import { Options, Scenario } from 'k6/options';
import http, { Response } from 'k6/http';
import TOTP from './utils/totp';

// export let options: Options = {
//     // scenarios: {
//     //     sign_up: {
//     //         executor: 'ramping-arrival-rate',
//     //         startRate: 1,
//     //         timeUnit: '1m',
//     //         preAllocatedVUs: 1,
//     //         maxVUs: 1000,
//     //         stages: [
//     //             { target: 1800, duration: '10m' },    //Ramps up to target load
//     //             { target: 1800, duration: '30s' },    //Holds at target load
//     //         ],
//     //     },
//     // },
//     scenarios: {
//         sign_up: {
//             executor: 'ramping-arrival-rate',
//             startRate: 1,
//             timeUnit: '15s',
//             preAllocatedVUs: 1,
//             maxVUs: 1,
//             stages: [
//                 { target: 1, duration: '20s' },    //Ramps up to target load
//             ],
//             exec: 'sign_up'
//         },
//         sign_in: {
//             executor: 'ramping-arrival-rate',
//             startRate: 1,
//             timeUnit: '5s',
//             preAllocatedVUs: 1,
//             maxVUs: 1,
//             stages: [
//                 { target: 1, duration: '10s' },    //Ramps up to target load
//             ],
//             exec: 'sign_in'
//         },
//     }
//     // stages: [
//     //     { target: 1, duration: '10s' },
//     // ]
// };

const allScenarios: {[name: string]: Scenario} = {
    sign_up: {
        executor: 'ramping-arrival-rate',
        startRate: 1,
        timeUnit: '15s',
        preAllocatedVUs: 1,
        maxVUs: 5,
        stages: [
            { target: 1, duration: '20s' },    //Ramps up to target load
        ],
        exec: 'sign_up'
    },
    sign_in: {
        executor: 'ramping-arrival-rate',
        startRate: 1,
        timeUnit: '5s',
        preAllocatedVUs: 1,
        maxVUs: 5,
        stages: [
            { target: 1, duration: '60s' },    //Ramps up to target load
        ],
        exec: 'sign_in'
    },
}

// Scenarios specified in --env SCENARIO flag (e.g. --env SCENARIO=sign_in,sign_up)
// Are added to the executed scenarios, otherwise all scenarios are run
let enabledScenarios: {[name: string]: Scenario} = {};
if (__ENV.SCENARIO == null) {
    enabledScenarios = allScenarios;
}
else {
    __ENV.SCENARIO.split(',').forEach(scenario => enabledScenarios[scenario] = allScenarios[scenario]);
}

export let options: Options = {
    scenarios: enabledScenarios,
};

export const environments = {
    staging: {
        rpStub: 'https://di-auth-stub-relying-party-staging.london.cloudapps.digital',
        baseUrl: 'https://signin.staging.account.gov.uk'
    }
};

export function sign_up() {
    let res: Response;
    let env = environments['staging'];
    let csrfToken: string;
    let testEmail = `thomas.dann+staging${(Math.random() * 1000).toString()}.test@digital.cabinet-office.gov.uk`;
    let password = 'passw0rdA1';
    let secretKey: string;
    let totp: TOTP;
    let emailOtp = '804765';
    console.log(testEmail);


    group('GET - {RP Stub}', function () {
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

    group('POST - {RP Stub} /oidc/auth', () => {
        res = http.post(env.rpStub + '/oidc/auth',
            {
                'scopes-email': 'email',
                'scopes-phone': 'phone',
                '2fa': 'Cl.Cm',
                loc: '',
                'claims-core-identity': 'https://vocab.account.gov.uk/v1/coreIdentityJWT',
                'claims-passport': 'https://vocab.account.gov.uk/v1/passport',
                'claims-address': 'https://vocab.account.gov.uk/v1/address',
                lng: '',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Create a GOV.UK account or sign in'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /sign-in-or-create', () => {
        res = http.post(env.baseUrl + '/sign-in-or-create',
            {
                _csrf: csrfToken,
                supportInternationalNumbers: '',
                optionSelected: 'create',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Enter your email address'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /enter-email-create', () => {
        res = http.post(env.baseUrl + '/enter-email-create',
            {
                _csrf: csrfToken,
                email: testEmail,
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Check your email'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /check-your-email', () => {
        res = http.post(env.baseUrl + '/check-your-email',
            {
                _csrf: csrfToken,
                email: testEmail,
                code: emailOtp,
            }
        );

        console.log(res.status);

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Create your password'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /create-password', () => {
        res = http.post(env.baseUrl + '/create-password',
            {
                _csrf: csrfToken,
                password: password,
                'confirm-password': password,
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Choose how to get security codes'),
        });

        csrfToken = getCSRF(res);
    });
    
    sleep(1);

    group('POST - /get-security-codes', () => {
        res = http.post(env.baseUrl + '/get-security-codes',
            {
                _csrf: csrfToken,
                isAccountPartCreated: 'false',
                mfaOptions: 'AUTH_APP',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Set up an authenticator app'),
        });

        secretKey = res.html().find("input[name='_secretKey']").val() || '';
        totp = new TOTP(secretKey);
        csrfToken = getCSRF(res);
    });
    
    sleep(1);

    group('POST - /setup-authenticator-app', () => {
        res = http.post(env.baseUrl + '/setup-authenticator-app',
            {
                _csrf: csrfToken,
                _secretKey: secretKey,
                code: totp.generateTOTP(),
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes("You've created your GOV.UK account"),
        });

        csrfToken = getCSRF(res);
    });
    
    sleep(1);

    group('POST - /account-created', () => {
        res = http.post(env.baseUrl + '/account-created',
            {
                _csrf: csrfToken,
                phoneNumber: '',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('User information'),
        });
    });
    
    // 25% of users logout
    if (Math.random() <= 0.25) {
        sleep(1);

        group('POST - {RP Stub} /logout', () => {
            res = http.post(env.rpStub + '/logout',
                {
                    logout: '',
                }
            );

            check(res, {
                'is status 200': r => r.status === 200,
                'verify page content': r => (r.body as String).includes('Successfully signed out'),
            });
        });
    };
};

export function sign_in() {
    let res: Response;
    let env = environments['staging'];
    let csrfToken: string;
    let testEmail = `thomas.dann+staging2@digital.cabinet-office.gov.uk`;
    let password = 'ecEwK8BgbU3miwM';
    let secretKey = 'FWDDAAWOXKUQCDH5QMSPHAGJXMTXFZRZAKFTR6Y3Q5YRN5EVOYRQ';
    let totp = new TOTP(secretKey);

    group('GET - {RP Stub}', function () {
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

    group('POST - {RP Stub} /oidc/auth', () => {
        res = http.post(env.rpStub + '/oidc/auth',
            {
                'scopes-email': 'email',
                'scopes-phone': 'phone',
                '2fa': 'Cl.Cm',
                loc: '',
                'claims-core-identity': 'https://vocab.account.gov.uk/v1/coreIdentityJWT',
                'claims-passport': 'https://vocab.account.gov.uk/v1/passport',
                'claims-address': 'https://vocab.account.gov.uk/v1/address',
                lng: '',
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Create a GOV.UK account or sign in'),
        });
    });

    sleep(1);

    group('GET - /sign-in-or-create', function () {
        res = http.get(env.baseUrl + '/sign-in-or-create?redirectPost=true');

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Enter your email address to sign in to your GOV.UK account'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /enter-email', () => {
        res = http.post(env.baseUrl + '/enter-email',
            {
                _csrf: csrfToken,
                email: testEmail,
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Enter your password'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /enter-password', () => {
        res = http.post(env.baseUrl + '/enter-password',
            {
                _csrf: csrfToken,
                password: password,
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Enter the 6 digit security code shown in your authenticator app'),
        });

        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /enter-authenticator-app-code', () => {
        res = http.post(env.baseUrl + '/enter-authenticator-app-code',
            {
                _csrf: csrfToken,
                code: totp.generateTOTP(),
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('User information'),
        });

        csrfToken = getCSRF(res);
    });

    // 25% of users logout
    if (Math.random() <= 0.25) {
        sleep(1);

        group('POST - {RP Stub} /logout', () => {
            res = http.post(env.rpStub + '/logout',
                {
                    logout: '',
                }
            );

            check(res, {
                'is status 200': r => r.status === 200,
                'verify page content': r => (r.body as String).includes('Successfully signed out'),
            });
        });
    };
}

function getCSRF(r: Response): string {
    return r.html().find("input[name='_csrf']").val() || '';
}

