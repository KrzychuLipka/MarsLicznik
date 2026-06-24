import http from 'k6/http';
import { check } from 'k6';

export let options = {
    vus: 1,        // virtual users
    duration: '10s',
};

export default function() {
    let response = http.get('http://0.0.0.0:5000/trajectory');
    check(response, {
        'status 200': (r) => r.status === 200,
        'czas < 200ms': (r) => r.timings.duration < 200,
    });
}