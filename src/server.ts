// Learning demo for outbound-call detection (IC-75320).
// Each endpoint demonstrates exactly one detection scenario — see the bundle README.

import express from 'express';
import axios from 'axios';

const UPSTREAM = 'https://api.example.com';

// Wrapper helper placed ABOVE all routes on purpose: the kernel's textual
// attribution finds no preceding registration, so this call lands in the
// "unattributed" bucket. (Moved below the last route, it would be
// MISattributed to that route — see README for why that matters.)
async function fetchUpstream(path: string) {
    const response = await axios.get(`${UPSTREAM}${path}`);
    return response.data;
}

// Configured instance — the modal real-world pattern for shared clients.
const api = axios.create({ baseURL: UPSTREAM, timeout: 5000 });

const app = express();
app.use(express.json());

// 1. Negative control: an endpoint with no outbound call.
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 2. Happy path: member call with a literal URL.
app.get('/quote', async (req, res) => {
    const response = await axios.get('https://api.example.com/quote');
    res.json(response.data);
});

// 3. Second verb — method identity comes from the SCIP symbol (Axios#post()).
app.post('/orders', async (req, res) => {
    const response = await axios.post('https://api.example.com/orders', req.body);
    res.status(201).json(response.data);
});

// 4. Callable-default form — SCIP resolves the receiver, but there is no member
//    occurrence to classify; only the AST lane can confirm this is a call.
app.get('/flexible', async (req, res) => {
    const response = await axios({ method: 'get', url: 'https://api.example.com/anything' });
    res.json(response.data);
});

// 5. The builtin: fetch resolves under a PSEUDO-package (typescript lib /
//    @types/node), not "npm fetch" — the Iteration-2 match-keying wrinkle.
//    Deliberately NOT in the kernel registry yet.
app.get('/weather', async (req, res) => {
    const response = await fetch('https://api.weather.example.com/today');
    res.json(await response.json());
});

// 6. Instance client: does api.get still resolve to Axios#get()? (fresh datum)
app.get('/via-instance', async (req, res) => {
    const response = await api.get('/status');
    res.json(response.data);
});

// 7. The wrapper blind spot: the outbound call lives in fetchUpstream (top of
//    file), not in this handler — depth-1 detection sees nothing here.
app.get('/via-helper', async (req, res) => {
    const data = await fetchUpstream('/inventory');
    res.json(data);
});

// Scenarios 8-10 appended 8/11 (fetch needs NO import, so earlier scenario
// lines stay stable — the append-only exception to this bundle's freeze).

// 8. fetch inside a helper: the closure walk is client-agnostic for npm
//    clients (measured); this pins it for a descriptor-row builtin.
async function fetchToday() {
    const response = await fetch('https://api.weather.example.com/today');
    return response.json();
}
app.get('/weather-helper', async (req, res) => {
    res.json(await fetchToday());
});

// 9. Template URL on fetch: detection must fire with target unresolved
//    (same contract as axios templates — substitution blocks the literal).
app.get('/weather-template', async (req, res) => {
    const response = await fetch(`${UPSTREAM}/today`);
    res.json(await response.json());
});

// 10. Aliased builtin — the documented edge, measured: does `const f = fetch`
//     carry the fetch symbol at the ASSIGNMENT (a non-call reference), and is
//     the aliased CALL itself invisible (f resolves local)?
app.get('/weather-alias', async (req, res) => {
    const f = fetch;
    const response = await f('https://api.weather.example.com/today');
    res.json(await response.json());
});

// 11. Callable default, POSITIONAL url — a real axios API form (axios(url)),
//     and the one the spike never explicitly coded for: the URL should come
//     from the existing positional-argument scan, with no verb to report.
app.get('/callable-url', async (req, res) => {
    const response = await axios('https://api.example.com/callable');
    res.json(response.data);
});

// 12. Callable default, positional url + config — the verb lives in the
//     config object while the URL is positional, so both readers must fire on
//     the same call.
app.get('/callable-url-config', async (req, res) => {
    const response = await axios('https://api.example.com/callable-post', { method: 'post' });
    res.json(response.data);
});

// Import placed HERE, not at the top: `import` declarations hoist, so this
// keeps scenarios 1-12 on their documented lines (the bundle README indexes
// them by line; same reason grpc-demo uses inline requires).
import nodeFetch from 'node-fetch';

// 13. node-fetch (npm) beside the GLOBAL fetch scenarios above — the
//     discrimination test: both resolve to the same `fetch().` descriptor and
//     are told apart ONLY by package, so this endpoint must report
//     client=node-fetch while scenarios 8-10 keep reporting client=fetch.
//     The `.json()` on the next line is the noise guard: it is a method on a
//     node-fetch type (`Body#json().`) and must NOT become a second record —
//     that is the whole reason node-fetch rides a descriptor row rather than
//     a name-registry row.
app.get('/node-fetch', async (req, res) => {
    const response = await nodeFetch('https://api.example.com/nf');
    res.json(await response.json());
});

// 14. node-fetch with an options object. Documents that a descriptor-row
//     client reports method=fetch (the function name) rather than the HTTP
//     verb — same contract as the global-fetch rows, unlike axios's config
//     form where `method:` supplies the verb.
app.get('/node-fetch-post', async (req, res) => {
    const response = await nodeFetch('https://api.example.com/nf-post', {
        method: 'POST',
        body: JSON.stringify({ ok: true }),
    });
    res.json(await response.json());
});

app.listen(3000);
