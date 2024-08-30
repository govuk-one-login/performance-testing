import http from 'k6/http';

export class Imposter {
  public handler() {
    const url = 'https://26okyhxy99.execute-api.eu-west-2.amazonaws.com/build/individuals/authentication/authenticator/api/match';
    
    const body = JSON.stringify({
      firstName: 'Jim',
      lastName: 'Ferguson',
      dateOfBirth: '1970-01-01',
      nino: 'AA000003D',
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer goodToken',
      },
    };

    const response = http.post(url, body, params);

    return response;
  }
}