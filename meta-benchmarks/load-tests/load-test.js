import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 50 }, // 50 users
    { duration: '1m', target: 100 }, // 100 users
  ],
};

export default function () {
  let res = http.get('http://local.etherealengine.org/location/default');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}

