/*==============================================================================
  FILE:     ServerBOSS/manager.js
  AUTHOR:   TriaNaN
  DESCRIPTION:
    Server management dashboard for all servers accessible by the
    host this script is currently running on (intended to be 'home')
*/

//------------------------------------------------------------------------------
// CONSTANTS:

// Servers to leave unaffected when running modifying actions:
const EXCLUDED_SERVERS = ['home', 'darkweb'];

// File types of which to avoid deletion or other modification:
const EXCLUDED_FILETYPES = ['.msg', '.lit', '.exe', '.cct'];

// Different types of messages to be passed to logging function:
const MSG_TYPE = {
  error    : "*ERROR* ",
  warning  : "*WARNING* ",
  success  : "*SUCCESS* ",
  info     : "*INFO* "
}

const SEPERATOR = '* '.repeat(30);


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
}

//------------------------------------------------------------------------------
// CLASSES:

class ServerDashboard {
  /*
    CLASS: ServerDashboard
    DESCRIPTION:
      Representation of a dashboard for managing all connected servers; including
      running scripts on them, copying files to them, and aggregating coding
      contracts, lore, and other files located on discovered servers.
  */

  #ns;           // Reference to NetScript API
  #tix;          // Reference to NetScript TIX API
  #log;          // Reference to logging function
  #localhost;    // Server this script is currently running on
  #runLoopDelay; // Delay applied at end of infinite loop if no other ns async functions were used.

  // Properties set on calling initialize():
  #servers            = [];    // Discovered servers [{hostname: string, maxRAM: number}, ...]
  #serversPopulated   = false; // Whether discoverServers has been called at least once.

