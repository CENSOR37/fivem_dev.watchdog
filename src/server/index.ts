import { globSync } from 'glob';
import { watch } from 'chokidar';
import { sep } from "path";
import { parseFxManifest } from "./fxmanifest-parser";

const CONST_EVENT_COLORS = new Map<string, string>([
  ['add', '^2+'],
  ['change', 'Modified ^5'],
  ['unlink', '^1-']
]);

// single slash path
function slp(path: string): string {
  return path.replace(/\\/g, '/');
}

const currentResourceName = GetCurrentResourceName();
const resourcePath = GetResourcePath(currentResourceName);
const serverDataPath = resourcePath.slice(0, resourcePath.lastIndexOf('/resources'));
const resourceRoot = `${serverDataPath}/resources`

function shouldRestartResource(changedFilePath: string, resourceName: string): boolean {
  if (!resourceName) { return false; }
  if (resourceName === currentResourceName) { return false; }

  changedFilePath = slp(changedFilePath);
  const resourcePath = slp(GetResourcePath(resourceName));

  // always restart if fxmanifest.lua changed
  if (changedFilePath.includes(`${resourceName}/fxmanifest.lua`)) {
    return true;
  }

  // skip if no fxmanifest.lua
  const fileContent = LoadResourceFile(resourceName, "fxmanifest.lua");
  if (!fileContent) {
    return false;
  }

  const manifestData = parseFxManifest(fileContent);
  const manifestDefinitions = [
    ...(manifestData['shared_scripts'] || []),
    ...(manifestData['client_scripts'] || []),
    ...(manifestData['server_scripts'] || []),
    ...(manifestData['files'] || []),
  ];
  let isFileReferenced = false;

  const files = globSync(manifestDefinitions, {
    absolute: true,
    cwd: resourcePath,
  }).map((filePath) => slp(filePath));

  if (files.includes(changedFilePath)) {
    isFileReferenced = true;
  }

  return isFileReferenced;
};

async function restartResource(resourceName: string, shouldRefresh: boolean) {
  StopResource(resourceName)

  const do_start = () => {
    setTimeout(() => { StartResource(resourceName) }, 250);
  }

  const has_perm = IsPrincipalAceAllowed(`resource.${currentResourceName}`, "command")
  if (shouldRefresh && !has_perm) {
    /// log with scary red color
    console.log(`^6[dev-watchdog]^7 ^1[ERROR] YOU DONT HAVE PERMISSION TO REFRESH RESOURCES^7`)
    console.log(`^6[dev-watchdog]^7 ^1[ERROR] PLEASE ADD THE FOLLOWING PERMISSION TO YOUR SERVER CFG^7`)
    console.log(`^6[dev-watchdog]^7 ^1[ERROR] ^3add_ace resource.${currentResourceName} command allow^7`)
  }

  if (shouldRefresh && has_perm) {
    ExecuteCommand('refresh')

    setTimeout(() => { do_start() }, 250);
  } else {
    do_start()
  }
}

// original idea and parts of code from
// credits to https://github.com/loaf-scripts/loaf_watchdog/
const fileTypesToWatch = ["lua", "js", "css", "html", "json"];
const ensureTimers = new Map<string, NodeJS.Timeout | null>();

watch(`${resourceRoot}/**/*.{${fileTypesToWatch.join(',')}}`, {
  persistent: true,
  ignored: ['**/node_modules', '**/.git'],
  ignoreInitial: true
}).on('all', (event: string, path) => {
  let parts = path
    .replace(`${resourceRoot}/`.replaceAll('/', sep), '')
    .split(sep)
    .filter((part) => part !== 'resources' && part[0] !== '[' && part[part.length - 1] !== ']')

  const resourceName = parts[0];

  if (!shouldRestartResource(path, resourceName)) {
    return;
  }

  console.log('===============================');
  const fileName = parts.slice(1).join('/')
  console.log(`^6[dev-watchdog]^7 Resource ^4${resourceName}^7 changed. ${CONST_EVENT_COLORS.get(event) ?? ''}${fileName}^7`)

  let restartTimer = ensureTimers.get(resourceName) || null;
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    const shouldRefresh = parts[1] === 'fxmanifest.lua';
    if (shouldRefresh) {
      console.log('^6[dev-watchdog]^7 Refreshing resources & files')
    }

    console.log(`^6[dev-watchdog]^7 Restarting resource ^4${resourceName}^7`)

    restartResource(resourceName, shouldRefresh);

    ensureTimers.delete(resourceName);
    console.log('===============================');
  }, 500);

  ensureTimers.set(resourceName, restartTimer);
});
