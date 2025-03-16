/*==============================================================================
  FILE:     NearQUAD/hack.js
  AUTHOR:   TriaNaN
  PARAM(S): targetHostname
  DESCRIPTION:
    Minimal hack script aimed at target server. Returns -1 if argument was
    not provided, otherwise it will return the amount of money hacked from
    the server (0 if the attempt failed).
*/

/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length != 1) {
    return -1; // Failed to run without required argument.
  }
  const targetHostname = ns.args[0];

  // Hack target and return amount of money gained:
  const  hackedMoney = await ns.hack(targetHostname);
  return hackedMoney;
}
//==============================================================================