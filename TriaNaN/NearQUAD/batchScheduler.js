/*==============================================================================
  FILE:     NearQUAD/batchScheduler.js
  AUTHOR:   TriaNaN
  PARAM(S): targetHostname
  DESCRIPTION:
    Coordinates the execution of hacking, weakening, and growing scripts
    as batch jobs on a target server, utilizing the maximum number of
    threads available. Repeatedly runs in HWGW-order cycles.
*/

//------------------------------------------------------------------------------
// CONSTANTS:

// Return codes and runtime constraints for 'main'
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const MIN_ARGS     = 1;

// Different types of messages to be passed to logging function:
const MSG_TYPE = {
  error    : "*ERROR* ",
  warning  : "*WARNING* ",
  success  : "*SUCCESS* ",
  info     : "*INFO* "
}

// Filepaths to each batch script:
const HACK_FILEPATH = "/NearQUAD/hack.js";
const WEAK_FILEPATH = "/NearQUAD/weaken.js";
const GROW_FILEPATH = "/NearQUAD/grow.js";


//------------------------------------------------------------------------------
// MAIN:

/** @param {NS} ns */
export async function main(ns) {

  // Quick n' dirty logging function:
  const log = (msg, type="") => {
    const fullMsg = type + msg;
    ns.tprint(fullMsg); ns.print(fullMsg);
    return fullMsg;
  }


  // Verify hostnames were provided as arguments:
  if (ns.args.length < MIN_ARGS) {
    log(`Must provide at least ${MIN_ARGS} hostname(s) as arguments`, MSG_TYPE.error);
    return EXIT_FAILURE;
  }


  // Test:
  const target = ns.args[0]; // Use 'foodnstuff' as test server

  // Calculating available threads on target server:
  const availableRAM = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);
  log(`Available RAM on ${target}: ${availableRAM}`);

  const scriptsRAM = ns.getScriptRam(HACK_FILEPATH) +
                     ns.getScriptRam(GROW_FILEPATH) +
                     ns.getScriptRam(WEAK_FILEPATH) * 2;
  log(`Total required RAM for batch-scripts: ${scriptsRAM}`);

  const scriptRAM = Math.ceil(scriptsRAM / 4);
  log(`Allocatable RAM per script: ${scriptRAM}`);

  const availableThreads = Math.floor(availableRAM / scriptRAM);
  log(`Total available threads for running scripts on ${target}: ${availableThreads}`);


  // Calculating distribution of threads between scripts:
  const securityDecrease = ns.weakenAnalyze(1); // Effect of weaken using a single thread.
  log(`Weaken effect (1 thread): -${securityDecrease} security`);

  const hackThreads  = 1;
  log(`Hack threads: ${hackThreads}`);

  const weak1Threads = Math.ceil(
    ns.hackAnalyzeSecurity(hackThreads, target) /
    securityDecrease
  );
  log(`Hack-Weaken threads: ${weak1Threads}`);

  /*const growThreads  = Math.ceil(ns.growthAnalyze(
    target, 1 + (ns.hackAnalyze(target) * hackThreads)
  ));*/
  const hackPercent = ns.hackAnalyze(target);
  const remainingMoneyPercent = 1 - (hackPercent * hackThreads);
  const growthMultiplier = 1 / remainingMoneyPercent;
  const growThreads = Math.ceil(ns.growthAnalyze(target, growthMultiplier));
  log(`Grow threads: ${growThreads}`);

  // Threads required for grow.js probably exceed server RAM; grow funds in batches:
  const growScriptRAM  = ns.getScriptRam(GROW_FILEPATH);
  const maxGrowThreads = Math.floor(availableRAM / growScriptRAM);
  let remainingGrowThreads = growThreads;
  let batchCount = 0;
  while (remainingGrowThreads > 0) {
    // Get amount of threads for this batch:
    const threadsThisBatch = Math.min(remainingGrowThreads, maxGrowThreads);
    remainingGrowThreads  -= threadsThisBatch; // pretend we ran grow.js with threadsThisBatch threads...
    batchCount++;
    log(`\tThreads for batch-${batchCount}: ${threadsThisBatch}`);
    await ns.sleep(1000);
  }

  // Threads of weaken.js required to offset security increase from grow.js
  const weak2Threads = Math.ceil(
    ns.growthAnalyzeSecurity(growThreads, target) /
    securityDecrease
  );
  log(`Grow-Weaken threads: ${weak2Threads}`);
  // \Test


  return EXIT_SUCCESS;
}


//==============================================================================