import http from 'k6/http';
import { check, sleep } from 'k6';

const concurrency = 10; // number of virtual users

export let options = {
  stages: [
    { duration: '10s', target: concurrency },  
    { duration: '30s', target: concurrency },
    { duration: '10s', target: 0 }, 
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'],  // 95% of requests should be < 10s
    http_req_failed: ['rate<0.01'],      // < 1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:8090/api/mixed-tasks');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body contains CPU result': (r) => r.body.includes('CpuResults'),
  });

  sleep(1); // slight delay to simulate real usage
}
