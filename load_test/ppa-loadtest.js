import http from 'k6/http';
import { check, sleep } from 'k6';

const concurrency = __ENV.CONCURRENCY ? parseInt(__ENV.CONCURRENCY) : 10;
const endpoint = __ENV.ENDPOINT || 'http://localhost:5036/api/mixed-tasks';

export let options = {
  stages: [
    { duration: '10s', target: concurrency },  
    { duration: '60s', target: concurrency },
    { duration: '10s', target: 0 }, 
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(endpoint);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body contains CPU result': (r) => r.body.includes('CpuResults'),
  });

  sleep(1);
}