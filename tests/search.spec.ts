import { expect, test } from "@playwright/test";

test("searches outside the open folder and combines type filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Descargas", exact: true }).click();
  await expect(page.getByText("Una carpeta despejada")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar en todo el equipo" })
    .fill("Guia");
  await expect(
    page.getByRole("button", { name: "Guia de identidad.pdf, PDF" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Buscar en el equipo" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filtrar por tipo" })
    .selectOption("images");
  await expect(
    page.getByText("Sin coincidencias", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filtrar por tipo" })
    .selectOption("documents");
  await page
    .getByRole("button", { name: "Guia de identidad.pdf, PDF" })
    .click();
  await page
    .getByRole("button", { name: "Abrir ubicacion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Documentos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filtrar por tipo" })
    .selectOption("folders");
  await expect(
    page.getByRole("button", { name: "Proyectos, carpeta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guia de identidad.pdf, PDF" }),
  ).toHaveCount(0);
});

test("cancels during debounce without starting a search", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Buscar en todo el equipo" })
    .fill("report");
  await page.getByRole("button", { name: "Cancelar busqueda" }).click();
  await expect(
    page.getByText("Busqueda cancelada", { exact: false }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await expect(
    page.getByText("Busqueda cancelada", { exact: false }),
  ).toBeVisible();
});
