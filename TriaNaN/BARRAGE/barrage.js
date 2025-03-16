/*==============================================================================
  FILE:     BARRAGE/barrage.js
  AUTHOR:   TriaNaN
  DESCRIPTION:
    test servers:
      n00dles    (4GB)
      CSEC       (8GB)
      foodnstuff (16GB)
      iron-gym   (32GB)
*/

//------------------------------------------------------------------------------
// CONSTANTS:

// Return codes and runtime constraints for 'main'
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// Different types of messages to be passed to logging function:
const MSG_TYPE = {
  error    : "*ERROR* ",
  warning  : "*WARNING* ",
  success  : "*SUCCESS* ",
  info     : "*INFO* "
}

// Filepaths to each batch script:
const HACK_SCRIPT = "/BARRAGE/hack.js";
const WEAK_SCRIPT = "/BARRAGE/weaken.js";
const GROW_SCRIPT = "/BARRAGE/grow.js";

//------------------------------------------------------------------------------
// MAIN:

/** @param {NS} ns */
export async function main(ns) {

  // Quick n' dirty logging function:
  const log = (msg, type="") => {
    const fullMsg = type + msg;
    /*ns.tprintf(fullMsg);*/ ns.printf(fullMsg);
    return fullMsg;
  }

  // Get and verify hostname argument as target:
  const target = ns.args.length > 0 ? ns.args[0] : undefined;
  if (!target) {
    log(`No hostnames provided as arguments. Terminating...`, MSG_TYPE.error);
    return EXIT_FAILURE
  };

  const serverMaxFunds        = ns.getServerMaxMoney(target);
  const serverMinSecurity     = ns.getServerMinSecurityLevel(target);
  const scheduler = new BatchScheduler(ns, log, target, HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT);
  while (true) {
    let   serverCurrentFunds    = ns.getServerMoneyAvailable(target);
    let   serverCurrentSecurity = ns.getServerSecurityLevel(target);
    
    if ( // Server not at max money or min security (or both): grow-weaken
      serverCurrentFunds < serverMaxFunds ||
      serverCurrentSecurity  > serverMinSecurity
    ) {
      log("\n*GROW-WEAKEN BATCH*");
      await scheduler.execBatch(scheduler.scripts.growScript);
    }
    else { // Run a hack-weaken batch:
      ns.toast(`BARRAGE: ${target} is at maximum funds and minimum security.`, "success");
      log("\n*HACK-WEAKEN BATCH*");
      await scheduler.execBatch(scheduler.scripts.hackScript);
    }

    log(
        `\tSecurity (${serverCurrentSecurity} (min: ${serverMinSecurity}))` +
        `\tFunds \$${serverCurrentFunds} available / \$${serverMaxFunds} maximum funds)`
    );
  }
ns.exec

  //return EXIT_SUCCESS;
}

//------------------------------------------------------------------------------
// CLASSES:

/*
  CLASS: Script
  DESCRIPTION:
    Representation of a script and associated metainfo located on the attacking
    (this) server.
*/
class Script {
  #ns;

  // Constructor:
  constructor(ns, path) {
    this.#ns = ns;
    if (ns.fileExists(path)) {
      this.path = path;
      this.requiredRAM = ns.getScriptRam(path);
    }
    else {
      log(`could not instantiate Script with path: ${path}, file doesn't exist`, MSG_TYPE.warning);
      this.path        = undefined;
      this.requiredRAM = undefined;
    }
  }

  // Returns execution time in milliseconds:
  getExecTime(target) {
    switch (this.path) {
      case HACK_SCRIPT:
        return this.#ns.getHackTime(target);
      case GROW_SCRIPT:
        return this.#ns.getGrowTime(target);
      case WEAK_SCRIPT:
        return this.#ns.getWeakenTime(target);
      default:
        return undefined;
    }
  }

  // Executes script on target server with specified threads, returns PID:
  execute(target, threads) {
    return  this.#ns.exec(this.path, target, threads, target);
  }
}

