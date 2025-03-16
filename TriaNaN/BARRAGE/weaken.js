/*==============================================================================
  FILE:     NearQUAD/weaken.js
  AUTHOR:   TriaNaN
  PARAM(S): targetHostname
  DESCRIPTION:
    Minimal weaken script aimed at target server. Returns -1 if argument was
    not provided, otherwise it will return the amount by which the security
    was decreased.
*/

/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 1) {
    return -1; // Failed to run without required argument.
  }
  const targetHostname = ns.args[0];

  // Weaken target and return amount security was reduced:
  const  securityReduction = await ns.weaken(targetHostname);
  return securityReduction;
}
//==============================================================================