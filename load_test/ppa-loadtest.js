import http from 'k6/http';
import { check, sleep } from 'k6';

const concurrency = __ENV.CONCURRENCY ? parseInt(__ENV.CONCURRENCY) : 10;
const endpoint = __ENV.ENDPOINT || 'http://localhost:8080/api/mixed-tasks';

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
console.log(res.body);
  check(res, {
  'status is 200': (r) => r.status === 200,
  'body contains CPU result': (r) => r.body.includes('CpuResults'),
  'body contains Api Status Codes': (r) => r.body.includes('ApiStatusCode'),
  'ApiStatusCodes value contains 5 elements all equal to 200': (r) => {
    try {
      const data = JSON.parse(r.body);
      return Array.isArray(data.ApiStatusCodes) &&
        data.ApiStatusCodes.length === 5 &&
        data.ApiStatusCodes.every((code) => code === 200);
    } catch (e) {
      return false;
    }
  },
  'CpuResults value contains 5 elements all equal to 55': (r) => {
    try {
      const data = JSON.parse(r.body);
      return Array.isArray(data.CpuResults) &&
        data.CpuResults.length === 5 &&
        data.CpuResults.every((result) => result === 55);
    } catch (e) {
      return false;
    }
  },
});

  sleep(1);
}