import http from 'k6/http';
import { group } from 'k6';
import { buildFrontendUrl } from '../utils/url';
import { validatePageRedirect, validateLocationHeader, validateQueryParam } from '../utils/assertions';
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client';
import { timeRequest } from '../../common/utils/request/timing';
import {
  isStatusCode200,
  isStatusCode201,
  isStatusCode302,
  pageContentCheck
} from '../../common/utils/checks/assertions';

export function getSessionIdFromCookieJar(): string {
  const jar = http.cookieJar();
  return jar.cookiesForURL(buildFrontendUrl('')).sessionId.toString();
}

export function startJourney(): void {
  const testClientRes = group('POST test client /start', () =>
    timeRequest(() => postTestClientStart(), { isStatusCode201 })
  );
  const authorizeUrl = parseTestClientResponse(testClientRes, 'WebLocation');

  group('GET /authorize', () =>
    timeRequest(
      () =>
        http.get(authorizeUrl, {
          tags: { name: 'GET /authorize' }
        }),
      {
        isStatusCode200,
        ...validatePageRedirect('/selectDevice'),
        ...pageContentCheck('Are you on a computer or a tablet right now?')
      }
    )
  );
}

export function postSelectDevice(): void {
  group('POST /selectDevice', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/selectDevice'),
          { 'select-device-choice': 'smartphone' },
          { tags: { name: 'POST /selectDevice' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/selectSmartphone'),
        ...pageContentCheck('Which smartphone are you using?')
      }
    )
  );
}

export function postSelectSmartphone(): void {
  group('POST /selectSmartphone', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/selectSmartphone'),
          { 'smartphone-choice': 'iphone' },
          { tags: { name: 'POST /selectSmartphone' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/validPassport'),
        ...pageContentCheck('Do you have a valid passport?')
      }
    )
  );
}

export function postValidPassport(): void {
  group('POST /validPassport', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/validPassport'),
          { 'select-option': 'yes' },
          { tags: { name: 'POST /validPassport' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/biometricChip'),
        ...pageContentCheck('Does your passport have this symbol on the cover?')
      }
    )
  );
}

export function postBiometricChip(): void {
  group('POST /biometricChip', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/biometricChip'),
          { 'select-option': 'yes' },
          { tags: { name: 'POST /biometricChip' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/iphoneModel'),
        ...pageContentCheck('Which iPhone model do you have?')
      }
    )
  );
}

export function postIphoneModel(): void {
  group('POST /iphoneModel', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/iphoneModel'),
          { 'select-option': 'iphone7OrNewer' },
          { tags: { name: 'POST /iphoneModel' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/idCheckApp'),
        ...pageContentCheck('Use your passport and a GOV.UK app to confirm your identity')
      }
    )
  );
}

export function postIdCheckApp(): void {
  group('POST /idCheckApp', () =>
    timeRequest(() => http.post(buildFrontendUrl('/idCheckApp'), {}, { tags: { name: 'POST /idCheckApp' } }), {
      isStatusCode200,
      ...validatePageRedirect('/workingCamera'),
      ...pageContentCheck('Does your smartphone have a working camera?')
    })
  );
}

export function postWorkingCamera(): void {
  group('POST /workingCamera', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/workingCamera'),
          { 'working-camera-choice': 'yes' },
          { tags: { name: 'POST /workingCamera' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/flashingWarning'),
        ...pageContentCheck('The app uses flashing colours. Do you want to continue?')
      }
    )
  );
}

export function postFlashingWarning(): void {
  group('POST /flashingWarning', () =>
    timeRequest(
      () =>
        http.post(
          buildFrontendUrl('/flashingWarning'),
          { 'flashing-colours-choice': 'yes' },
          { tags: { name: 'POST /flashingWarning' } }
        ),
      {
        isStatusCode200,
        ...validatePageRedirect('/downloadApp'),
        ...pageContentCheck('Download the GOV.UK ID Check app')
      }
    )
  );
}

export function getRedirect(): void {
  group('GET /redirect', () => {
    const redirectUrl = buildFrontendUrl('/redirect', {
      sessionId: getSessionIdFromCookieJar()
    });

    timeRequest(
      () =>
        http.get(redirectUrl, {
          redirects: 0,
          tags: { name: 'GET /redirect' }
        }),
      {
        isStatusCode302,
        validateLocationHeader,
        ...validateQueryParam('code')
      }
    );
  });
}

export function getAbortCommand(): void {
  group('GET /abortCommand', () => {
    const abortCommandUrl = buildFrontendUrl('/abortCommand', {
      sessionId: getSessionIdFromCookieJar()
    });

    timeRequest(
      () =>
        http.get(abortCommandUrl, {
          redirects: 0,
          tags: { name: 'GET /abortCommand' }
        }),
      {
        isStatusCode302,
        validateLocationHeader,
        ...validateQueryParam('error')
      }
    );
  });
}
