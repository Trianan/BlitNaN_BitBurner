


/** @param {NS} ns */
export async function main(ns) {
  const log = (msg) => {ns.tprint(msg); ns.print(msg)};
  if (ns.args.length != 1) {
    log("Must supply payload filename as argument.");
    return;
  }
  const payload = ns.args[0];
  const controller = ns.getScriptName();
  const localhost  = ns.getHostname();

  // Get list of connectable servers:
  const targets = ns.scan();
  var crackedTargets = [];

  // Spread this controller and payload script to each target and run controller:
  for (var target of targets) {
    // Gain root access on target:
    log(`cracking ${target}...`);
    crackServer(ns, target);
    if (ns.hasRootAccess(target)) {
      log(` - gained root access on ${target}.`);

      // Copy payload file and controller to target, then run controller on target:
      ns.scp([payload, controller], target);
      ns.exec(controller, target, undefined, payload);
      crackedTargets.push(target);
    }
    else {
      log(` - failed to get root access on ${target}.`);
    }
  }

  // Run payload on this server, aimed at cracked targets:
  ns.run(
    payload,
    Math.floor((ns.getServerMaxRam(localhost) - ns.getServerUsedRam(localhost)) / ns.getScriptRam(payload)),
    ...crackedTargets
  );


}
// >>>END<<<

function crackServer(ns, server) {
  if (!ns.hasRootAccess(server)) {
    var exploits = [ns.brutessh, ns.ftpcrack];
    for (var i = 0; i < ns.getServerNumPortsRequired(server); i++) {
      if (i = exploits.length) break;
      exploits[i](server);
    }
    ns.nuke(server);
  }
}