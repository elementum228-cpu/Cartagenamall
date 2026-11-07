import { describe, expect, it } from "vitest";
import {
  boardHasContent,
  boardWhen,
  cleanBoard,
  emptyBoard,
  resolveBoard,
} from "../src/stadium/board";

describe("cartel del estadio", () => {
  it("un cartel vacío no tiene contenido", () => {
    expect(boardHasContent(emptyBoard())).toBe(false);
    expect(boardHasContent(null)).toBe(false);
  });
  it("con un nombre, un escudo o una imagen sí", () => {
    expect(boardHasContent({ ...emptyBoard(), image: "x.jpg" })).toBe(true);
    expect(
      boardHasContent({ ...emptyBoard(), home: { name: "Real", crest: null } }),
    ).toBe(true);
    expect(
      boardHasContent({ ...emptyBoard(), away: { name: "", crest: "c.png" } }),
    ).toBe(true);
  });
  it("el cartel del evento manda; sin contenido, el general", () => {
    const general = { ...emptyBoard(), caption: "general" };
    const ev = { board: { ...emptyBoard(), image: "a.jpg" } };
    expect(resolveBoard(ev, general).image).toBe("a.jpg");
    expect(resolveBoard({ board: emptyBoard() }, general).caption).toBe(
      "general",
    );
    expect(resolveBoard(null, general)).toBe(general);
  });
  it("limpia datos incompletos de la base de datos", () => {
    expect(cleanBoard(undefined)).toEqual(emptyBoard());
    expect(cleanBoard({ home: { name: "A" }, image: 5 }).home).toEqual({
      name: "A",
      crest: null,
    });
    expect(cleanBoard({ image: 5 }).image).toBeNull();
  });
  it("da fecha legible o vacío", () => {
    expect(boardWhen("no es fecha")).toBe("");
    expect(boardWhen(undefined)).toBe("");
    expect(boardWhen("2026-11-14T20:00:00-05:00")).toMatch(/\d/);
  });
});
