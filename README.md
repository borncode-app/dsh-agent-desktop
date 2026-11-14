> **This repository has moved into one monorepo.**
>
> The BornCode plugins — agent customization, desktop control, auto-continue,
> auto-shutdown, browser use, session instructions, session sync, and the side
> chat — now live in
> **[`borncode-app/dsh-borncode`](https://github.com/borncode-app/dsh-borncode)**,
> one repository with one Plugins entry.
>
> | this repo | new home |
> |---|---|
> | `dsh-agent-customizer` | `packages/dsh-agent-customizer` |
> | `dsh-agent-desktop` | `packages/dsh-agent-desktop` |
> | `dsh-auto-continue` | `packages/dsh-auto-continue` |
> | `dsh-auto-shutdown` | `packages/dsh-auto-shutdown` |
> | `dsh-browser-use` | `packages/dsh-browser-use` |
> | `dsh-session-instructions` | `packages/dsh-session-instructions` |
> | `dsh-session-sync` | `packages/dsh-session-sync` |
> | `dsh-side-chat` | `packages/dsh-side-chat` |
>
> The code and its history are unchanged; only the repository is shared. Install
> `dsh-borncode` instead of the individual bundles. This repository stays open
> so the old links keep working.
<div align="center">
  <img src="icon.svg" alt="" width="72" height="72">
  <h1>dsh-agent-desktop</h1>
  <p><b>Native computer use for DeepSeek Harness â€” the agent sees and drives the real desktop.</b></p>
  <p>
    <a href="https://github.com/borncode-app/dsh-agent-desktop/releases"><img alt="release" src="https://img.shields.io/github/v/release/borncode-app/dsh-agent-desktop?style=flat-square&color=6C4BF6"></a>
    <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-3DA639?style=flat-square"></a>
    <img alt="plugin" src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-6C4BF6?style=flat-square">
    <img alt="powered by" src="https://img.shields.io/badge/binaries-agent--desktop-000?style=flat-square">
  </p>
</div>

---

## What it does

[`agent-desktop`](https://github.com/vercel-labs/agent-desktop) is a CLI that reads the operating system's
accessibility tree and acts on it â€” no screenshots, no pixel matching. This plugin owns that binary for you:

- installs it into `~/.dsh/agent-desktop/<version>/` on first use,
- checks for a newer release on every Harness launch and swaps it in,
- exposes its commands as first-class tools the model can call,
- and shows both on a Settings page.

Result: "open the calculator and type 42" works without a terminal round trip.

## Features

- **Install-on-demand** â€” the right release for your platform is fetched, checksum-verified, and cached.
- **Auto-update** â€” `autoUpdate: true` keeps the binary current; disable it to pin the version you have.
- **First-class tools** â€” `desktop_snapshot`, `desktop_find`, `desktop_click`, `desktop_set_value`,
  `desktop_press`, `desktop_wait`, `desktop_screenshot`, and friends, with refs instead of coordinates.
- **Operating guide in the prompt** â€” `guideInPrompt` teaches the model the observe â†’ act â†’ observe loop,
  so it does not guess element positions.
- **Settings page** â€” installed version, update state, and the guide, all visible in the GUI.
- **Bounded calls** â€” `toolTimeoutMs` stops a hung window from stalling the turn.

## Requirements

| | |
|---|---|
| DeepSeek Harness | 0.2.x (Web GUI) |
| Runtime | Node 24, supplied by the Harness runtime |
| Platform | Wherever [`agent-desktop`](https://github.com/vercel-labs/agent-desktop/releases) ships a release (Windows, macOS, Linux) |
| OS permission | Accessibility / automation permission for the app hosting DSH |

> The first `desktop_*` call on macOS asks for Accessibility permission. Deny it and every tool answers
> with an error rather than silently doing nothing.

## Install

```bash
git clone https://github.com/borncode-app/dsh-agent-desktop.git dsh-agent-desktop
```

Then, in DSH: **Plugins** â†’ install the bundle from that directory, or:

```
plugin_manager install_bundle target=C:\path\to\dsh-agent-desktop
```

Restart once. The binary installs itself on the first `desktop_*` tool call.

## Configuration

| field | default | meaning |
|---|---|---|
| `endpoint` | `/plugins/agent-desktop` | Path the Web GUI reads and writes plugin data at |
| `autoUpdate` | `true` | Check GitHub for a newer release on every Harness launch |
| `repo` | `vercel-labs/agent-desktop` | Upstream repository the release and checksums come from |
| `registerTools` | `true` | Register the `desktop_*` tools the model calls |
| `guideInPrompt` | `true` | Add the operating guide to the model's system prompt |
| `toolTimeoutMs` | `60000` | Longest one desktop command may run, in milliseconds |

## How it works

```
tool call â”€â”€â–¶ plugin host row â”€â”€â–¶ agent-desktop CLI â”€â”€â–¶ OS accessibility tree
                    â”‚                                        â”‚
                    â””â”€â”€ install / update release â—€â”€â”€ GitHub â”€â”˜
```

The plugin never synthesizes keystrokes itself: it shells out to the CLI and returns the CLI's JSON, so the
action semantics and the permission model stay in one place, upstream.

## Files

| file | role |
|---|---|
| `index.js` | host row: release resolution, install/update, tool registration, Settings page |
| `client.js` | the Settings page |
| `cordis.patch.yml` | the bundle patch that inserts the row |
| `locale/{en,th,zh}.json` | UI strings |
| `icon.svg` | plugin icon |

## Safety

Computer use is real: a click lands where the model points it. Keep access mode at **approve** while you build
trust, leave `autoUpdate` on so security fixes land, and remember that the tools act as *you* on this machine.

## à¸ à¸²à¸©à¸²à¹„à¸—à¸¢

Plugin à¸™à¸µà¹‰à¹ƒà¸«à¹‰ agent **à¸„à¸§à¸šà¸„à¸¸à¸¡à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸£à¸´à¸‡** à¸œà¹ˆà¸²à¸™ CLI [`agent-desktop`](https://github.com/vercel-labs/agent-desktop)
à¸‚à¸­à¸‡ Vercel Labs â€” à¸­à¹ˆà¸²à¸™ accessibility tree à¸‚à¸­à¸‡ OS à¹à¸¥à¹‰à¸§à¸ªà¸±à¹ˆà¸‡à¸‡à¸²à¸™ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸à¸²à¸£à¸ˆà¸±à¸šà¸ à¸²à¸žà¸«à¸™à¹‰à¸²à¸ˆà¸­

- à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¹„à¸šà¸™à¸²à¸£à¸µà¹€à¸­à¸‡à¹ƒà¸™ `~/.dsh/agent-desktop/` à¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸à¸—à¸µà¹ˆà¹€à¸£à¸µà¸¢à¸à¹ƒà¸Šà¹‰ à¹à¸¥à¸°à¸­à¸±à¸›à¹€à¸”à¸•à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡à¸—à¸µà¹ˆà¹€à¸›à¸´à¸” DSH
- à¹€à¸žà¸´à¹ˆà¸¡ tool `desktop_*` à¹ƒà¸«à¹‰à¹‚à¸¡à¹€à¸”à¸¥à¹€à¸£à¸µà¸¢à¸à¹„à¸”à¹‰ (snapshot / find / click / set_value / press / wait / screenshot)
- à¹ƒà¸ªà¹ˆ "à¸„à¸¹à¹ˆà¸¡à¸·à¸­à¸à¸²à¸£à¹ƒà¸Šà¹‰à¸‡à¸²à¸™" à¹ƒà¸™ system prompt à¸”à¹‰à¸§à¸¢ (`guideInPrompt: true`)
- à¸¡à¸µà¸«à¸™à¹‰à¸² Settings à¹ƒà¸«à¹‰à¸”à¸¹à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¸—à¸µà¹ˆà¸•à¸´à¸”à¸•à¸±à¹‰à¸‡à¹à¸¥à¸°à¸ªà¸–à¸²à¸™à¸°à¸­à¸±à¸›à¹€à¸”à¸•

âš ï¸ à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸¡à¸·à¸­à¸™à¸µà¹‰à¸—à¸³à¸‡à¸²à¸™à¹à¸—à¸™à¸„à¸¸à¸“à¸šà¸™à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ˆà¸£à¸´à¸‡ â€” à¸Šà¹ˆà¸§à¸‡à¹à¸£à¸à¸„à¸§à¸£à¸•à¸±à¹‰à¸‡ access mode à¹€à¸›à¹‡à¸™à¹à¸šà¸šà¸‚à¸­à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸à¹ˆà¸­à¸™

## License

[MIT](LICENSE) Â© 2026 BornCode