  constructor (ns, logger, runLoopDelay=500) {
    // METHOD: ServerDashboard (primary constructor)

    this.#ns           = ns;
    this.#tix          = ns.stock;
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

  // TODO: convert to static method so it can be used in the constructor:
  discoverServers(rootHost=this.#localhost, useLog=false) {
    /*
      METHOD: ServerDashboard.discoverServers
      DESCRIPTION:
        Recursively scans the entire network, populating the
        servers list with all connected hostnames.
    */

    // List of publically traded organizations on the stock market:
    const publicOrganizations = this.#tix.getSymbols().map(sym => ({name: this.#tix.getOrganization(sym), stockSymbol: sym}) );
    
    for (const hostname of this.#ns.scan(rootHost)) {
      // Verify hostname is an undiscovered server:
      if (
        !EXCLUDED_SERVERS.includes(hostname) &&
        !this.#servers.map(s => s.hostname).includes(hostname)
      ) {
        // Get Server object associated with hostname:
        const server = this.#ns.getServer(hostname);

        // Add stockSymbol property to Server object if owned by publically-traded company:
        for (const org of publicOrganizations) {
          if (server.organizationName == org.name) {
            server.stockSymbol = org.stockSymbol;
          }
        }

        // Add server object to discovered servers list and notify:
        this.#servers.push(server);
        if (useLog) {
          this.#log(`*Discovered ${hostname}${server.stockSymbol ? ` (Stock Symbol: ${server.stockSymbol})` : ''}*`);
        }
        
        // Recursively discover children of child server:
        this.discoverServers(hostname);
      }

      if (this.#servers.length > 0) { this.#serversPopulated = true; } // TODO: better initialization checking!
    }
  }

  showServer(server) {
    /*
      METHOD: ServerDashboard.showServer
      DESCRIPTION:
        Displays information about a discovered server.
        Returns displayed message as string.
    */

    // Show general server information:
    let msg = this.#log(
      `\n${server.hostname}` +
      `\n. Organization           : ${server.organizationName}` +
      `${server.stockSymbol ? `\n. Stock Symbol           : ${server.stockSymbol}` : ''}` +
      `\n. Required Hacking Skill : ${server.requiredHackingSkill ? server.requiredHackingSkill : 'N/A'}` +
      `\n. Available RAM          : ${server.maxRam - server.ramUsed}/${server.maxRam}GB` +
      `\n. Root Access?           : ${(server.hasAdminRights)  ? 'Yes' : 'No'}` +
      `\n. Backdoor Installed?    : ${server.backdoorInstalled ? 'Yes' : 'No'}` +
      `\n. Files:`
    )

    // Show files on server:
    for (const file of this.#ns.ls(server.hostname)) {
      msg += '\n' + this.#log(`. . ${file}`);
    }

    // Show active processes:
    msg += '\n' + this.#log(`. Processes:`);
    for (const process of this.#ns.ps(server.hostname)) {
      // Show properties of each process object:
      for (const [key, val] of Object.entries(process)) {
        msg += '\n' + this.#log(`. . ${key}: ${val}`);
      }
    }

    msg += this.#log(`\n${SEPERATOR}`);
    return msg;
  }

  getServerFilter(filterStr) {
    /*
      METHOD: ServerDashboard.showServer
      DESCRIPTION:
        Returns a server filter object when provided a string of
        filter arguments of format: "prop1=val1, prop2=val2, ..."
    */
    if (!filterStr) { return undefined; } // Cannot build filter from empty string

    // Create filter object from filter string supplied as input:
    const serverFilter = {
      hostname:          undefined,
      maxRam:            undefined,
      stockSymbol:       undefined,
      organizationName:  undefined,
      hasAdminRights:    undefined,
      backdoorInstalled: undefined,
      playerOwnsShares:  undefined
    }

    // Convert argument string to filter object with appropriately typed values:
    const filterArgs = filterStr.split(',').map(pair => pair.trim().split('=')).map(
      pair => { // Convert pair value to number or boolean as required
        return [
          pair[0],
          Number(pair[1]) ? Number(pair[1]) :
          pair[1] == "true"  ? true  :
          pair[1] == "false" ? false :
          pair[1]
        ];
      }
    );

    // Set each specified filter property:
    for (const property of Object.keys(serverFilter)) {
      filterArgs.forEach(
        arg => { if (arg[0] == property) serverFilter[property] = arg[1]; }
      );
    }

    return serverFilter;
  }

  filterServer(filter, server) {
    /*
      METHOD: ServerDashboard.filterServer
      DESCRIPTION:
        Returns true if the server passes all filters specified
        in the filter object, false otherwise.
    */
    if (!server) { return undefined; } // Cannot filter a nonexistent server.
    if (!filter) { return true; }      // Always pass if no filter supplied.

    let passFilter = true;
    for (const [property, value] of Object.entries(filter)) {
      if (value !== undefined) {
        if (property === "playerOwnsShares") {
          // Special handling for playerOwnsShares:
          if (!server.stockSymbol) {
            passFilter = false;
          }
          else {
            const pos = this.#tix.getPosition(server.stockSymbol);
            if ((pos[0] + pos[2]) <= 0) {
              passFilter = false;
            }
          }
        } else {
          // If the server has the property, but it doesn't match the filter value, hide the server
          if (server[property] === undefined || server[property] != value) {
            passFilter = false;
          }
        }
      }
    }

    return passFilter;
  }

  queryServers(filterStr=undefined) {
    /*
      METHOD: ServerDashboard.queryServers
      DESCRIPTION:
        Queries all discovered servers and displays their properties.

        > maxRAM=16, hasAdminRights=true, backdoorInstalled=true, playerOwnsShares=true
        This should return all servers that are rooted and backdoored, with 16GB RAM, that the player holds shares of.
    */

    if (!this.isInitialized()) { return; }

    const serverFilter = this.getServerFilter(filterStr);

    // Loop through discovered servers and display information about each if they match the filter:
    let alertMsg = "";
    alertMsg += this.#log(`DISCOVERED SERVERS: `, MSG_TYPE.info);

    // Show applied filters, if any:
    if (filterStr) {
      alertMsg += '\n' + this.#log(". Filter(s):");
      for (const [property, value] of Object.entries(serverFilter)) {
        if (value !== undefined) {
          alertMsg += '\n' + this.#log(`. . ${property}: ${value}`);
        }
      }
      alertMsg += '\n' + this.#log(SEPERATOR);
    }

    // Display all discovered servers that pass the filter:
    let serverCount = 0;
    for (const server of this.#servers) {
      // Only show servers passing filter (or all if no filter specified):
      const serverPassedFilter = this.filterServer(serverFilter, server);
      if (serverPassedFilter) {
        alertMsg += this.showServer(server);
        serverCount++;
      }
    }

    // Summarize query:
    alertMsg += '\n' + this.#log(`SERVERS SUMMARY:\n. Total Servers: ${serverCount}\n${SEPERATOR}`);
    return alertMsg;
  }

  getStatistics(targetServers=[]) { return; } // TODO

  rootBlast() { return; } // TODO

  spreadFiles(substring=undefined, source=this.#localhost, visited=new Set([this.#localhost])) {
    /*
      METHOD: ServerDashboard.spreadFiles
      DESCRIPTION:
        Copies files to all servers on network that
        have root access and a hacking level under the player's current level.
        Ignores connection limitations by traversing the network recursively.
    */

    if (!substring) { return; }

    // Get and verify files to copy exist on source server:
    const copyFiles = this.#ns.ls(source).filter(f => f.includes(substring));
    if (!copyFiles.length) { return; }

    // Display files to be spread:
    if (source == this.#localhost) {
      this.#log(`SPREADING ${copyFiles.length} FILES:`);
      for (const file of copyFiles) {
        this.#log(`. ${file}`);
      }
      this.#log(SEPERATOR);
    }

    // Recurse through network and spread files to target servers.
    for (const hostname of this.#ns.scan(source)) {
      
      // Verify hostname is unvisited server; if so add to visited list:
      if (visited.has(hostname)) { continue; }
      visited.add(hostname);

      // Spread files to hostname if within hacking level, and has root access (no point if can't run script c;):
      if (
        this.#ns.getHackingLevel() >= this.#ns.getServerRequiredHackingLevel(hostname) &&
        this.#ns.hasRootAccess(hostname)
      ) {
        // Copy files from source server to hostname:
        this.#log(`Copying ${copyFiles.length} files from ${source} to ${hostname}...`);
        if (this.#ns.scp(copyFiles, hostname, source)) {
          this.#log('. Copy successful.');
          // Repeat for each child hostname of current server:
          this.spreadFiles(substring, hostname, visited);
        }
        else { this.#log('. Copy failed.')}
      }
      else { this.#log(`Unsatisfied requirements: inadequate hacking level, no root access on ${hostname}`); }
    }
  }

  deleteFiles(substring=undefined, targetServers=[]) {
    /*
      METHOD: ServerDashboard.deleteFiles
      DESCRIPTION:
        Deletes files matching provided substring on all
        target servers, or all servers not in excluded servers
        list if no substring provided.
    */
    // Get all files matching substring from target servers, excluding certain filetypes:
    const filesForDeletion = this.findAllFiles(substring, targetServers).filter(
      ({filename}) => !EXCLUDED_FILETYPES.some(ext => filename.includes(ext))
    );
    if (!filesForDeletion.length) { this.#log('No files found matching substring.'); return; }

    this.#log(`DELETING FILES ON ${targetServers.length > 0 ? targetServers.length : 'ALL'} SERVERS...\n${SEPERATOR}`);

    // Track number of files deleted and number of servers affected:
    let deletedFileCount   = 0;
    let deletedFileServers = new Set();

    // Remove each file on each hostname its paired with:
    for (const {host, filename} of filesForDeletion) {
      this.#log(`Deleting '${filename}' on ${host}...`);

      // Kill script if running:
      if (this.#ns.scriptRunning(filename, host)) {
        this.#log(`. Killing active process...`)
        if (this.#ns.scriptKill(filename, host)) {
          this.#log(`. . ${filename} successfully killed on ${host}. File clear for deletion.`)
        }
        else {
          this.#log(`. . Failed to kill ${filename} on ${host}; file will not be deleted.`)
        }
      }

      // Attempt to delete file on host:
      if (this.#ns.rm(filename, host)) {
        // Deletion successful, increment deleted files count:
        this.#log(`. File successfully deleted`);
        deletedFileCount++;

        // Attempt to add server to set of affected servers:
        deletedFileServers.add(host);
      }
      else {
        // Could not delete file on host:
        this.#log(`. File deletion failed.`);
      }
    }

    // Display operation summary:
    this.#log(`${SEPERATOR}\nDeleted ${deletedFileCount} total files on ${deletedFileServers.size} servers.`);
  }

  runScript(script, targetServers=[], scriptArgs=[], ramLimitPercent=100) {
    /*
      METHOD: ServerDashboard.runScript
      DESCRIPTION:
        Runs a specific script located on each target server, with provided
        arguments, and an optional RAM usage cap on each target server.
    */
  }

  killScript(script, targetServers=[]) { return; } // TODO

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

    // Limit search to target servers if any were given.
    let searchServers   = this.#servers.map(s => s.hostname); // Defaults to all discovered servers.
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
    let discoveredFiles = []; // All found files matching provided search params.
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
      SEPERATOR +
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
      SEPERATOR
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
      cmdDiscoverServers: "Discover Servers",
      cmdQueryServers:    "Query Servers",
      cmdShowFiles:       "Search Files",
      cmdSpreadFiles:     "Spread File(s)",
      cmdDeleteFiles:     "Delete File(s)",
      cmdExit:            "Exit"
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
            commands.cmdQueryServers,
            commands.cmdShowFiles,
            commands.cmdSpreadFiles,
            commands.cmdDeleteFiles,
            commands.cmdExit
          ]
        }
      );

      // Call methods associated with command, or exit loop:
      switch (command) {

        case commands.cmdDiscoverServers:
          // Re-scan the network:
          this.discoverServers(useLog=true);
          break;


        case commands.cmdQueryServers:
          // Search and display discovered servers with a search query:
          const queryFilter = await this.#ns.prompt(
            `ServerBOSS (Show Servers): Enter server filter(s): ` +
            `\n. hostname:          string`  +
            `\n. maxRam:            number`  +
            `\n. stockSymbol:       string`  +
            `\n. organizationName:  string`  +
            `\n. hasAdminRights:    boolean` +
            `\n. backdoorInstalled: boolean` +
            `\n. playerOwnsShares:  boolean` +
            `\nExample: 'maxRam=16, hasAdminRights=true, backdoorInstalled=true, playerOwnsShares=true'`,
            {type: "text"}
          );
          this.#ns.alert(this.queryServers(queryFilter));
          break;


        case commands.cmdShowFiles:
          // Show files on specified (or not) servers based on a search string:
          let showFilter = await this.#ns.prompt(
            `ServerBOSS (Search Files): Enter filename filter,`   +
            `\nfollowed by target servers (none if search all):`  +
            `\n. Example: > .js, foodnstuff, zer0, sigma-cosmetics`,
            { type: "text" }
          );
          showFilter = showFilter.split(',');
          const showFileFilter   = showFilter[0].trim();
          const showServerFilter = showFilter.slice(1).map(h => h.trim());
          this.showFiles(showFileFilter, showServerFilter);
          break;
        

