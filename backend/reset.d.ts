// tpb-lms backend — ts-reset (Matt Pocock). Hardens built-in types:
// JSON.parse()/.json() → unknown, .filter(Boolean) narrows, Array.includes widens.
// Full import (all rules), included by backend/tsconfig.json.
import '@total-typescript/ts-reset';
