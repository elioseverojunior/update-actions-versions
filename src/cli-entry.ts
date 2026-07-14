#!/usr/bin/env node
import { Command } from "commander";

import { createProgram, run } from "./cli";

// Ensure Commander is bundled by using it here
void Command;

const program = createProgram();
program.parse(process.argv);

const args = program.opts<{
  write: boolean;
  applyMajor: boolean;
  verbose: number;
  quiet: number;
  config: string | undefined;
  inlineConfig: string | undefined;
  printConfig: boolean;
}>();

const argsObj = {
  write: args.write,
  applyMajor: args.applyMajor,
  verbose: args.verbose,
  quiet: args.quiet,
  config: args.config ?? null,
  inlineConfig: args.inlineConfig ?? null,
  printConfig: args.printConfig,
};

process.exitCode = await run(argsObj);
