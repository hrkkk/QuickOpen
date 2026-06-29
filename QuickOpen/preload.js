const fs = require("node:fs");
const { spawn } = require("node:child_process");

function validateCommandOptions(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("缺少指令参数");
  }

  const command = typeof options.command === "string" ? options.command.trim() : "";
  const cwd = typeof options.cwd === "string" ? options.cwd.trim() : "";

  if (!command) {
    throw new TypeError("指令内容不能为空");
  }
  if (command.length > 32768) {
    throw new RangeError("指令内容过长");
  }
  if (cwd && (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory())) {
    throw new Error("工作目录不存在或不是文件夹");
  }

  return {
    command,
    cwd: cwd || process.cwd(),
    runAsAdmin: options.runAsAdmin === true
  };
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function spawnInBackground(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      detached: true,
      stdio: "ignore"
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve({ elevated: false });
    });
  });
}

function spawnAsAdministrator(command, cwd) {
  if (process.platform !== "win32") {
    return Promise.reject(new Error("管理员身份执行目前仅支持 Windows"));
  }

  const elevatedScript = [
    `Set-Location -LiteralPath ${quotePowerShellLiteral(cwd)}`,
    `$command = ${quotePowerShellLiteral(command)}`,
    "& $env:ComSpec /d /s /c $command"
  ].join("; ");
  const encodedCommand = Buffer.from(elevatedScript, "utf16le").toString("base64");
  const script = [
    `$arguments = @('-NoLogo', '-NoProfile', '-EncodedCommand', ${quotePowerShellLiteral(encodedCommand)})`,
    "Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -Verb RunAs"
  ].join("; ");

  return new Promise((resolve, reject) => {
    const launcher = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        stdio: "ignore"
      }
    );

    launcher.once("error", reject);
    launcher.once("close", (code) => {
      if (code === 0) {
        resolve({ elevated: true });
        return;
      }
      reject(new Error("管理员授权被取消或启动失败"));
    });
  });
}

async function executeCommand(options) {
  const { command, cwd, runAsAdmin } = validateCommandOptions(options);
  return runAsAdmin
    ? spawnAsAdministrator(command, cwd)
    : spawnInBackground(command, cwd);
}

Object.defineProperty(window, "quickOpenSystem", {
  value: Object.freeze({
    platform: process.platform,
    executeCommand
  }),
  writable: false,
  configurable: false
});