        case commands.cmdSpreadFiles:
          // Spread files throughout a network:
          const spreadFilter = await this.#ns.prompt(
            `ServerBOSS (Spread Files): Enter filename filter...`,
            { type: "text" }
          );
          this.spreadFiles(spreadFilter);
          break;
        

        case commands.cmdDeleteFiles:
          // Deletes files on specified (or not) servers:
          let deleteFilter = await this.#ns.prompt(
            `ServerBOSS (Delete Files): Enter filename filter,`   +
            `\nfollowed by target servers (none if search all):`  +
            `\n. Example: > .js, foodnstuff, zer0, sigma-cosmetics`,
            { type: "text" }
          );
          deleteFilter = deleteFilter.split(',');
          const deleteFileFilter   = deleteFilter[0].trim();
          const deleteServerFilter = deleteFilter.slice(1).map(h => h.trim());
          this.deleteFiles(deleteFileFilter, deleteServerFilter);
          break;


        case commands.cmdExit:
          // Exit the ServerBOSS dashboard:
          this.#log('ServerBOSS (Exit): Terminating...');
          running = false;
          break;


        default:
          // Not sure how you got here, but congrats!
          this.#log('ServerBoss: Unsupported command');
      }

      await this.#ns.sleep(this.#runLoopDelay); // Keeps infinite loop from crashing game.
    }
  }
}

//------------------------------------------------------------------------------
