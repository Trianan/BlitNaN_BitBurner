/*---------------------------------------------------------------------
  FILE: REAPER.js
  AUTHOR: TriaNaN
  DESCRIPTION:
    Repeatedly weakens/grows/hacks all servers supplied as
    arguments when running the script in terminal.
*/

/** @param {NS} ns */
export async function main(ns) {
    ns.print("<-*-> R E A P E R <-*->");
    // Target servers are supplied as terminal arguments.
    if (ns.args.length < 1) {
      ns.tprint("usage: run REAPER.js server1 server2 server3 ...");
      return;
    }

    // Build list of servers to target for hacking:
    var targetServers = [];
    for (var hostName of ns.args) {
      ns.print(`Adding ${hostName} to targets...`)
      const targetServer = new TargetServer(ns, hostName);
      targetServers.push(targetServer);
    }


    // Infinite loop that continously hacks/grows/weakens the target servers
    while(true) {
      for (var server of targetServers) {
        ns.print(`Targetting ${server.hostName}:`);
        await server.reap();
        await ns.sleep(1000); // TODO: might not be needed since all fx in server are awaited.
      }
    }
}
//---------------------------------------------------------------------



/*---------------------------------------------------------------------
  CLASS: TargetServer
  DESCRIPTION:
    Representation of a server to target for hacking.
*/
class TargetServer {
  #ns;            // Reference to NetScript APIs.
  hostName;       // Host name of server.
  maxFunds;       // Maximum allowed monetary funds for server.
  minSecurityLvl; // Minimum allowed security level for server.

  /*-------------------------------------------------------------------
    METHOD: (constructor)
    DESCRIPTION:
      Instantiates a TargetServer with the provided hostname and
      a reference to the NetScript APIs. Automatically gets the
      allowed maximum funds and minimum security levels from
      the server and stores them as fields for later use.
  */
  constructor(ns, hostName) {
    this.#ns            = ns;
    this.hostName       = hostName;
    this.maxFunds       = ns.getServerMaxMoney(hostName);
    this.minSecurityLvl = ns.getServerMinSecurityLevel(hostName);
  }
  
  /*-------------------------------------------------------------------
    METHOD: reap
    DESCRIPTION:
      Gains root access to the target system. It will then attempt
      to hack the system if the server is at minimum security and
      maximum funds; otherwise it will weaken the target's security
      system or manipulate the target's funds to grow them accordingly.
      Note that these are executing locally, but targetting a different
      system that doesn't need the script running.
  */
  async reap() {

    if (this.#ns.getServerSecurityLevel(this.hostName) > this.minSecurityLvl) {
      // Weaken security level to minimum level:
      await this.#ns.weaken(this.hostName);
      this.#ns.print("\t*target fertilized*");
    }
    else if (this.#ns.getServerMoneyAvailable(this.hostName) <= this.maxFunds*0.01) { // %25 max money is minimum
      // Grow server funds if not at maximum:
      await this.#ns.grow(this.hostName);
      this.#ns.print("\t*target sown*");
    }
    else {
      // Hack this server:
      await this.#ns.hack(this.hostName, {stock: true});
      this.#ns.print("\t*target reaped*");
    }
  }
}
//---------------------------------------------------------------------
