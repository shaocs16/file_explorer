import { expect, test } from "@playwright/test";

test("browse, search, inspect, and recover from invalid paths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Documentos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Vista de demostracion", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ideas de producto.md, MD" }).click();
  await expect(
    page.getByRole("heading", { name: "Ideas de producto.md" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar en todo el equipo" })
    .fill("presupuesto");
  await expect(
    page.getByRole("button", { name: "Presupuesto 2026.xlsx, XLSX" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Proyectos, carpeta" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Limpiar busqueda", exact: true })
    .click();
  await page.getByRole("button", { name: "Proyectos, carpeta" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Proyectos", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Una carpeta despejada")).toBeVisible();
  await page.getByRole("button", { name: "Atras", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Documentos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Ruta de la carpeta" })
    .fill("C:\\missing");
  await page
    .getByRole("textbox", { name: "Ruta de la carpeta" })
    .press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "no existe en la demostracion",
  );
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Proyectos, carpeta" }),
  ).toBeVisible();
});

test("tabs, hidden files, keyboard, theme and small windows", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Documentos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ocultos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: ".config, CONFIG" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nueva pestana" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar pestana Documentos" }),
  ).toHaveCount(2);
  await page.keyboard.press("Control+f");
  await expect(
    page.getByRole("textbox", { name: "Buscar en todo el equipo" }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Usar tema/ }).click();
  for (const width of [1440, 900, 680, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/senda-${width}.png` });
  }
});
