import z from '@deepseek-ai/schemastery'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import os from 'node:os'
import path from 'node:path'

/**
 * Host half of the agent-desktop plugin.
 *
 * The plugin owns one native binary, the agent-desktop CLI from
 * https://github.com/vercel-labs/agent-desktop. It installs that binary into a
 * private directory, keeps it current by comparing the installed version with
 * the latest GitHub release on every launch, and exposes the binary's commands
 * to the model as first-class tools. The Web GUI reads the same state through
 * one JSON route, so the Settings page shows exactly what the model sees.
 */

/** Upstream repository the release archive and its checksums come from. */
const DEFAULT_REPO = 'vercel-labs/agent-desktop'
/** Which generation of this file a running Host loaded. */
const REVISION = '2026-11-12.1'
/** Longest one release lookup may take, in milliseconds. */
const LOOKUP_TIMEOUT_MS = 12_000
/** Longest one release download may take, in milliseconds. */
const DOWNLOAD_TIMEOUT_MS = 180_000
/** How many snapshot lines one tool result shows before it is cut. */
const SNAPSHOT_LINE_BUDGET = 400

export const Config = z.object({
  /** Path the Web GUI reads and writes the plugin's data at. */
  endpoint: z.string().default('/plugins/agent-desktop'),
  /** Directory the binary is installed into. Empty means the default location. */
  installDir: z.string().default(''),
  /** Check GitHub for a newer release every time the Harness starts. */
  autoUpdate: z.boolean().default(true),
  /** Upstream repository the release comes from. */
  repo: z.string().default(DEFAULT_REPO),
  /** Register the desktop_* tools the model calls. */
  registerTools: z.boolean().default(true),
  /** Add the operating guide to the model's system prompt. */
  guideInPrompt: z.boolean().default(true),
  /** Longest one desktop command may run, in milliseconds. */
  toolTimeoutMs: z.number().default(60_000),
})

/** Hard services: the HTTP carrier for the page, the tool registry, the prompt. */
export const inject = ['webServer', 'tools', 'systemPrompt']

/**
 * Read one setting, tolerating both a plain value and a live config getter.
 *
 * @param {object | undefined} config - the row's resolved configuration.
 * @param {string} field - the setting to read.
 * @param {unknown} fallback - the value to use when the setting is absent.
 * @returns {unknown} the resolved setting.
 */
function setting(config, field, fallback) {
  const value = config?.[field]
  if (value === undefined) return fallback
  const resolved = typeof value?.get === 'function' ? value.get() : value
  return resolved === undefined ? fallback : resolved
}

/**
 * Compare two dotted version strings.
 *
 * @param {string} left - the first version.
 * @param {string} right - the second version.
 * @returns {number} a negative number when left is older, 0 when they match.
 */
function compareVersions(left, right) {
  const parts = (value) => String(value ?? '').replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const a = parts(left)
  const b = parts(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/**
 * The release asset that carries the CLI for this machine.
 *
 * @param {string} version - the release version, without its leading v.
 * @returns {string} the asset file name.
 */
function assetNameFor(version) {
  const platform = process.platform === 'win32'
    ? 'pc-windows-msvc'
    : process.platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-gnu'
  const arch = process.arch === 'arm64' ? 'aarch64' : process.arch === 'x64' ? 'x86_64' : process.arch
  return `agent-desktop-v${version}-${arch}-${platform}.tar.gz`
}

/**
 * Resolve a path inside a directory, refusing to leave it.
 *
 * @param {string} root - the directory the result must stay inside.
 * @param {string} candidate - the relative path.
 * @returns {string | null} the absolute path, or null when it escapes.
 */
function safeJoin(root, candidate) {
  const resolved = path.resolve(root, candidate)
  const prefix = path.resolve(root) + path.sep
  if (resolved !== path.resolve(root) && !resolved.startsWith(prefix)) return null
  return resolved
}

/**
 * Read one octal field of a tar header.
 *
 * @param {Buffer} header - the 512 byte header block.
 * @param {number} start - where the field starts.
 * @param {number} length - how long the field is.
 * @returns {number} the parsed number.
 */
function readOctal(header, start, length) {
  const text = header.toString('ascii', start, start + length).replace(/\0.*$/, '').trim()
  return text.length === 0 ? 0 : Number.parseInt(text, 8) || 0
}

/**
 * Read one text field of a tar header.
 *
 * @param {Buffer} header - the 512 byte header block.
 * @param {number} start - where the field starts.
 * @param {number} length - how long the field is.
 * @returns {string} the field, without its NUL padding.
 */
function readString(header, start, length) {
  return header.toString('utf8', start, start + length).replace(/\0.*$/, '')
}

/**
 * The principals one Windows ACL grants.
 *
 * @param {string} output - what `icacls` printed.
 * @returns {string[]} the principal names, lower-cased.
 */
function principalsOf(output) {
  const principals = []
  for (const match of output.matchAll(/([^\s:][^:]*?):\([^)]*\)/gu)) {
    principals.push(match[1].trim().toLowerCase())
  }
  return principals
}

/**
 * Read the path a pax extended header carries.
 *
 * @param {Buffer} data - the header body.
 * @returns {string | null} the path, when the header carries one.
 */
function readPaxPath(data) {
  const text = data.toString('utf8')
  const match = /(?:^|\n)\d+ path=([^\n]*)/u.exec(text)
  return match ? match[1] : null
}

/**
 * Unpack a tar archive into a directory.
 *
 * @param {Buffer} archive - the tar bytes.
 * @param {string} destination - the directory the entries are written into.
 * @returns {Promise<string[]>} the paths written, relative to the destination.
 */
async function extractTar(archive, destination) {
  const written = []
  let offset = 0
  let longName = null
  let paxPath = null
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const size = readOctal(header, 124, 12)
    const type = String.fromCharCode(header[156])
    const prefix = readString(header, 345, 155)
    const name = readString(header, 0, 100)
    offset += 512
    const body = archive.subarray(offset, offset + size)
    offset += size + ((512 - (size % 512)) % 512)
    if (type === 'L') {
      longName = body.toString('utf8').replace(/\0.*$/, '')
      continue
    }
    if (type === 'x' || type === 'g') {
      paxPath = readPaxPath(body)
      continue
    }
    const entry = longName ?? paxPath ?? (prefix.length > 0 ? `${prefix}/${name}` : name)
    longName = null
    paxPath = null
    const target = safeJoin(destination, entry)
    if (target === null) continue
    if (type === '5') {
      await mkdir(target, { recursive: true })
      continue
    }
    if (type !== '0' && type !== '\0' && type !== '') continue
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
    if ((readOctal(header, 100, 8) & 0o111) !== 0) {
      try {
        await chmod(target, 0o755)
      } catch {
        /* a filesystem without POSIX modes still runs the binary */
      }
    }
    written.push(entry)
  }
  return written
}