/*
  CLASS: BatchScheduler
  DESCRIPTION:
    Representation of batch-scheduler located on attacking server.
*/
class BatchScheduler {
  #ns;        // Reference to NetScript APIs
  #localhost; // Local hostname
  #tdu;       // Delay between batch scripts finishing so they end in predictable order (milliseconds).
  #log;

  /*
    METHOD:      BatchScheduler (constructor)
    DESCRIPTION:
      Instantiates a BatchScheduler object with a target server hostname,
      filepaths to script-files to be run in batches, and methods for
      executing different types of batches on a target server.
  */
  constructor(ns, logger, target, hackFile, growFile, weakFile, tailDelayUnit=100) {
    this.#ns        = ns;
    this.#localhost = ns.getHostname();
    this.#tdu       = tailDelayUnit;
    this.#log       = logger; // Function used for logging runtime data

    // Target server to schedule batch jobs on:
    const targetExists = ns.serverExists(target);
    this.target = {
      hostname: targetExists ? target : undefined,
      maxRAM:   targetExists ? ns.getServerMaxRam(target) : undefined
    }

    // Local scripts to be copied (if needed) and executed on target:
    this.scripts = {
      hackScript: new Script(ns, hackFile),
      growScript: new Script(ns, growFile),
      weakScript: new Script(ns, weakFile)
    }
    // Debug Logging:
    logger(
      `BatchScheduler instantiated on ${this.#localhost}:` +
      `\n\tTDU: ${this.#tdu}ms` +
      `\n\tTarget: ${this.target.hostname} (${this.target.maxRAM}GB)` +
      `\n\tScripts:` +
      `\n\t\t${this.scripts.hackScript.path} (${this.scripts.hackScript.requiredRAM}GB)` +
      `\n\t\t${this.scripts.growScript.path} (${this.scripts.growScript.requiredRAM}GB)` +
      `\n\t\t${this.scripts.weakScript.path} (${this.scripts.weakScript.requiredRAM}GB)`
    );
  }

  /*
    METHOD: calculateThreads
    DESCRIPTION:
      Allocate number of threads to allocate for instances of a security-raising script
      and a weakening script to maximize RAM use and offset security costs, and therefore
      profit on the target
  */
  calculateThreads(fundScript) {
    // Verify fundScript is either the hack script or grow script:
    let fundAnalyzeSecurity;
    if (fundScript.path == HACK_SCRIPT) {
      fundAnalyzeSecurity = this.#ns.hackAnalyzeSecurity;
    }
    else if (fundScript.path == GROW_SCRIPT) {
      fundAnalyzeSecurity = this.#ns.growthAnalyzeSecurity;
    }
    else {
      log(`Invalid script passed to thread calculator: ${script.path}`, MSG_TYPE.error);
      return undefined;
    }

    // Object representing allocations to be returned:
    let threadAllocation = {
      fundThreads: 0,
      weakThreads: 0,
      totalRAM: 0.0
    }

    // Defining starting threads for fund-influencing and weakening scripts respectively:
    const maxFundThreads = Math.floor(
      (this.target.maxRAM / fundScript.requiredRAM) - 1 // Allows for at least 1 thread of weaken
    );
    threadAllocation.fundThreads = maxFundThreads;
    threadAllocation.weakThreads = 1;
    let securityIncrease = fundAnalyzeSecurity(maxFundThreads);
    let securityDecrease = this.#ns.weakenAnalyze(threadAllocation.weakThreads);
    this.#log(`Minimum weak threads: ${threadAllocation.weakThreads} (security -${securityDecrease})`);
    this.#log(`Maximum fund threads: ${threadAllocation.fundThreads} (security +${securityIncrease})`);

    // Calculate minimum weakening threads to offset security increase from fund threads:
    let calcCount = 0;
    while (securityDecrease < securityIncrease) {
      // Add another thread for weakening and remove for fund; calculate new security changes:
      threadAllocation.weakThreads++;
      threadAllocation.fundThreads--;
      securityDecrease = this.#ns.weakenAnalyze(threadAllocation.weakThreads);
      securityIncrease = fundAnalyzeSecurity(threadAllocation.fundThreads);
      calcCount++; // For tracking calculation-cycle iteration
      this.#log(
        `Thread Calculation ${calcCount}:` +
        `\n\tWeak threads: ${threadAllocation.weakThreads} (security -${securityDecrease})` +
        `\n\Fund threads: ${threadAllocation.fundThreads} (security +${securityIncrease})`
        );
    }

