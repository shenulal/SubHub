# Playwright MCP Testing Guide

## Overview

This document sets out the procedure for inspecting local or remote development
server pages using Playwright MCP (Multi-agent Control Protocol). Assuming
`@executeautomation/playwright-mcp-server` is installed, it covers the flow from
browser preparation through page navigation to screenshot capture.

## Claude Code Integration Setup (Recommended)

### 🚀 Quick Start - Claude Code Users

If you use Claude Code, adding the MCP server to the settings file means it is
managed automatically.

#### 1. Locate the Settings File

```bash
~/.claude/settings.json
```

#### 2. Add the MCP Server Configuration

Add a `mcpServers` section to the existing settings file:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"],
      "disabled": false
    }
  }
}
```

**Caution**: Keep your existing settings and add only the `mcpServers` section.

#### 3. Restart Claude Code

Restart Claude Code so that the MCP server is loaded:

- **Option 1**: Fully quit the Claude Code application and restart it
- **Option 2**: Command Palette (Cmd+Shift+P) → "Reload Window"

#### 4. Verify the Connection

After restarting, you can verify the MCP connection in either of these ways:

- Ask Claude: "Please check whether the playwright MCP is connected"
- Check for the "playwright" server with `ListMcpResourcesTool`

#### 5. Install the Browser

If the Chromium browser is not present, install it:

```bash
npx playwright install chromium
```

It is installed automatically to the system default path
(`~/Library/Caches/ms-playwright`).

### 🔧 Manual Setup (Advanced Users)

If you do not use Claude Code, or prefer to manage the MCP server manually,
refer to the "Mandatory Execution Sequence" section below.

## Mandatory Execution Sequence (When a Playwright MCP Call Has Not Responded for More Than 2 Minutes)

1. **Check the target service status**: Re-confirm that the web application you
   are inspecting is running. If necessary, restart the local development server
   or preview server, and open it directly in a browser to confirm it responds.
2. **Restart the MCP server**: Run the MCP server again with
   `npx -y @executeautomation/playwright-mcp-server` to reset the session. If it
   was already running, stop it and then restart it.
3. **Reinstall the Playwright browser**: Set the `PLAYWRIGHT_BROWSERS_PATH`
   environment variable that the MCP refers to, then run
   `npx playwright install chromium` to download the latest binary. For the
   path, you can use the MCP server's
   `node_modules/playwright-core/.local-browsers` or a similar location.
4. **Synchronise the version directory**: If the MCP expects a specific folder
   name (e.g. `chromium-1179`), update the symbolic link or modify the
   configuration file so that it matches the newly installed version path.
5. **Re-run the command and monitor**: After completing all of the steps above,
   run the Playwright MCP command again. If it is still delayed, additionally
   check environment variables such as network firewall, proxy and credential
   settings.

These five steps apply equally to other projects. In particular, when there has
been no response for more than 2 minutes, you must carry out the steps above in
order before reporting the issue.

## General Preparation Steps

### Option 1: Use the System Default Path (Recommended)

This is the simplest approach. Playwright uses the system default path
automatically.

1. **Install the browser binary**

   ```bash
   npx playwright install chromium
   ```

   It is installed automatically to the following path:
   - **macOS**: `~/Library/Caches/ms-playwright/`
   - **Linux**: `~/.cache/ms-playwright/`
   - **Windows**: `%USERPROFILE%\AppData\Local\ms-playwright\`

### Option 2: Specify a Custom Path (Advanced)

To install the browser to a specific path, use the `PLAYWRIGHT_BROWSERS_PATH`
environment variable.

1. **Install the browser binary (custom path)**

   ```bash
   PLAYWRIGHT_BROWSERS_PATH=<mcp-install-path>/node_modules/playwright-core/.local-browsers \
     npx playwright install chromium
   ```

2. **Align the version folder (if required)**

   If the MCP server expects a specific version, create a symbolic link:

   ```bash
   ln -sfn <actual-browser-path>/chromium-<installed-version> <expected-browser-path>/chromium-<previous-version>
   ```

**Note**: In most cases, Option 1 (system default path) is sufficient.

## Test Procedure

1. **Open the page**  
   Use the `playwright_navigate` tool to navigate to the URL under inspection.
   ```json
   { "url": "http://<host>:<port>/<path>", "timeout": 120000 }
   ```
2. **Button click / input interactions**
   - Click a button: `playwright_click`
     ```json
     { "selector": "button.primary" }
     ```
   - Enter text: `playwright_fill`
     ```json
     {
       "selector": "input[name=\"httpUrl\"]",
       "value": "http://<api-host>:<port>"
     }
     ```
   - Change a select box: `playwright_select`
     ```json
     { "selector": "select[name=\"authType\"]", "value": "<option-value>" }
     ```

3. **Capture a screenshot**  
   Save a full-page screenshot with `playwright_screenshot`.
   ```json
   { "name": "playwright-capture", "fullPage": true }
   ```
4. **Check text (optional)**  
   Calling `playwright_get_visible_text` lets you check the main text on the
   current screen.
   ```json
   {}
   ```
5. **Check console logs (if required)**  
   If you need browser console messages, use `playwright_console_logs`.

## Notes

- The MCP server is run with `npx -y @executeautomation/playwright-mcp-server`.
- All Playwright commands run through the MCP connection, so there is no need to
  write separate Playwright test files.
- If a browser initialisation error occurs, run `npx playwright install` or
  check the symbolic link in the default path.

### Example 1: shadcn-storybook-registry Project (Current Project)

#### Environment Information

- **Playwright version**: 1.56.0
- **MCP server**: @executeautomation/playwright-mcp-server@1.0.6
- **Chromium version**: 141.0.7390.37 (build v1194)
- **Browser installation path**: `~/Library/Caches/ms-playwright/chromium-1194`
- **Development server**: Storybook (http://localhost:6006)

#### Setup

1. **Install the browser** (using the system default path - recommended)

   ```bash
   npx playwright install chromium
   ```

   It is installed automatically to
   `~/Library/Caches/ms-playwright/chromium-1194`.

2. **Claude Code configuration**

   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["-y", "@executeautomation/playwright-mcp-server"],
         "disabled": false
       }
     }
   }
   ```

