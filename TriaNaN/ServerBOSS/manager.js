/*==============================================================================
  FILE:     ServerBOSS/manager.js
  AUTHOR:   TriaNaN
  DESCRIPTION:
    Server management dashboard for all servers accessible by the
    host this script is currently running on (intended to be 'home')
*/

//------------------------------------------------------------------------------
// CONSTANTS:

const EXCLUDED_SERVERS = ['home', 'darkweb'];

// Different types of messages to be passed to logging function:
const MSG_TYPE = {
  error    : "*ERROR* ",
  warning  : "*WARNING* ",
  success  : "*SUCCESS* ",
  info     : "*INFO* "
}

const HRULE = '------------------------------------------------------------';


//------------------------------------------------------------------------------
// MAIN:

/** @param {NS} ns */
export async function main(ns) {

  // Quick n' dirty logging function:
  const log = (msg, type="") => {
    const fullMsg = type + msg;
    ns.tprintf(fullMsg); ns.printf(fullMsg);
    return fullMsg;
  }

  const dashboard = new ServerDashboard(ns, log);
  await dashboard.start();
  /*
  dashboard.discoverServers();
  dashboard.showServers();
  dashboard.showFiles();
  dashboard.showFiles(undefined, 'foodnstuff');
  dashboard.showFiles(undefined, 'n00dles');
  dashboard.showFiles('.js');
  */
}

//------------------------------------------------------------------------------
// CLASSES:

/*
  CLASS: ServerDashboard
  DESCRIPTION:
    Representation of a dashboard for managing all connected servers; including
    running scripts on them, copying files to them, and aggregating coding
    contracts, lore, and other files located on discovered servers.
*/
class ServerDashboard {
  #ns;           // Reference to NetScript APIs
  #log;          // Reference to logging function
  #localhost;    // Server this script is currently running on
  #runLoopDelay; // Delay applied at end of infinite loop if no other ns async functions were used.

  // Properties set on calling initialize():
  #servers          = [];    // Discovered servers [{hostname: string, maxRAM: number}, ...]
  #serversPopulated = false; // Whether discoverServers has been called at least once.

  constructor (ns, logger, runLoopDelay=500) {
    // METHOD: ServerDashboard (primary constructor)

    this.#ns           = ns;
    this.#log          = logger;
    this.#localhost    = ns.getHostname();
    this.#runLoopDelay = runLoopDelay;
  }

  isInitialized() {
    /*
      METHOD: ServerDashboard.isInitialized
      DESCRIPTION:
        Returns true if dashboard is ready for full operation, false if certain
        operations must happen before use.
    */

    if (!this.#serversPopulated) {
      this.#log('Must call discoverServers at least once.', MSG_TYPE.error);
      return false;
    }
    return true;
  }

  discoverServers(rootHost=this.#localhost) {
    /*
      METHOD: ServerDashboard.discoverServers
      DESCRIPTION:
        Recursively scans the entire network, populating the
        servers list with all connected hostnames.
    */

    const preServersCount = this.#servers.length;

    for (const hostname of this.#ns.scan(rootHost)) {
      /*
        If not an excluded or already discovered hostname, get
        Server object for new hostname and add it to discovered
        servers list. :
      */
      if (
        !EXCLUDED_SERVERS.includes(hostname) &&
        !this.#servers.map(s => s.hostname).includes(hostname)
      ) {
        this.#log(`discovered ${hostname}`);
        this.#servers.push(
          this.#ns.getServer(hostname)
        );

        // Recursively discover children of child server:
        this.discoverServers(hostname);
      }
      if (this.#servers.length > 0) { this.#serversPopulated = true; }
    }
  }