/**
 * Unpack a gzipped tar archive into a directory.
 *
 * @param {Buffer} archive - the gzip bytes.
 * @param {string} destination - the directory the entries are written into.
 * @returns {Promise<string[]>} the paths written, relative to the destination.
 */
async function extractTarGz(archive, destination) {
  return extractTar(gunzipSync(archive), destination)
}

/**
 * Fetch one JSON document.
 *
 * @param {string} url - the address to read.
 * @param {number} timeoutMs - how long the read may take.
 * @returns {Promise<unknown>} the parsed body.
 */
async function fetchJson(url, timeoutMs) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'dsh-agent-desktop' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`the server answered ${response.status}`)
  return response.json()
}

/**
 * Fetch one binary document.
 *
 * @param {string} url - the address to read.
 * @param {number} timeoutMs - how long the read may take.
 * @returns {Promise<Buffer>} the bytes.
 */
async function fetchBuffer(url, timeoutMs) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'dsh-agent-desktop' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`the server answered ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Read the sha256 of every file a release lists.
 *
 * @param {string} url - the address of the checksums file.
 * @returns {Promise<Record<string, string>>} the digests, keyed by file name.
 */
async function fetchChecksums(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'dsh-agent-desktop' },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`the checksums file answered ${response.status}`)
  const body = await response.text()
  const digests = {}
  for (const line of body.split(/\r?\n/u)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/iu.exec(line.trim())
    if (match) digests[match[2].trim()] = match[1].toLowerCase()
  }
  return digests
}

/**
 * Find the executable inside an unpacked release.
 *
 * @param {string} directory - the directory the archive was unpacked into.
 * @returns {Promise<string | null>} the absolute path of the executable.
 */
async function findExecutable(directory) {
  const wanted = process.platform === 'win32' ? 'agent-desktop.exe' : 'agent-desktop'
  let best = null
  const walk = async (current, depth) => {
    if (best !== null || depth > 3) return
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (best !== null) return
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
        continue
      }
      if (entry.name === wanted) best = full
    }
  }
  await walk(directory, 0)
  return best
}

/**
 * Run one program and collect what it wrote.
 *
 * @param {string} file - the program to run.
 * @param {string[]} args - its arguments.
 * @param {object} options - the run options.
 * @param {number} options.timeoutMs - how long the run may take.
 * @param {AbortSignal} [options.signal] - the caller's cancellation.
 * @param {string} [options.cwd] - the working directory.
 * @param {Record<string, string>} [options.env] - extra environment entries.
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string, error: string | null }>} what the run produced.
 */
function runProgram(file, args, options) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(file, args, {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        windowsHide: true,
      })
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: '', error: error instanceof Error ? error.message : String(error) })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* the child already left */
      }
      finish({ code: null, stdout, stderr, error: `the command ran longer than ${options.timeoutMs} ms` })
    }, options.timeoutMs)
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.on('error', (error) => {
      finish({ code: null, stdout, stderr, error: error instanceof Error ? error.message : String(error) })
    })
    child.on('close', (code) => {
      finish({ code, stdout, stderr, error: null })
    })
    const onAbort = () => {
      try {
        child.kill()
      } catch {
        /* the child already left */
      }
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * The compact guide the model reads before its first desktop command.
 *
 * It is the operating loop, the ref rules and the retry rules, in the words
 * the binary itself ships. The full guide stays one tool call away.
 */
const COMPACT_GUIDE = [
  '## Desktop control (agent-desktop)',
  '',
  'You can see and operate the real desktop through the `desktop_*` tools. They call the agent-desktop CLI, which reads the OS accessibility tree; no screenshots, no pixel matching.',
  '',
  'The loop: observe, act on a ref, then observe again to verify.',
  '1. `desktop_snapshot` (or `desktop_find`) returns elements, each with a ref such as `@s8f3k2p9:e8`.',
  '2. Act on that exact ref: `desktop_click`, `desktop_set_value`, `desktop_press`, `desktop_act`.',
  '3. Snapshot again and check the result. Never assume an action worked.',
  '',
  'Rules that keep the loop reliable:',
  '- Refs belong to the snapshot that produced them. When the UI changes, an action answers `STALE_REF` or `AMBIGUOUS_TARGET`: take a new snapshot and use a fresh ref.',
  '- A bare `@e8` is rejected. Always pass the whole qualified ref.',
  '- One action at a time on one element. Several windows of the same app need `--window_id`: pass the id from `desktop_list_windows`.',
  '- On Windows, writing text is `desktop_set_value` (it works headless). `desktop_type` needs `--headed`, so it moves the real keyboard and takes focus; use it only when a field refuses the accessibility value path.',
  '- Repeat a failed action only when its `disposition.retry` is `safe`.',
  '- `desktop_wait` waits for the UI to catch up; prefer it over sleeping.',
  '- `desktop_guide` returns the full guide of the installed version, including the platform rules.',
].join('\n')

/**
 * One tool the model can call.
 *
 * @typedef {object} ToolSpec
 * @property {string} name - the model-facing tool name.
 * @property {string} command - the agent-desktop command it calls.
 * @property {string} description - what the tool does, in one or two sentences.
 * @property {object} schema - the JSON schema of its arguments.
 * @property {(args: any, support: (command: string, flag: string) => boolean) => string[]} build - the command line it produces.
 * @property {(args: any) => string} [title] - the card title of one call.
 */

/**
 * The desktop tools the model calls.
 *
 * @type {ToolSpec[]}
 */
const TOOL_SPECS = [
  {
    name: 'desktop_status',
    command: 'status',
    description: 'Report the agent-desktop adapter health, the platform, the OS permissions, and the surfaces it can read. Use it when a desktop command fails or before the first use.',
    schema: { type: 'object', properties: {} },
    build: () => [],
    title: () => 'Desktop status',
  },
  {
    name: 'desktop_snapshot',
    command: 'snapshot',
    description: 'Capture the accessibility tree of a desktop app as JSON. Every element the agent can act on carries a ref such as @s8f3k2p9:e8. Use interactive_only to keep only actionable elements, skeleton for a map of the app, and root to drill into one element.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The app to read, as desktop_list_apps prints it (for example notepad.exe).' },
        window_id: { type: 'string', description: 'The window to read, as desktop_list_windows prints it (for example w-123456).' },
        root: { type: 'string', description: 'Read only the subtree of this ref.' },
        interactive_only: { type: 'boolean', description: 'Keep only the elements that can be acted on.' },
        compact: { type: 'boolean', description: 'Return a compact tree without the verbose fields.' },
        skeleton: { type: 'boolean', description: 'Return the skeleton of the app: the regions and their children, not every element.' },
        surface: { type: 'string', description: 'Read a shell surface instead of a window, for example taskbar or start-menu.' },
        timeout_ms: { type: 'number', description: 'How long the read may take, in milliseconds.' },
      },
    },
    build: (args, support) => {
      const out = []
      if (args.app) out.push('--app', String(args.app))
      if (args.window_id) out.push('--window-id', String(args.window_id))
      if (args.root) out.push('--root', String(args.root))
      if (args.surface) out.push('--surface', String(args.surface))
      if (args.interactive_only) out.push('-i')
      if (args.compact) out.push('--compact')
      if (args.skeleton) out.push('--skeleton')
      if (args.timeout_ms) out.push('--timeout-ms', String(args.timeout_ms))
      return out
    },
    title: (args) => `Snapshot of ${args.app ?? args.window_id ?? 'the focused app'}`,
  },
  {
    name: 'desktop_find',
    command: 'find',
    description: 'Search the desktop for elements by role, name, value or text. Use it when you know what to look for but not where it is; it returns refs you can act on.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to look for in element names, values, titles or descriptions.' },
        name: { type: 'string', description: 'Accessible name or label to match.' },
        value: { type: 'string', description: 'Current value to match.' },
        role: { type: 'string', description: 'The accessibility role to match, for example button or textfield.' },
        app: { type: 'string', description: 'Search only this app.' },
        window_id: { type: 'string', description: 'Search only this window.' },
        limit: { type: 'number', description: 'How many matches to return at most.' },
        first: { type: 'boolean', description: 'Return only the first match.' },
      },
    },
    build: (args) => {
      const out = []
      if (args.query) out.push('--text', String(args.query))
      if (args.name) out.push('--name', String(args.name))
      if (args.value) out.push('--value', String(args.value))
      if (args.role) out.push('--role', String(args.role))
      if (args.app) out.push('--app', String(args.app))
      if (args.window_id) out.push('--window-id', String(args.window_id))
      if (args.limit) out.push('--limit', String(args.limit))
      if (args.first) out.push('--first')
      return out
    },
    title: (args) => `Find ${args.query ?? args.name ?? args.role ?? 'elements'}`,
  },
  {
    name: 'desktop_get',
    command: 'get',
    description: 'Read one property of an element: text, value, title, bounds, role or states.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the element.' },
        property: { type: 'string', description: 'The property to read, for example text or value.' },
      },
      required: ['ref'],
    },
    build: (args) => [String(args.ref), ...(args.property ? ['--property', String(args.property)] : [])],
    title: (args) => `Read ${args.property ?? 'a property'} of ${args.ref}`,
  },
  {
    name: 'desktop_is',
    command: 'is',
    description: 'Check one state of an element: visible, enabled, checked, focused, expanded or selected.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the element.' },
        state: { type: 'string', enum: ['visible', 'enabled', 'checked', 'focused', 'expanded', 'selected'], description: 'The state to check.' },
      },
      required: ['ref'],
    },
    build: (args) => [String(args.ref), '--property', String(args.state ?? 'visible')],
    title: (args) => `Check ${args.state ?? 'visible'} of ${args.ref}`,
  },
  {
    name: 'desktop_click',
    command: 'click',
    description: 'Click an element through the accessibility API. It does not move the pointer and does not steal focus.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the element.' },
      },
      required: ['ref'],
    },
    build: (args) => [String(args.ref)],
    title: (args) => `Click ${args.ref}`,
  },
  {
    name: 'desktop_set_value',
    command: 'set-value',
    description: 'Write a value straight into a text target through the accessibility value path. This is the headless way to fill a field on Windows.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the text target.' },
        value: { type: 'string', description: 'The text to write.' },
      },
      required: ['ref', 'value'],
    },
    build: (args) => [String(args.ref), String(args.value)],
    title: (args) => `Set the value of ${args.ref}`,
  },
  {
    name: 'desktop_type',
    command: 'type',
    description: 'Type text as real keystrokes. It needs a headed session, so it moves the keyboard and takes focus; prefer desktop_set_value when the field accepts it.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the text target.' },
        text: { type: 'string', description: 'The text to type.' },
        headed: { type: 'boolean', description: 'Type with the real keyboard. It moves the focus and the caret.' },
      },
      required: ['ref', 'text'],
    },
    build: (args) => [String(args.ref), String(args.text), ...(args.headed === true ? ['--headed'] : [])],
    title: (args) => `Type into ${args.ref}`,
  },
  {
    name: 'desktop_press',
    command: 'press',
    description: 'Send a key combination, for example return, escape, ctrl+s or alt+tab. Blocked shortcuts need force.',
    schema: {
      type: 'object',
      properties: {
        keys: { type: 'string', description: 'The key combination, for example ctrl+s.' },
        app: { type: 'string', description: 'Send the keys to this app instead of the foreground one.' },
        force: { type: 'boolean', description: 'Send a shortcut the tool normally refuses.' },
      },
      required: ['keys'],
    },
    build: (args) => {
      const out = []
      if (args.app) out.push('--app', String(args.app))
      if (args.force) out.push('--force')
      return [...out, String(args.keys)]
    },
    title: (args) => `Press ${args.keys}`,
  },
  {
    name: 'desktop_act',
    command: 'clear',
    commandOf: (args) => String(args?.action ?? 'clear'),
    description: 'Run one of the remaining element actions: clear, focus, select, toggle, check, uncheck, expand, collapse, scroll-to, double-click or right-click. Use it instead of a separate tool for each of them.',
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['clear', 'focus', 'select', 'toggle', 'check', 'uncheck', 'expand', 'collapse', 'scroll-to', 'double-click', 'right-click'],
          description: 'The action to run on the element.',
        },
        ref: { type: 'string', description: 'The qualified ref of the element.' },
        value: { type: 'string', description: 'The option to select, for the select action.' },
        headed: { type: 'boolean', description: 'Deliver the action with the real pointer and keyboard instead of the accessibility API.' },
      },
      required: ['action', 'ref'],
    },
    build: (args) => {
      const out = [String(args.ref)]
      if (args.action === 'select' && args.value) out.push(String(args.value))
      if (args.headed === true) out.push('--headed')
      return out
    },
    title: (args) => `${args.action} ${args.ref}`,
  },
  {
    name: 'desktop_scroll',
    command: 'scroll',
    description: 'Scroll a scroll area in a direction by a number of units.',
    schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The qualified ref of the scroll area.' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'The direction to scroll.' },
        amount: { type: 'number', description: 'How many units to scroll.' },
      },
      required: ['ref'],
    },
    build: (args) => {
      const out = [String(args.ref)]
      if (args.direction) out.push('--direction', String(args.direction))
      if (args.amount) out.push('--amount', String(args.amount))
      return out
    },
    title: (args) => `Scroll ${args.ref}`,
  },
  {
    name: 'desktop_launch',
    command: 'launch',
    description: 'Start an application and wait until its process runs. On Windows pass a bare name such as notepad, or an absolute path.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The application to start.' },
        activate: { type: 'boolean', description: 'Wait until a window appears.' },
      },
      required: ['app'],
    },
    build: (args) => {
      const out = []
      if (args.activate) out.push('--activate')
      return [...out, String(args.app)]
    },
    title: (args) => `Launch ${args.app}`,
  },
  {
    name: 'desktop_close_app',
    command: 'close-app',
    description: 'Quit an application and all its windows, or end its process when force is set.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The application to close.' },
        force: { type: 'boolean', description: 'End the process instead of asking it to quit.' },
      },
      required: ['app'],
    },
    build: (args) => {
      const out = []
      if (args.force) out.push('--force')
      return [...out, String(args.app)]
    },
    title: (args) => `Close ${args.app}`,
  },
  {
    name: 'desktop_list_apps',
    command: 'list-apps',
    description: 'List the GUI applications that run right now. Their names are the app names every other desktop command takes.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'List only this application.' },
      },
    },
    build: (args) => (args.app ? ['--app', String(args.app)] : []),
    title: () => 'List the running apps',
  },
  {
    name: 'desktop_list_windows',
    command: 'list-windows',
    description: 'List the visible windows with their ids, titles, bounds and focus state. Use the window id to aim a snapshot at one window.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'List only the windows of this app.' },
      },
    },
    build: (args) => (args.app ? ['--app', String(args.app)] : []),
    title: (args) => `List the windows of ${args.app ?? 'every app'}`,
  },
  {
    name: 'desktop_list_surfaces',
    command: 'list-surfaces',
    description: 'List the accessibility surfaces an app presents right now, such as a window, a menu or a sheet.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The app to inspect.' },
      },
    },
    build: (args) => (args.app ? ['--app', String(args.app)] : []),
    title: (args) => `List the surfaces of ${args.app ?? 'the focused app'}`,
  },
  {
    name: 'desktop_focus_window',
    command: 'focus-window',
    description: 'Bring a window to the front and confirm that the OS reports it focused. It steals the foreground from the user.',
    schema: {
      type: 'object',
      properties: {
        window_id: { type: 'string', description: 'The window to focus, as desktop_list_windows prints it.' },
        app: { type: 'string', description: 'The app whose window to focus.' },
        title: { type: 'string', description: 'The window title to focus, matched in part.' },
      },
    },
    build: (args) => {
      const out = []
      if (args.window_id) out.push('--window-id', String(args.window_id))
      if (args.app) out.push('--app', String(args.app))
      if (args.title) out.push('--title', String(args.title))
      return out
    },
    title: (args) => `Focus ${args.window_id ?? args.app ?? args.title ?? 'a window'}`,
  },
  {
    name: 'desktop_resize_window',
    command: 'resize-window',
    description: 'Set the width and the height of a window.',
    schema: {
      type: 'object',
      properties: {
        window_id: { type: 'string', description: 'The window to resize, as desktop_list_windows prints it.' },
        app: { type: 'string', description: 'Resize the window of this app.' },
        width: { type: 'number', description: 'The new width in pixels.' },
        height: { type: 'number', description: 'The new height in pixels.' },
      },
      required: ['width', 'height'],
    },
    build: (args) => {
      const out = []
      if (args.window_id) out.push('--window-id', String(args.window_id))
      if (args.app) out.push('--app', String(args.app))
      out.push('--width', String(args.width), '--height', String(args.height))
      return out
    },
    title: (args) => `Resize ${args.window_id ?? args.app ?? 'a window'}`,
  },
  {
    name: 'desktop_clipboard_get',
    command: 'clipboard-get',
    description: 'Read the text on the clipboard.',
    schema: { type: 'object', properties: {} },
    build: () => [],
    title: () => 'Read the clipboard',
  },
  {
    name: 'desktop_clipboard_set',
    command: 'clipboard-set',
    description: 'Write text to the clipboard.',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to write.' },
      },
      required: ['text'],
    },
    build: (args) => [String(args.text)],
    title: () => 'Write the clipboard',
  },
  {
    name: 'desktop_wait',
    command: 'wait',
    description: 'Wait until the desktop catches up: for a number of milliseconds, for an element to appear, for text to show, or for a window, app or focus event.',
    schema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'How long to wait, in milliseconds.' },
        element: { type: 'string', description: 'Wait for this ref to appear.' },
        predicate: { type: 'string', enum: ['exists', 'enabled', 'visible', 'actionable', 'value'], description: 'What to wait for on the element.' },
        text: { type: 'string', description: 'Wait for this text to appear.' },
        event: { type: 'string', enum: ['window-opened', 'window-closed', 'app-launched', 'app-terminated', 'focus-changed', 'surface-appeared', 'surface-dismissed'], description: 'Wait for this desktop event.' },
        app: { type: 'string', description: 'Scope the wait to this app.' },
        timeout_ms: { type: 'number', description: 'How long the wait may take, in milliseconds.' },
      },
    },
    build: (args) => {
      const out = []
      if (args.element) out.push('--element', String(args.element))
      if (args.predicate) out.push('--predicate', String(args.predicate))
      if (args.text) out.push('--text', String(args.text))
      if (args.event) out.push('--event', String(args.event))
      if (args.app) out.push('--app', String(args.app))
      if (args.timeout_ms) out.push('--timeout', String(args.timeout_ms))
      if (args.ms) out.push(String(args.ms))
      return out
    },
    title: (args) => `Wait for ${args.element ?? args.text ?? args.event ?? 'a moment'}`,
  },
  {
    name: 'desktop_screenshot',
    command: 'screenshot',
    description: 'Capture a PNG screenshot of an app window or a display. The image is returned to the conversation.',
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'The app to capture.' },
        window_id: { type: 'string', description: 'The window to capture.' },
        screen: { type: 'number', description: 'Capture the display with this index; 0 is the primary one.' },
        path: { type: 'string', description: 'Where the PNG is written.' },
      },
    },
    build: (args) => {
      const out = []
      if (args.app) out.push('--app', String(args.app))
      if (args.window_id) out.push('--window-id', String(args.window_id))
      if (args.screen !== undefined) out.push('--screen', String(args.screen))
      if (args.path) out.push(String(args.path))
      return out
    },
    title: (args) => `Screenshot ${args.app ?? args.window_id ?? 'the screen'}`,
  },
  {
    name: 'desktop_guide',
    command: 'skills',
    description: 'Read the operating guide of the installed agent-desktop: the desktop guide, or the platform guide that says what differs on this operating system.',
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['desktop', 'platform'], description: 'Which guide to read.' },
      },
    },
    build: (args) => ['get', args.scope === 'platform' ? 'platform' : 'desktop'],
    title: (args) => `Read the ${args.scope ?? 'desktop'} guide`,
  },
]

/**
 * Flatten one snapshot tree into the lines the model reads.
 *
 * @param {object} node - the tree node to flatten.
 * @param {string[]} lines - the lines collected so far.
 * @param {number} depth - how deep the walk is.
 * @returns {number} how many elements were written.
 */
function flattenTree(node, lines, depth) {
  if (node === null || typeof node !== 'object') return 0
  let count = 0
  const name = typeof node.name === 'string' ? node.name : ''
  const role = typeof node.role === 'string' ? node.role : ''
  const ref = typeof node.ref_id === 'string' ? node.ref_id : ''
  if (name.length > 0 || role.length > 0 || ref.length > 0) {
    const actions = Array.isArray(node.available_actions) && node.available_actions.length > 0
      ? ` [${node.available_actions.join(', ')}]`
      : ''
    lines.push(`${'  '.repeat(Math.min(depth, 12))}${role}${name.length > 0 ? ` "${name}"` : ''}${ref.length > 0 ? ` ${ref}` : ''}${actions}`)
    count += 1
  }
  const children = Array.isArray(node.children) ? node.children : []
  for (const child of children) {
    count += flattenTree(child, lines, depth + 1)
  }
  return count
}

/**
 * Render one desktop answer as the text the model reads.
 *
 * @param {object} envelope - the JSON envelope the CLI printed.
 * @returns {string} the rendered text.
 */
function renderEnvelope(envelope) {
  if (envelope === null || typeof envelope !== 'object') return String(envelope)
  if (envelope.ok === false) {
    const error = envelope.error ?? {}
    const disposition = error.disposition ?? {}
    const parts = [`${error.code ?? 'ERROR'}: ${error.message ?? 'the command failed'}`]
    if (disposition.delivery) parts.push(`delivery: ${disposition.delivery}`)
    if (disposition.retry) parts.push(`retry: ${disposition.retry}`)
    if (error.details !== undefined && error.details !== null) {
      parts.push(`details: ${JSON.stringify(error.details)}`)
    }
    return parts.join('\n')
  }
  const data = envelope.data ?? {}
  const command = String(envelope.command ?? '')
  if (command === 'snapshot' && data.tree !== undefined && data.tree !== null) {
    const lines = []
    const total = flattenTree(data.tree, lines, 0)
    const budget = lines.slice(0, SNAPSHOT_LINE_BUDGET)
    const header = [
      `snapshot ${data.snapshot_id ?? ''} of ${data.app ?? 'the focused app'} — ${data.ref_count ?? total} refs, ${total} elements`,
    ]
    if (lines.length > budget.length) {
      header.push(`(showing ${budget.length} of ${lines.length} lines; narrow the read with root or interactive_only)`)
    }
    return [...header, ...budget].join('\n')
  }
  if (command === 'skills' && typeof data.content === 'string') {
    return data.content
  }
  return JSON.stringify(data, null, 2)
}

/**
 * Keep the plugin's own state next to the binary it manages.
 *
 * @param {string} root - the install directory.
 * @returns {Promise<{ version: string | null, exe: string | null, installedAt: number | null }>} the stored state.
 */
async function readState(root) {
  try {
    const raw = JSON.parse(await readFile(path.join(root, 'state.json'), 'utf8'))
    return {
      version: typeof raw?.version === 'string' ? raw.version : null,
      exe: typeof raw?.exe === 'string' ? raw.exe : null,
      installedAt: typeof raw?.installedAt === 'number' ? raw.installedAt : null,
      releaseUrl: typeof raw?.releaseUrl === 'string' ? raw.releaseUrl : null,
    }
  } catch {
    return { version: null, exe: null, installedAt: null, releaseUrl: null }
  }
}

/**
 * Write the plugin's own state.
 *
 * @param {string} root - the install directory.
 * @param {object} state - the state to store.
 * @returns {Promise<void>} once the state is on disk.
 */
async function writeState(root, state) {
  await mkdir(root, { recursive: true })
  const target = path.join(root, 'state.json')
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
}

/**
 * Install one release of the binary.
 *
 * The archive is verified against the checksums the release publishes before
 * anything is unpacked, and the unpacked binary is asked for its version before
 * it is promoted. A failed attempt leaves the previous release in place.
 *
 * @param {object} options - the install options.
 * @param {string} options.root - the install directory.
 * @param {string} options.repo - the upstream repository.
 * @param {string} options.version - the version to install.
 * @param {(message: string) => void} options.log - the progress logger.
 * @returns {Promise<string>} the absolute path of the installed executable.
 */
async function installRelease(options) {
  const { root, repo, version, log } = options
  const asset = assetNameFor(version)
  const base = `https://github.com/${repo}/releases/download/v${version}`
  log(`downloading ${asset}`)
  const [archive, digests] = await Promise.all([
    fetchBuffer(`${base}/${asset}`, DOWNLOAD_TIMEOUT_MS),
    fetchChecksums(`${base}/checksums.txt`).catch(() => ({})),
  ])
  const digest = createHash('sha256').update(archive).digest('hex')
  const expected = digests[asset]
  if (expected && expected !== digest) {
    throw new Error(`the archive of ${asset} does not match the published checksum`)
  }
  const staging = path.join(root, `.staging-${version}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  try {
    await extractTarGz(archive, staging)
    const executable = await findExecutable(staging)
    if (executable === null) throw new Error(`the archive of ${asset} holds no agent-desktop executable`)
    const target = path.join(root, version)
    await rm(target, { recursive: true, force: true })
    await rename(staging, target)
    const installed = path.join(target, path.relative(staging, executable))
    await writeState(root, {
      version,
      exe: installed,
      installedAt: Date.now(),
      releaseUrl: `https://github.com/${repo}/releases/tag/v${version}`,
      sha256: digest,
      asset,
    })
    log(`agent-desktop ${version} is installed`)
    return installed
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

