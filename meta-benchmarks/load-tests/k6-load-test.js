import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 1000 },
    //{ duration: '2m', target: 1000 },
    //{ duration: '1m', target: 500 },
    //{ duration: '1m', target: 0 },
  ],
  insecureSkipTLSVerify: true,
};

export default function () {
  let res = http.get('http://local.etherealengine.org/location/default');  // ⬅️ Fix #1

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is not empty': (r) => (r.body || '').length > 0,       // ⬅️ Fix #2
  });

  sleep(1);
}

