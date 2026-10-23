import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {createRequire} from 'node:module';
import { loadHostApi } from "../host-api.js";
if (!process.env.ULTRACODE_TEST_RUNTIME)
  throw new Error(
    "Set ULTRACODE_TEST_RUNTIME to an unpacked DSH runtime directory for contract tests.",
  );
export const hostImport = (name) =>
  import(
    pathToFileURL(
      resolve(
        process.env.ULTRACODE_TEST_RUNTIME,
        "node_modules",
        name,
        "lib/index.js",
      ),
    ).href
  );
export const api = await loadHostApi({ loader: { import: hostImport } });
export const semver=createRequire(resolve(process.env.ULTRACODE_TEST_RUNTIME,'package.json'))('semver');
