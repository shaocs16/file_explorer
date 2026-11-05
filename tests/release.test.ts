import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync("tauri.conf.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const cargo = readFileSync("Cargo.toml", "utf8");

describe("Windows desktop distribution", () => {
  it("forwards Cargo flags past npm and Tauri argument parsers", () => {
    const script = readFileSync("scripts/release-windows.ps1", "utf8");
    expect(script).toContain(
      '@("run", "desktop:build", "--", "--", "--locked")',
    );
  });
  it("uses one version and includes an installer and real icons", () => {
    expect(config.version).toBe(pkg.version);
    expect(cargo).toContain(`version = "${pkg.version}"`);
    expect(config.bundle.active).toBe(true);
    expect(config.bundle.targets).toEqual(["nsis"]);
    for (const icon of config.bundle.icon) expect(existsSync(icon)).toBe(true);
    expect(existsSync(config.bundle.windows.nsis.installerHooks)).toBe(true);
    expect(config.bundle.windows.nsis.installMode).toBe("currentUser");
  });

  it("bundles the frontend with the production protocol instead of requiring Vite", () => {
    expect(config.build.frontendDist).toBe("./dist");
    expect(config.build.features).toContain("desktop");
    expect(pkg.scripts["desktop:build"]).toContain(
      "--features custom-protocol",
    );
    expect(cargo).toContain('"tauri/custom-protocol"');
    expect(config.app.windows[0].label).toBe("main");
  });
});