  showServers() {
    /*
      METHOD: ServerDashboard.showServers
      DESCRIPTION:
        Displays all discovered servers and their properties

        TODO: add filtering for hostname, max RAM, rooted, backdoored, etc.
    */

    if (!this.isInitialized()) { return; }

    this.#log(`DISCOVERED SERVERS: `, MSG_TYPE.info);
    for (const server of this.#servers) {
      // Show information about server:
      this.#log(
        `\n${HRULE}` +
        `\n\t${server.hostname}` +
        `\n\t\tRequired Hacking Skill: ${server.requiredHackingSkill ? server.requiredHackingSkill : 'N/A'}` +
        `\n\t\t${server.maxRam - server.ramUsed}/${server.maxRam}GB` +
        `\n\t\tRooted?   : ${this.#ns.hasRootAccess(server.hostname) ? 'Yes' : 'No'}` +
        `\n\t\tBackdoor? : ${server.backdoorInstalled ? 'Yes' : 'No'}` +
        `\n\t\tFiles:`
      );

      // Show files on server:
      for (const file of this.#ns.ls(server.hostname)) {
        this.#log(`\t\t\t${file}`);
      }

      // Show active processes:
      this.#log(`\n\t\tProcesses:`);
      for (const process of this.#ns.ps(server.hostname)) {
        // Show properties of each process object:
        for (const [key, val] of Object.entries(process)) {
          this.#log(`\t\t\t${key}: ${val}`);
        }
      }
      this.#log(`${HRULE}`);
    }
    this.#log(`\t${this.#servers.length} total servers.`);
  }

  findAllFiles(substring=undefined, targetServers=[]) {
    /*
      METHOD: ServerDashboard.getAllFiles
      DESCRIPTION:
        Returns a list of all files across all discovered servers;
        can optionally provide a substring to filter which files are
        included in the returned list.
        List is of form: [{host: string, filename: string}, ...]
    */

    if (!this.isInitialized()) { return null; }

    let discoveredFiles = []; // All found files matching provided search params.
    let searchServers   = this.#servers.map(s => s.hostname); // Defaults to all discovered servers.

    // Limit search to target servers if any were given.
    if (targetServers.length > 0) {
      // Convert single server string argument to list if needed:
      if (typeof targetServers == "string") {
        searchServers = [targetServers];
      }
      else {
        searchServers = targetServers;
      }
    }

    // Get all files on each server in search list, and add to returned list if match:
    for (const server of searchServers) {
      const serverFiles = this.#ns.ls(server); // Files on current server in list
      if (serverFiles.length > 0 ) {
        for (const file of serverFiles) {
          // If a search substring was provided, only add files that contain it:
          if (substring) {
            if (file.includes(substring)) {
              discoveredFiles.push({host: server, filename: file});
            }
          }
          else {
            // No search substring provided; all files found are considered matches:
            discoveredFiles.push({host: server, filename: file});
          }
        }
      }
    }
    return discoveredFiles;
  }

  showFiles(substring=undefined, targetServers=[]) {
    /*
      METHOD: ServerDashboard.showAllFiles
      DESCRIPTION:
        Displays all files across all discovered servers, optionally
        filtered by providing a substring matches must include.
        Returns true if any files could be shown, false otherwise.
    */
    if (!this.isInitialized()) { return; }

    // Display filter applied, and target servers; if either provided:
    this.#log(
      `\nSHOWING ALL FILES...\n` +
      HRULE +
      `${substring ? `\nFilter: ${substring}` : ''}` +
      `${targetServers.length ? `\nTarget(s): ${targetServers}\n` : ''}`
    )

    // Get updated files list:
    const files = this.findAllFiles(substring, targetServers);
    if (!files || files.length <= 0) {
      this.#log(`No matches found`);
      return false;
    }

    for (const file of files) {
      // Show hostname, path, and RAM usage if script:
      this.#log(`\t[Host: ${file.host}]: ${file.filename}`);
    }

    // Search summary messages:
    this.#log(
      `Total matches found: ${files.length}\n` +
      HRULE
    );
    return true;
  }

  async start() {
    /*
      METHOD: ServerDashboard.start
      DESCRIPTION:
        Starts the main loop for user interaction with the dashboard.
    */
    this.#log(`Launching ServerBoss Dashboard...`);

    this.discoverServers();
    if (!this.isInitialized()) {
      this.#log(`Dashboard could not be initialized; terminating ServerBOSS...`, MSG_TYPE.error);
    }


    const commands = {
      cmdExit:            "Exit",
      cmdDiscoverServers: "Discover Servers",
      cmdShowServers:     "Show Servers",
      cmdShowFiles:       "Search Files"
    }

    let running = true;
    while (running) {
      // Get next command from user:
      const command = await this.#ns.prompt(
        "ServerBOSS: awaiting user command...",
        {
          type: "select",
          choices: [
            commands.cmdDiscoverServers,
            commands.cmdShowServers,
            commands.cmdShowFiles,
            commands.cmdExit
          ]
        }
      );

      // Call methods associated with command, or exit loop:
      switch (command) {
        case commands.cmdDiscoverServers:
          this.discoverServers();
          break;
        case commands.cmdShowServers:
          this.showServers();
          break;
        case commands.cmdShowFiles:
          const fileFilter = await this.#ns.prompt(
            `ServerBOSS (Search Files): Enter filename filter: `,
            { type: "text" }
          );
          const serverFilter = await this.#ns.prompt(
            `ServerBOSS (Search Files): Enter server filter: `,
            { type: "text" }
          );
          this.showFiles(fileFilter, serverFilter);
          break;
        case commands.cmdExit:
          this.#log('ServerBOSS (Exit): Terminating...');
          running = false;
          break;
        default:
          this.#log('ServerBoss: Unsupported command');
      }

      await this.#ns.sleep(this.#runLoopDelay); // Keeps infinite loop from crashing game.
    }
  }
}
// END ServerDashboard

//------------------------------------------------------------------------------

