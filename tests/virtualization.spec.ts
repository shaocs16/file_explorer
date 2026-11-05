import { expect, test } from "@playwright/test";

test("large listings render only visible rows and search reaches the end", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        invoke: async (command: string) => {
          if (command === "get_locations")
            return [{ name: "Documentos", path: "C:\\data", kind: "folder" }];
          if (command === "read_directory")
            return {
              path: "C:\\data",
              parent: "C:\\",
              warnings: [],
              entries: Array.from({ length: 10000 }, (_, i) => ({
                name: `Archivo ${i}.txt`,
                path: `C:\\data\\Archivo ${i}.txt`,
                isDirectory: false,
                isSymlink: false,
                hidden: false,
                size: i,
                modified: null,
                error: null,
              })),
            };
          throw new Error("Unexpected command");
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("10000 elementos en esta ubicacion"),
  ).toBeVisible();
  expect(await page.locator(".file-row").count()).toBeLessThan(100);
  await page.locator(".file-scroll").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    page.getByRole("button", { name: "Archivo 9999.txt, TXT" }),
  ).toBeVisible();
  expect(await page.locator(".file-row").count()).toBeLessThan(100);
});
