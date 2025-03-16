/*
  FILE:        MISSIONARY.js
  AUTHOR:      TriaNaN
  USAGE:       "run MISSIONARY.js [-t] [n] payloadScript"
  DESCRIPTION: 
    Works through a giving network starting at a launching node,
    cracking each adjacent server it can before installing itself
    and the payload script to each adjacent server.

    It will execute the copy of this script on each target machine
    remotely, and will run the payload script locally to target
    each machine.
*/

// Global array property shared by all missionary instances:
var crackedHosts = [];

/*---------------------------------------------------------------------
  ### SCRIPT ENTRY-POINT / MAIN LOGIC ###
  
  DESCRIPTION:
    Verifies terminal argument, and verifies payload and worm files exist
    on local host. Then scans for adjacent servers and attempts to crack
    each one; if successful, the cracked hostname is added to the
    global 'crackedHosts' array
*/
/** @param {NS} ns */
export async function main(ns) {


  // Small logging utility function:
  const log = (msg) => {ns.tprint(msg); ns.print(msg)};


  // Verify payload argument exists:
  if (ns.args.length != 1) {
    log("Must supply payload filename as argument.");
    return;
  }


  // Name of local host, and filenames for required scripts:
  const localHost     = ns.getHostname();
  const wormScript    = ns.getScriptName();
  const payloadScript = ns.args[0];


  // Verify required scripts are present on local machine:
  var hasRequiredFiles = true;
  if (!ns.fileExists(wormScript)) {
    log(`worm script '${wormScript}' could not be found.`);
    hasRequiredFiles = false;
  }
  if (!ns.fileExists(payloadScript)) {
    log(`payload script '${payloadScript}' could not be found.`);
    hasRequiredFiles = false;
  }
  if (!hasRequiredFiles) return; // Quit if either are missing.


  // Get list of adjacent servers to which localHost can connect to:
  const remoteHosts = ns.scan(localHost);
  remoteHosts.forEach(
    host => {
      if ( // root access gained, or already has access and isnt in crackedHosts.
        getRootAccess(ns, host) || (
          ns.hasRootAccess(host) && !crackedHosts.includes(host)
        )
      ) {
        crackedHosts.push(host);
      }
    }
  );

  // Show all cracked hosts
  log(crackedHosts);





// Section used for calculating RAM costs of ns function calls within
// functions and objects defined outside of this scope.
ns.getServerNumPortsRequired
ns.hasRootAccess
ns.nuke
}
//---------------------------------------------------------------------



/*---------------------------------------------------------------------
  FUNCION: getRootAccess
  PARAM(S):
    ns:         reference to NetScript APIs
    targetHost: hostname of target server
  RETURNS:
    true if root access was successful; false otherwise.
  DESCRIPTION:
    Checks if the target host already has root
    access installed 
*/
function getRootAccess(ns, targetHost) {

  // Mapping of cracking program filename to associated function:
  const crackingTools = [
    ['BruteSSH.exe',  ns.brutessh ],
    ['FTPCrack.exe',  ns.ftpcrack ],
    ['relaySMTP.exe', ns.relaysmtp],
    ['HTTPWorm.exe',  ns.httpworm ],
    ['SQLInject.exe', ns.sqlinject]
  ];

  // Check if target host has already been rooted:
  if (
    crackedHosts.includes(targetHost) ||
    ns.hasRootAccess(targetHost)
  ) {
    log(`already have root access on '${targetHost}'`);
    return false;
  }

  // Open up number of required ports on target host:
  const portsRequired  = ns.getServerNumPortsRequired(targetHost);
  var   portsOpened    = 0;
  while (portsOpened < portsRequired) {
    if (fileExists(crackingTools[portsOpened][0])) {
      // Call each cracking tool up to number of ports required.
      log(`opening port on '${targetHost}' using '${crackingTools[portsOpened]}'`);
      crackingTools[portsOpened][1](targetHost);
      portsOpened++;
    }
    else {
      // Missing required program(s) for cracking this server:
      log(`program '${crackingTools[portsOpened]}' could not be found`);
      return false;
    }
  }

  // When opened number of ports is equal to required number,
  // the target can now be rooted:
  if (ns.nuke(targetHost)) {
    log(`root access gained on '${targetHost}'`);
    return true;
  }

  // Could not root target host:
  log(`failed to gain root access on '${targetHost}'`);
  return false;
}
//---------------------------------------------------------------------