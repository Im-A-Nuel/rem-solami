import { AGENT_USAGE, runAgent } from "./agent.js";
import { SETUP_USAGE, runSetup } from "./setup.js";

// Subcommands only. Real work lives in the modules the commands call.

const USAGE = `rem: non-custodial emergency brake for AI agent wallets

Commands:
  setup      Create the nonce account, approve the agent, and sign the panic transaction (owner's machine)
  agent add  Validate a panic file and store the agent in the database (server)

Run \`rem <command> --help\` for details.`;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const wantsHelp = rest.includes("--help") || rest.includes("-h");

  switch (command) {
    case "setup":
      if (wantsHelp) return console.log(SETUP_USAGE);
      return runSetup(rest);
    case "agent":
      if (wantsHelp) return console.log(AGENT_USAGE);
      return runAgent(rest);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return console.log(USAGE);
    default:
      throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
