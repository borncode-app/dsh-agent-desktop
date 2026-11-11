<div align="center">
  <img src="icon.svg" alt="" width="72" height="72">
  <h1>dsh-agent-desktop</h1>
  <p><b>Native computer use for DeepSeek Harness — the agent sees and drives the real desktop.</b></p>
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
accessibility tree and acts on it — no screenshots, no pixel matching. This plugin owns that binary for you:

- installs it into `~/.dsh/agent-desktop/<version>/` on first use,
- checks for a newer release on every Harness launch and swaps it in,
- exposes its commands as first-class tools the model can call,
- and shows both on a Settings page.

Result: "open the calculator and type 42" works without a terminal round trip.

## Features

- **Install-on-demand** — the right release for your platform is fetched, checksum-verified, and cached.
- **Auto-update** — `autoUpdate: true` keeps the binary current; disable it to pin the version you have.
- **First-class tools** — `desktop_snapshot`, `desktop_find`, `desktop_click`, `desktop_set_value`,
  `desktop_press`, `desktop_wait`, `desktop_screenshot`, and friends, with refs instead of coordinates.
- **Operating guide in the prompt** — `guideInPrompt` teaches the model the observe → act → observe loop,
  so it does not guess element positions.
- **Settings page** — installed version, update state, and the guide, all visible in the GUI.
- **Bounded calls** — `toolTimeoutMs` stops a hung window from stalling the turn.

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

Then, in DSH: **Plugins** → install the bundle from that directory, or:

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
tool call ──▶ plugin host row ──▶ agent-desktop CLI ──▶ OS accessibility tree
                    │                                        │
                    └── install / update release ◀── GitHub ─┘
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

## ภาษาไทย

Plugin นี้ให้ agent **ควบคุมเครื่องจริง** ผ่าน CLI [`agent-desktop`](https://github.com/vercel-labs/agent-desktop)
ของ Vercel Labs — อ่าน accessibility tree ของ OS แล้วสั่งงาน ไม่ใช่การจับภาพหน้าจอ

- ติดตั้งไบนารีเองใน `~/.dsh/agent-desktop/` ครั้งแรกที่เรียกใช้ และอัปเดตอัตโนมัติทุกครั้งที่เปิด DSH
- เพิ่ม tool `desktop_*` ให้โมเดลเรียกได้ (snapshot / find / click / set_value / press / wait / screenshot)
- ใส่ "คู่มือการใช้งาน" ใน system prompt ด้วย (`guideInPrompt: true`)
- มีหน้า Settings ให้ดูเวอร์ชันที่ติดตั้งและสถานะอัปเดต

⚠️ เครื่องมือนี้ทำงานแทนคุณบนเครื่องจริง — ช่วงแรกควรตั้ง access mode เป็นแบบขออนุมัติก่อน

## License

[MIT](LICENSE) © 2026 BornCode
