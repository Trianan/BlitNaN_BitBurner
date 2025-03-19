
// Supported stock manipulation operations:
const OPS = {
  GROW:   "grow",
  SHRINK: "shrink"
}

// Percentage of money available in target at which to stop shrink operation:
const MONEY_FLOOR_PERCENT      = 0.10; // 10%
// Perentage of max security at which to trigger launching weaken operations:
const SECURITY_CEILING_PERCENT = 1.10; // 110%

/** @param {NS} ns */
export async function main(ns) {

  // Logging function:
  const log = msg => { ns.printf(msg); ns.tprintf(msg); }


  // Get and verify terminal arguments:
  if (ns.args.length != 2) {
    log("Usage: > run stockManipulator.js [-t] [n] <target-hostname> <grow|shrink>");
    return;
  }

  // Get and verify target hostname:
  const target    = ns.serverExists(ns.args[0]) ? ns.args[0] : undefined;
  if (!target) {
    log(`Server '${ns.args[0]}' does not exist.`);
    return;
  }

  // Get and verify operation argument (dont really need):
  const operationArg = ns.args[1];
  if (!Object.values(OPS).includes(operationArg)) {
    log(`Unsupported operation '${operationArg}'`);
    return;
  }


  // Set operation and condition based on operation arg:
  const serverMaxMoney    = ns.getServerMaxMoney(target);
  const serverMinSecurity = ns.getServerMinSecurityLevel(target);
  let operation = undefined;
  let condition = undefined;

  if (operationArg == OPS.GROW) {
    operation = ns.grow;
    condition = () => {
      return ns.getServerMoneyAvailable(target) < serverMaxMoney;
    }
  }
  else if (operationArg == OPS.SHRINK) {
    operation = ns.hack;
    condition = () => {
      return ns.getServerMoneyAvailable(target) > serverMaxMoney * MONEY_FLOOR_PERCENT;
    }
  }

  if (!operation || !condition) {
    log(`Shouldn't have gotten here, but no operation or condition were assigned :(`);
    return;
  }


  // Repeatedly apply operation to target condition on target money reached:
  log(`Launching Stock-Manipulator to ${operationArg} ${target}'s stock price:`);
  while (condition()) {
    ns.printf(`\t${operationArg}ing ${target}...`);
    await operation(target, {stock: true});
    
    // Weaken target if needed:
    if (ns.getServerSecurityLevel(target) > serverMinSecurity * SECURITY_CEILING_PERCENT) {
      ns.printf(`\t\tWeakening ${target}'s security...`);
      await ns.weaken(target);
    }
  }
  log(`\tStock-Manipulator attack completed on ${target}.\n`);

}