import { sleep, group, check, fail } from 'k6';
import { Options } from 'k6/options';
import http, { Response } from 'k6/http';
import TOTP from './utils/authentication/totp';
import { selectProfile, ProfileList, describeProfile } from './utils/config/load-profiles';
import { SharedArray } from 'k6/data';
import execution from 'k6/execution';
import { Trend } from 'k6/metrics';

const profiles: ProfileList = {
    smoke: {
        sign_up: {
            executor: 'ramping-arrival-rate',
            startRate: 1,
            timeUnit: '5s',
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
    },
    stress: {
        sign_up: {
            executor: 'ramping-arrival-rate',
            startRate: 1,
            timeUnit: '60s',
            preAllocatedVUs: 1,
            maxVUs: 3000,
            stages: [
                { target: 6000, duration: '15m' },   // Ramps up to target load
            ],
            exec: 'sign_up'
        },
        sign_in: {
            executor: 'ramping-arrival-rate',
            startRate: 1,
            timeUnit: '60s',
            preAllocatedVUs: 1,
            maxVUs: 3000,
            stages: [
                { target: 6000, duration: '15m' },   // Ramps up to target load
            ],
            exec: 'sign_in'
        }
    }
}
let loadProfile = selectProfile(profiles);

export const options: Options = {
    scenarios: loadProfile.scenarios,
    thresholds: {
        http_req_duration: ['p(95)<1000'],  // 95th percntile response time <1000ms
        http_req_failed: ['rate<0.05'],     // Error rate <5%
    }
};

export function setup() {
    describeProfile(loadProfile);
};

type mfaType = "SMS" | "AUTH_APP";
type signInData = {
    email: string,
    mfaOption: mfaType,
};
const data_sign_in: signInData[] = new SharedArray("data", () => Array.from({ length: 10000 },
    (_, i) => {
        const id: string = Math.floor((i / 2) + 1).toString().padStart(5, '0');
        if (i % 2 == 0) return {
            email: `perftestAuth1_${id}@digital.cabinet-office.gov.uk`,
            mfaOption: "AUTH_APP" as mfaType,
        }
        else return {
            email: `perftestAuth2_${id}@digital.cabinet-office.gov.uk`,
            mfaOption: "SMS" as mfaType,
        }
    }
));
const env = {
    rpStub: __ENV.RP_STUB,
    baseUrl: __ENV.BASE_URL,
};
const credentials = {
    authAppKey: __ENV.AUTH_APP_KEY,
    password: __ENV.USER_PASSWORD,
    emailOTP: __ENV.EMAIL_OTP,
    phoneOTP: __ENV.PHONE_OTP,
};
const durations = new Trend("duration");

export function sign_up() {
    let res: Response;
    let csrfToken: string;
    const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, ''); // YYMMDDTHHmm
    const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0');
    const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`;
    const phoneNumber = '07700900000';
    let secretKey: string;
    let totp: TOTP;
    let mfaOption: mfaType = (Math.random() <= 0.5) ? "SMS" : "AUTH_APP";

    group('GET - {RP Stub}', function () {
        res = http.get(env.rpStub);
        const jar = http.cookieJar();
        const cookies = jar.cookiesForURL(env.rpStub);
        check(res, {
            "is status 200": r => r.status === 200,
            "has cookie 'JSESSIONID'": () => cookies.JSESSIONID.length > 0,
            "has cookie '__VCAP_ID__'": () => cookies.__VCAP_ID__.length > 0 && cookies.__VCAP_ID__[0].length === 28,
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
    });

    sleep(1);

    group('POST - {RP Stub} /oidc/auth', () => {
        res = http.post(env.rpStub + '/oidc/auth',
            {
                'scopes-email': 'email',
                'scopes-phone': 'phone',
                'prompt': 'none',
                '2fa': 'Cl.Cm',
                'loc': '',
                'claims-core-identity': 'https://vocab.account.gov.uk/v1/coreIdentityJWT',
                'claims-passport': 'https://vocab.account.gov.uk/v1/passport',
                'claims-address': 'https://vocab.account.gov.uk/v1/address',
                'lng': '',
            }
        );
        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Create a GOV.UK account or sign in'),
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /check-your-email', () => {
        res = http.post(env.baseUrl + '/check-your-email',
            {
                _csrf: csrfToken,
                email: testEmail.toLowerCase(),
                code: credentials.emailOTP,
            }
        );
        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Create your password'),
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
        csrfToken = getCSRF(res);
    });

    sleep(1);

    group('POST - /create-password', () => {
        res = http.post(env.baseUrl + '/create-password',
            {
                _csrf: csrfToken,
                password: credentials.password,
                'confirm-password': credentials.password,
            }
        );
        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Choose how to get security codes'),
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
        csrfToken = getCSRF(res);
    });

    sleep(1);

    switch (mfaOption) {    // Switch statement for either Auth App or SMS paths
        case "AUTH_APP": {
            group('POST - /get-security-codes', () => {
                res = http.post(env.baseUrl + '/get-security-codes',
                    {
                        _csrf: csrfToken,
                        isAccountPartCreated: 'false',
                        mfaOptions: mfaOption,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('Set up an authenticator app'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
                    'verify page content': r => (r.body as String).includes('You&#39;ve created your GOV.UK account'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });
            break;
        }
        case "SMS": {
            group('POST - /get-security-codes', () => {
                res = http.post(env.baseUrl + '/get-security-codes',
                    {
                        _csrf: csrfToken,
                        isAccountPartCreated: 'false',
                        mfaOptions: mfaOption,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('Enter your mobile phone number'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });

            sleep(1);

            let censoredPhoneNumber = '';
            group('POST - /enter-phone-number', () => {
                res = http.post(env.baseUrl + '/enter-phone-number',
                    {
                        _csrf: csrfToken,
                        supportInternationalNumbers: '',
                        isAccountPartCreated: 'false',
                        phoneNumber,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('Check your phone'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                censoredPhoneNumber = getPhoneNumber(res);
                csrfToken = getCSRF(res);
            });

            sleep(1);

            group('POST - /check-your-phone', () => {
                res = http.post(env.baseUrl + '/check-your-phone',
                    {
                        _csrf: csrfToken,
                        phoneNumber: censoredPhoneNumber,
                        code: credentials.phoneOTP,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('You&#39;ve created your GOV.UK account'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });
            break;
        }
    }

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
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
            }) ? durations.add(res.timings.duration) : fail("Checks failed");
        });
    };
};

export function sign_in() {
    let res: Response;
    let csrfToken: string;
    const userData = data_sign_in[execution.scenario.iterationInInstance % data_sign_in.length];

    group('GET - {RP Stub}', function () {
        res = http.get(env.rpStub);
        const jar = http.cookieJar();
        const cookies = jar.cookiesForURL(env.rpStub);
        check(res, {
            "is status 200": r => r.status === 200,
            "has cookie 'JSESSIONID'": () => cookies.JSESSIONID.length > 0,
            "has cookie '__VCAP_ID__'": () => cookies.__VCAP_ID__.length > 0 && cookies.__VCAP_ID__[0].length === 28,
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
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
                email: userData.email,
            }
        );
        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Enter your password'),
        }) ? durations.add(res.timings.duration) : fail("Checks failed");
        csrfToken = getCSRF(res);
    });

    sleep(1);

    switch (userData.mfaOption) {
        case "AUTH_APP": {
            group('POST - /enter-password', () => {
                res = http.post(env.baseUrl + '/enter-password',
                    {
                        _csrf: csrfToken,
                        password: credentials.password,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('Enter the 6 digit security code shown in your authenticator app'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });

            sleep(1);

            group('POST - /enter-authenticator-app-code', () => {
                let totp = new TOTP(credentials.authAppKey);
                res = http.post(env.baseUrl + '/enter-authenticator-app-code',
                    {
                        _csrf: csrfToken,
                        code: totp.generateTOTP(),
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('User information'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });
            break;
        }
        case "SMS": {
            let phoneNumber = '';
            group('POST - /enter-password', () => {
                res = http.post(env.baseUrl + '/enter-password',
                    {
                        _csrf: csrfToken,
                        password: credentials.password,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('Check your phone'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                phoneNumber = getPhoneNumber(res);
                csrfToken = getCSRF(res);
            });

            sleep(1);

            group('POST - /enter-code', () => {
                res = http.post(env.baseUrl + '/enter-code',
                    {
                        _csrf: csrfToken,
                        phoneNumber,
                        code: credentials.phoneOTP,
                    }
                );
                check(res, {
                    'is status 200': r => r.status === 200,
                    'verify page content': r => (r.body as String).includes('User information'),
                }) ? durations.add(res.timings.duration) : fail("Checks failed");
                csrfToken = getCSRF(res);
            });
            break;
        }
    }

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
            }) ? durations.add(res.timings.duration) : fail("Checks failed");
        });
    };
}

function getCSRF(r: Response): string {
    return r.html().find("input[name='_csrf']").val() || '';
}

function getPhoneNumber(r: Response): string {
    return r.html().find("input[name='phoneNumber']").val() || '';
}