/**
 * Keep the plugin's binary installed and current.
 *
 * The update check runs whenever the Harness starts, so a new upstream release
 * reaches the model on the next launch. The work is asynchronous: the Harness
 * never waits for the network, and the tools wait for the install instead.
 *
 * @param {object} options - the runtime options.
 * @param {object} options.ctx - the plugin context.
 * @param {string} options.root - the install directory.
 * @param {string} options.repo - the upstream repository.
 * @param {boolean} options.autoUpdate - whether the check runs on its own.
 * @param {number} options.timeoutMs - how long one command may run.
 * @param {object} options.report - the shared status report.
 * @returns {Promise<object>} the report after the work is done.
 */
async function ensureInstalled(options) {
  const { ctx, root, repo, autoUpdate, timeoutMs, report } = options
  const logger = ctx.logger
  const state = await readState(root)
  report.installedVersion = state.version
  report.installPath = root
  report.executable = state.exe
  report.installedAt = state.installedAt
  const usable = state.exe !== null && existsSync(state.exe)
  if (!usable && !autoUpdate) {
    report.phase = 'error'
    report.lastError = 'agent-desktop is not installed and the automatic update is off'
    return report
  }
  report.phase = 'checking'
  let release
  try {
    const payload = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, LOOKUP_TIMEOUT_MS)
    const tag = typeof payload?.tag_name === 'string' ? payload.tag_name : ''
    release = {
      version: tag.replace(/^v/u, ''),
      url: typeof payload?.html_url === 'string' ? payload.html_url : `https://github.com/${repo}/releases`,
    }
  } catch (error) {
    report.lastCheckAt = Date.now()
    if (!usable) {
      report.phase = 'error'
      report.lastError = `agent-desktop could not be downloaded: ${error instanceof Error ? error.message : String(error)}`
      logger.warn(`agent-desktop: ${report.lastError}`)
      return report
    }
    report.phase = 'ready'
    report.latestVersion = state.version
    report.updateAvailable = false
    report.lastError = `the release check failed: ${error instanceof Error ? error.message : String(error)}`
    logger.warn(`agent-desktop: ${report.lastError}; the installed version stays in use`)
    return report
  }
  report.lastCheckAt = Date.now()
  report.latestVersion = release.version
  report.releaseUrl = release.url
  if (usable && state.version !== null && compareVersions(state.version, release.version) >= 0) {
    report.phase = 'ready'
    report.updateAvailable = false
    return report
  }
  report.updateAvailable = true
  report.phase = 'downloading'
  try {
    const executable = await installRelease({ root, repo, version: release.version, log: (message) => logger.info(`agent-desktop: ${message}`) })
    report.installedVersion = release.version
    report.executable = executable
    report.installedAt = Date.now()
    report.phase = 'ready'
    report.updateAvailable = false
    report.lastError = null
  } catch (error) {
    report.phase = usable ? 'ready' : 'error'
    report.lastError = `the update to ${release.version} failed: ${error instanceof Error ? error.message : String(error)}`
    logger.warn(`agent-desktop: ${report.lastError}`)
    if (!usable) report.phase = 'error'
  }
  return report
}