3. **Run the Storybook server**
   ```bash
   npm run storybook
   ```

#### Test Examples

**Color Story page test**:

```json
{
  "url": "http://localhost:6006/?path=/story/foundation-color--primary",
  "timeout": 120000
}
```

**Screenshot capture**:

```json
{ "name": "color-story-screenshot", "fullPage": true }
```

**Navigate to a specific story**:

```json
{
  "url": "http://localhost:6006/?path=/story/ui-button--default",
  "timeout": 60000
}
```

### Example 2: neo-flow-viz Project

#### Environment Information

- **Development server**: Vite Preview (http://127.0.0.1:4173)
- **Browser installation**: Custom path

#### Setup

- Example browser installation path (custom path specified)

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=/Users/tw.kim/.nvm/versions/node/v22.14.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/.local-browsers \
    npx playwright install chromium
  ```

- Example symbolic link when the MCP expects the `chromium-1179` path
  ```bash
  ln -sfn /Users/tw.kim/.nvm/.../.local-browsers/chromium-1193 \
         /Users/tw.kim/.nvm/.../.local-browsers/chromium-1179
  ```

#### Test Examples

- Frequently used Playwright MCP call example
  ```json
  { "url": "http://127.0.0.1:4173/test-6", "timeout": 120000 }
  ```
- Sample input/selector examples
  ```json
  { "selector": "input[name=\"httpUrl\"]", "value": "http://localhost:7474" }
  ```
  ```json
  { "selector": "select[name=\"authType\"]", "value": "bearer" }
  ```