    // Debug logging:
    this.#log(
      `Final Thread Calculation:` +
      `\n\tWeak: ${threadAllocation.weakThreads} (security -${securityDecrease})` +
      `\n\tFund: ${threadAllocation.fundThreads} (security +${securityIncrease})`
      , MSG_TYPE.info
    );
    
    // Sum total RAM required for calculated thread allocation:
    threadAllocation.totalRAM = fundScript.requiredRAM * threadAllocation.fundThreads +
                                this.scripts.weakScript.requiredRAM * threadAllocation.weakThreads;

    if (threadAllocation.totalRAM > this.target.maxRAM || threadAllocation.fundThreads < 1) {
      // Return undefined if allocated total RAM exceeds available RAM on target, or no fund threads could be allocated:
      this.#log(
        `\tNot enough RAM for batch (${threadAllocation.totalRAM}GB required, ` +
        `${threadAllocation.fundThreads} threads available for fund-influencing scripts)`,
        MSG_TYPE.warning
      );
      return undefined;
    }

    this.#log(`Total RAM for batch: ${threadAllocation.totalRAM}GB`, MSG_TYPE.success);
    return threadAllocation;
  }

  /*
    METHOD: execBatch
    DESCRIPTION:

      [------||||||||||||||||||||||||-] fund
      [|||||||||||||||||||||||||||||||] weaken
  */
  async execBatch(fundScript) {
    const threadAllocation = this.calculateThreads(fundScript);
    if (!threadAllocation) {
      this.#log(`Launching batch-job failed; invalid script provided: ${fundScript.path}`, MSG_TYPE.error);
      return false;
    }

    // fundDelay = timeWeaken - timeFund - tailUnitDelay
    const fundDelay = this.scripts.weakScript.getExecTime(this.target.hostname) - 
                      fundScript.getExecTime(this.target.hostname) - 
                      this.#tdu;
    // Since weaken-time is anchor time, it requires no delay.

    // Debug logging:
    this.#log(
      `Launching batch-job from ${this.#localhost} on ${this.target.hostname}...` +
      `\n\tRAM usage on target: ${threadAllocation.totalRAM}/${this.target.maxRAM}GB` +
      `\n\tFund-influencer: ${fundScript.path} (${threadAllocation.fundThreads} threads)` +
      `\n\tWeakener:        ${this.scripts.weakScript.path} (${threadAllocation.weakThreads} threads)` +
      `\n\tFund-influencer delay (milliseconds): ${fundDelay}` +
      `\n\tTail Delay Unit       (milliseconds): ${this.#tdu}`
    );

    // Launch batch:
    this.#log("Launching weakener script...", MSG_TYPE.info);
    const weakPID = this.scripts.weakScript.execute(this.target.hostname, threadAllocation.weakThreads);
    if (!weakPID) { return false; } // Failed to launch fund-influencing script
    this.#log(`\t\tWeakener launched on ${this.target} (PID: ${weakPID})`);

    // Wait before launching fund-influencing script so security increase is offset by weaken:
    await this.#ns.sleep(fundDelay);
    this.#log("Launching fund-influencer script...", MSG_TYPE.info);
    const fundPID = fundScript.execute(this.target.hostname, threadAllocation.fundThreads);
    if (!fundPID) { return false; } // Failed to launch grow script
    this.#log(`\t\tFund-influencer launched on ${this.target} (PID: ${fundPID})`);

    // Wait for weaken to finish:
    await this.#ns.sleep(this.scripts.weakScript.getExecTime(this.target.hostname) - fundDelay);
    this.#log(`Batch-job on ${this.target.hostname} completed.`, MSG_TYPE.success);
    return true;
  }

}