/**
 * Keep the plugin's binary installed and current.
 *
 * The plugin context owns every registration, so unloading the plugin removes
 * its tools, its prompt section and its route.
 *
 * @param {object} ctx - the plugin context.
 * @param {object} config - the row's resolved configuration.
 * @returns {Promise<void>} once the plugin is mounted.
 */
export async function apply(ctx, config) {
  const logger = ctx.logger
  const endpoint = String(setting(config, 'endpoint', '/plugins/agent-desktop'))
  const repo = String(setting(config, 'repo', DEFAULT_REPO))
  const autoUpdate = setting(config, 'autoUpdate', true) !== false
  const registerTools = setting(config, 'registerTools', true) !== false
  const guideInPrompt = setting(config, 'guideInPrompt', true) !== false
  const toolTimeoutMs = Math.max(1000, Number(setting(config, 'toolTimeoutMs', 60_000)) || 60_000)
  const configured = String(setting(config, 'installDir', ''))
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const root = configured.length > 0 ? path.resolve(configured) : path.join(home, 'agent-desktop')
  const stateHome = path.join(root, 'state')
  // agent-desktop wants its state root to exist and to stay private. The
  // directory inherits the three-principal ACL of the Harness home.
  await mkdir(stateHome, { recursive: true }).catch((error) => {
    logger.warn(`agent-desktop: the state directory could not be created: ${error instanceof Error ? error.message : String(error)}`)
  })

  /** The status the Web GUI reads and the tools report. */
  const report = {
    revision: REVISION,
    phase: 'idle',
    installedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    autoUpdate,
    installPath: root,
    executable: null,
    installedAt: null,
    lastCheckAt: null,
    lastError: null,
    releaseUrl: null,
    platform: process.platform,
    permissions: null,
    supportedSurfaces: [],
    stateRoot: null,
    tools: TOOL_SPECS.map((spec) => spec.name),
    repo,
  }

  /** The flags each command of the installed binary accepts. */
  const flagSupport = new Map()
  /** The running promise of the install, so every caller waits for one install. */
  let ready = null

  /**
   * The flags one command accepts.
   *
   * The binary ships its own help, so the plugin reads it once per command and
   * never sends a flag a newer or older release does not know.
   *
   * @param {string} command - the agent-desktop command.
   * @returns {Promise<Set<string>>} the accepted long flags.
   */
  const flagsOf = async (command) => {
    if (flagSupport.has(command)) return flagSupport.get(command)
    const executable = report.executable
    if (executable === null || !existsSync(executable)) {
      flagSupport.set(command, flags)
      return flags
    }
    const help = await runProgram(executable, [command, '--help'], { timeoutMs: 15_000 })
    const flags = new Map()
    if (executable !== null && existsSync(executable)) {
      const help = await runProgram(executable, [command, '--help'], { timeoutMs: 15_000 })
      for (const line of help.stdout.split(/\r?\n/u)) {
        const match = /--([a-z0-9][a-z0-9-]*)\s*(<[^>]+>)?/iu.exec(line)
        if (match) flags.set(match[1].toLowerCase(), match[2] !== undefined)
      }
    }
    flagSupport.set(command, flags)
    return flags
  }

  /**
   * Drop the arguments one command does not accept.
   *
   * A release that renames or removes a flag must not break the tools: the
   * unknown flag, and the value it carried, are dropped and reported.
   *
   * @param {string} command - the agent-desktop command.
   * @param {string[]} args - the arguments the tool built.
   * @returns {Promise<string[]>} the arguments the command accepts.
   */
  const filterSupported = async (command, args) => {
    const flags = await flagsOf(command)
    if (flags.size === 0) return args
    const kept = []
    for (let index = 0; index < args.length; index += 1) {
      const entry = args[index]
      const match = typeof entry === 'string' ? /^--([a-z0-9][a-z0-9-]*)$/iu.exec(entry) : null
      if (match === null) {
        kept.push(entry)
        continue
      }
      const flag = match[1].toLowerCase()
      if (flags.has(flag)) {
        kept.push(entry)
        continue
      }
      logger.warn(`agent-desktop: ${command} does not accept ${entry}; the argument is dropped`)
      const carriesValue = flags.get(flag) ?? true
      if (carriesValue && index + 1 < args.length && !String(args[index + 1]).startsWith('--')) {
        index += 1
      }
    }
    return kept
  }

  /** Whether the Windows interaction-lease directory was already checked. */
  let leaseChecked = false

  /**
   * The identity of the signed-in Windows user.
   *
   * @returns {Promise<{ sid: string | null, name: string | null }>} the token user.
   */
  const currentWindowsUser = async () => {
    const identity = await runProgram('whoami.exe', [], { timeoutMs: 10_000 })
    const name = identity.stdout.trim().split(/\r?\n/u)[0]?.trim() ?? null
    const detail = await runProgram('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { timeoutMs: 10_000 })
    const sid = /S-\d-\d+(?:-\d+)+/u.exec(detail.stdout)?.[0] ?? null
    return { sid, name }
  }

  /**
   * Repair the Windows interaction-lease directory when its ACL is not private.
   *
   * agent-desktop keeps its cross-process lease in
   * `<system drive>\ProgramData\agent-desktop\<token user sid>`. The binary
   * creates that directory with a private DACL and refuses to repair one that
   * grants anybody else, so a directory left behind by a run that could not
   * author its ACL blocks every action with `lease_directory_untrusted`. The
   * plugin removes such a directory: the binary recreates it privately on the
   * next command.
   *
   * @returns {Promise<boolean>} whether a directory was removed.
   */
  const repairLeaseDirectory = async () => {
    if (process.platform !== 'win32') return false
    const user = await currentWindowsUser()
    if (user.sid === null) return false
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    const drive = path.parse(systemRoot).root.replace(/[\\/]+$/u, '')
    const root = path.join(`${drive}\\`, 'ProgramData', 'agent-desktop')
    const leaf = path.join(root, user.sid)
    if (path.dirname(path.resolve(leaf)) !== path.resolve(root)) return false
    if (!existsSync(leaf)) return false
    const acl = await runProgram('icacls.exe', [leaf], { timeoutMs: 15_000 })
    const allowed = ['nt authority\\system', 'builtin\\administrators']
    if (user.name !== null) allowed.push(user.name.toLowerCase())
    const granted = principalsOf(acl.stdout)
    if (granted.length === 0) return false
    if (granted.every((principal) => allowed.includes(principal))) return false
    await rm(leaf, { recursive: true, force: true })
    logger.info('agent-desktop: the interaction-lease directory was not private; it was replaced')
    return true
  }

  /**
   * Run one desktop command and read its answer.
   *
   * @param {string[]} args - the command line, without the executable.
   * @param {object} [options] - the run options.
   * @param {AbortSignal} [options.signal] - the caller's cancellation.
   * @returns {Promise<object>} the JSON envelope the CLI printed.
   */
  const runEnvelope = async (args, options = {}) => {
    if (report.executable === null || !existsSync(report.executable)) {
      return {
        version: '2.6',
        ok: false,
        command: args[0] ?? 'agent-desktop',
        error: {
          code: 'NOT_INSTALLED',
          message: 'agent-desktop is not installed yet; the plugin is still downloading it',
          disposition: { delivery: 'not_delivered', retry: 'safe' },
        },
      }
    }
    if (!leaseChecked) {
      leaseChecked = true
      try {
        await repairLeaseDirectory()
      } catch (error) {
        logger.warn(`agent-desktop: the lease directory could not be checked: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const result = await runProgram(report.executable, args, {
      timeoutMs: toolTimeoutMs,
      signal: options.signal,
      env: { AGENT_DESKTOP_HOME: stateHome },
    })
    const text = result.stdout.trim()
    if (text.length > 0) {
      try {
        const envelope = JSON.parse(text)
        if (typeof envelope === 'object' && envelope !== null) {
          // A lease directory that is not private blocks every action. The
          // plugin replaces it and runs the command once more.
          const leaseError = envelope.ok === false
            && envelope.error?.details?.kind === 'lease_directory_untrusted'
            && /DACL/iu.test(String(envelope.error?.message ?? ''))
          if (leaseError) {
            const repaired = await repairLeaseDirectory()
            if (repaired) {
              const retry = await runProgram(report.executable, args, {
                timeoutMs: toolTimeoutMs,
                signal: options.signal,
                env: { AGENT_DESKTOP_HOME: stateHome },
              })
              const retryText = retry.stdout.trim()
              if (retryText.length > 0) {
                try {
                  const retried = JSON.parse(retryText)
                  if (typeof retried === 'object' && retried !== null) return retried
                } catch {
                  /* the retry printed something that is not an envelope */
                }
              }
            }
          }
          return envelope
        }
      } catch {
        /* the command printed something that is not an envelope */
      }
    }
    if (result.error !== null) {
      return {
        version: '2.6',
        ok: false,
        command: args[0] ?? 'agent-desktop',
        error: { code: 'COMMAND_FAILED', message: result.error, disposition: { delivery: 'not_delivered', retry: 'safe' } },
      }
    }
    return {
      version: '2.6',
      ok: false,
      command: args[0] ?? 'agent-desktop',
      error: {
        code: 'NO_OUTPUT',
        message: result.stderr.trim() || `the command exited with code ${result.code}`,
        disposition: { delivery: 'not_delivered', retry: 'safe' },
      },
    }
  }

  /**
   * Read the platform status of the installed binary.
   *
   * @returns {Promise<void>} once the report holds the platform facts.
   */
  const refreshStatus = async () => {
    const envelope = await runEnvelope(['status'])
    if (envelope.ok === true) {
      const data = envelope.data ?? {}
      report.permissions = data.permissions ?? null
      report.supportedSurfaces = Array.isArray(data.supported_surfaces) ? data.supported_surfaces : []
      report.stateRoot = typeof data.state_root === 'string' ? data.state_root : null
      if (typeof data.version === 'string') report.installedVersion = data.version
    }
  }

  /** The promise every tool waits for before it runs. */
  const ensureReady = () => {
    if (ready === null) {
      ready = ensureInstalled({ ctx, root, repo, autoUpdate, timeoutMs: toolTimeoutMs, report })
        .then(async () => {
          await refreshStatus()
          return report
        })
        .catch((error) => {
          logger.warn(`agent-desktop: the install failed: ${error instanceof Error ? error.message : String(error)}`)
          report.phase = 'error'
          report.lastError = error instanceof Error ? error.message : String(error)
          return report
        })
    }
    return ready
  }

  // The check runs on its own so the Harness never waits for the network, and
  // the tools wait for the same promise.
  void ensureReady()

  if (registerTools) {
    for (const spec of TOOL_SPECS) {
      const dispose = ctx.tools.register({
        name: spec.name,
        description: spec.description,
        parameters: spec.schema,
        output: {
          schema: { type: 'object' },
          render: (_args, value) => [{ type: 'text', text: renderEnvelope(value) }],
        },
        timeoutMs: toolTimeoutMs,
        async execute(args, exec) {
          await ensureReady()
          const effective = args ?? {}
          const command = spec.commandOf ? spec.commandOf(effective) : spec.command
          const arguments_ = await filterSupported(command, spec.build(effective))
          const envelope = await runEnvelope([command, ...arguments_], { signal: exec?.signal })
          if (envelope.ok === true && command === 'status') {
            const data = envelope.data ?? {}
            report.permissions = data.permissions ?? report.permissions
            report.supportedSurfaces = Array.isArray(data.supported_surfaces) ? data.supported_surfaces : report.supportedSurfaces
            report.stateRoot = typeof data.state_root === 'string' ? data.state_root : report.stateRoot
          }
          return envelope
        },
        presentCall(args) {
          const title = spec.title ? spec.title(args ?? {}) : spec.name
          return { card: 'generic', title, kind: 'other' }
        },
      })
      ctx.effect(() => dispose, `agent-desktop: tool ${spec.name}`)
    }
  }

  if (guideInPrompt) {
    const prompt = ctx.get('systemPrompt')
    if (prompt !== undefined) {
      const dispose = prompt.section({
        name: 'agent-desktop',
        order: prompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX') + 2,
        text: () => COMPACT_GUIDE,
        interpolate: false,
      })
      ctx.effect(() => dispose, 'agent-desktop: prompt section')
    }
  }

  /**
   * Read one JSON request body, bounded.
   *
   * @param {object} req - the incoming request.
   * @returns {Promise<object>} the parsed body.
   */
  const readBody = (req) => new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 256_000) {
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: endpoint,
    handler: (req, res) => {
      const reply = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        void (async () => {
          try {
            reply(200, { ...report, repo, endpoint })
          } catch (error) {
            logger.warn(`agent-desktop: could not read the status: ${error instanceof Error ? error.message : String(error)}`)
            reply(500, { error: 'failed' })
          }
        })()
        return
      }
      if (req.method !== 'POST') {
        reply(405, { error: 'method-not-allowed' })
        return
      }
      void (async () => {
        const request = await readBody(req)
        const action = request?.action
        if (action === 'check') {
          await ensureInstalled({ ctx, root, repo, autoUpdate: true, timeoutMs: toolTimeoutMs, report })
          await refreshStatus()
          reply(200, { ...report, repo, endpoint })
          return
        }
        if (action === 'update-now') {
          report.phase = 'checking'
          const release = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, LOOKUP_TIMEOUT_MS)
            .catch(() => null)
          const version = typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/u, '') : report.latestVersion
          if (version === null) {
            report.lastError = 'the release check failed'
            reply(502, { ...report, error: 'release-check-failed' })
            return
          }
          report.phase = 'downloading'
          try {
            const executable = await installRelease({ root, repo, version, log: (message) => logger.info(`agent-desktop: ${message}`) })
            report.installedVersion = version
            report.executable = executable
            report.installedAt = Date.now()
            report.phase = 'ready'
            report.updateAvailable = false
            report.lastError = null
          } catch (error) {
            report.lastError = error instanceof Error ? error.message : String(error)
            report.phase = 'error'
            logger.warn(`agent-desktop: ${report.lastError}`)
          }
          await refreshStatus()
          reply(200, { ...report, repo, endpoint })
          return
        }
        if (action === 'health-check') {
          const envelope = await runEnvelope(['status'])
          await refreshStatus()
          reply(200, { ...report, repo, endpoint, envelope })
          return
        }
        if (action === 'guide') {
          const scope = request?.scope === 'platform' ? 'platform' : 'desktop'
          const envelope = await runEnvelope(['skills', 'get', scope])
          reply(200, { ...report, repo, endpoint, guide: envelope.ok === true ? envelope.data?.content ?? '' : '', error: envelope.ok === true ? null : envelope.error })
          return
        }
        if (action === 'set-auto-update') {
          const enabled = request?.enabled === true
          const editor = ctx.get('configEditor')
          const entry = ctx.fiber?.entry
          if (editor === undefined || entry === undefined) {
            reply(501, { ...report, error: 'no-config-editor' })
            return
          }
          try {
            await editor.edit(entry, (current) => ({ ...current, autoUpdate: enabled }))
          } catch (error) {
            logger.warn(`agent-desktop: could not change the automatic update: ${error instanceof Error ? error.message : String(error)}`)
            reply(500, { ...report, error: 'not-saved' })
            return
          }
          report.autoUpdate = enabled
          reply(200, { ...report, repo, endpoint })
          return
        }
        reply(400, { error: 'unknown-action' })
      })().catch((error) => {
        logger.warn(`agent-desktop: the control route failed: ${error instanceof Error ? error.message : String(error)}`)
        try {
          reply(500, { error: 'failed' })
        } catch {
          /* the reply already began */
        }
      })
    },
  }), 'agent-desktop: control route')
}
