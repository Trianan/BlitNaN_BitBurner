/*
  FILE: fundInflator.js
  AUTHOR: TriaNaN
  DESCRIPTION:
    Attempts to rapidly grow a server's funds as fast
    as possible without increasing security by using
    as many local threads as possible to target the system.
*/

const WEAK_SCRIPT = "/BARRAGE/weaken.js";
const GROW_SCRIPT = "/BARRAGE/grow.js";

/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args.length == 1 ? ns.args[0] : undefined;
  if (!target) { return false; }
  const batchPadding       = 100 // milliseconds
  const tailDelay          = 50  // milliseconds
  const localHost          = ns.getHostname();
  const localMaxRAM        = ns.getServerMaxRam(localHost);
  const serverMaxFunds     = ns.getServerMaxMoney(target);
  const serverCurrentFunds = ns.getServerMoneyAvailable(target);
  const growExecTime       = ns.getGrowTime(target);
  const weakExecTime       = ns.getWeakenTime(target);

  // Run while funds aren't at maximum:
  while (serverCurrentFunds < serverMaxFunds) {
    const localAvailableRAM     = localMaxRAM - ns.getServerUsedRam(localHost);
    const availableGrowThreads  = Math.floor(localAvailableRAM / ns.getScriptRam(GROW_SCRIPT)) ?? 1;

    // Run grow script with maximum available threads:
    ns.run(GROW_SCRIPT, availableGrowThreads, target);
    await ns.sleep(growExecTime + batchPadding);

    // If security has increased, weaken it:
    if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
      const weakThreads = Math.ceil(availableGrowThreads * 0.18);
      const growDelay   = weakExecTime - growExecTime - tailDelay;
      ns.run(WEAK_SCRIPT, weakThreads, target);
      await ns.sleep(growDelay);
      ns.run(GROW_SCRIPT, Math.ceil(availableGrowThreads - weakThreads), target);
      await ns.sleep(((weakExecTime - growDelay) + batchPadding));
    }
  }
}