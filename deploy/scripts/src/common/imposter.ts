import http from 'k6/http';

export class Imposter {
  public handler() {
    const url = 'https://privatevpceid';

    const body = JSON.stringify({
      'jsonbody'
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