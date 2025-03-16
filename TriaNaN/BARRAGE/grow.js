/*==============================================================================
  FILE:     NearQUAD/grow.js
  AUTHOR:   TriaNaN
  PARAM(S): targetHostname
  DESCRIPTION:
    Minimal grow script aimed at target server. Returns -1 if argument was
    not provided, otherwise it will return the multiplier applied to the
    target's existing funds.
*/

/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 1) {
    return -1; // Failed to run without required argument.
  }
  const targetHostname = ns.args[0];

  // Grow target's funds and return multiplier applied to funds:
  const  fundMultiplier = await ns.grow(targetHostname);
  return fundMultiplier;
}
//==============================================================================