// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for lib/xdot — top-level re-export.
 * Split across:
 *   xdot-parse.test.ts   — parseXDot, parseXDotColor, parseXDotF, parseXDotFOn
 *   xdot-serial.test.ts  — sprintXDot, jsonXDot, round-trip
 *   xdot-misc.test.ts    — statXDot, freeXDot, freeXDotColor, XDOT_PARSE_ERROR
 *
 * All expected values are derived from the C source at
 * ~/git/graphviz/lib/xdot/xdot.c and xdot.h.
 * Do NOT change assertions to match code output; fix the code instead.
 */

// This file intentionally left as an entry point; actual tests are in the
// three files above.  Import them so vitest picks them all up.
import "./xdot-parse.test.js";
import "./xdot-serial.test.js";
import "./xdot-misc.test.js";
