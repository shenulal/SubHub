import { describe, expect, it } from "vitest";

import { revealWithinScrollParents } from "./reveal-within-scroll-parents";

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function place(el: HTMLElement, box: Box) {
  el.getBoundingClientRect = () =>
    ({
      ...box,
      width: box.right - box.left,
      height: box.bottom - box.top,
    }) as DOMRect;
}

function scroller(
  el: HTMLElement,
  axis: "x" | "y",
  size: { client: number; scroll: number }
) {
  if (axis === "y") {
    el.style.overflowY = "auto";
    Object.defineProperty(el, "clientHeight", { value: size.client });
    Object.defineProperty(el, "scrollHeight", { value: size.scroll });
  } else {
    el.style.overflowX = "auto";
    Object.defineProperty(el, "clientWidth", { value: size.client });
    Object.defineProperty(el, "scrollWidth", { value: size.scroll });
  }
}

function setup() {
  const outside = document.createElement("div");
  const root = document.createElement("div");
  const nav = document.createElement("nav");
  const item = document.createElement("a");
  outside.appendChild(root);
  root.appendChild(nav);
  nav.appendChild(item);
  document.body.appendChild(outside);
  return { outside, root, nav, item };
}

describe("revealWithinScrollParents", () => {
  it("scrolls a vertical menu down just enough to show an item below the fold", () => {
    const { root, item } = setup();
    scroller(root, "y", { client: 400, scroll: 900 });
    place(root, { top: 100, bottom: 500, left: 0, right: 260 });
    place(item, { top: 520, bottom: 570, left: 0, right: 260 });

    revealWithinScrollParents(item, root);

    expect(root.scrollTop).toBe(70);
  });

  it("scrolls up when the item is above the visible part", () => {
    const { root, item } = setup();
    scroller(root, "y", { client: 400, scroll: 900 });
    root.scrollTop = 200;
    place(root, { top: 100, bottom: 500, left: 0, right: 260 });
    place(item, { top: 40, bottom: 90, left: 0, right: 260 });

    revealWithinScrollParents(item, root);

    expect(root.scrollTop).toBe(140);
  });

  it("scrolls a horizontal chip row to show the active chip", () => {
    const { root, nav, item } = setup();
    scroller(nav, "x", { client: 600, scroll: 1400 });
    place(nav, { top: 0, bottom: 50, left: 0, right: 600 });
    place(root, { top: 0, bottom: 50, left: 0, right: 600 });
    place(item, { top: 0, bottom: 50, left: 700, right: 820 });

    revealWithinScrollParents(item, root);

    expect(nav.scrollLeft).toBe(220);
  });

  it("leaves visible items and containers outside the root alone", () => {
    const { outside, root, item } = setup();
    scroller(root, "y", { client: 400, scroll: 900 });
    scroller(outside, "y", { client: 100, scroll: 2000 });
    place(outside, { top: 0, bottom: 100, left: 0, right: 260 });
    place(root, { top: 100, bottom: 500, left: 0, right: 260 });
    place(item, { top: 150, bottom: 200, left: 0, right: 260 });

    revealWithinScrollParents(item, root);

    expect(root.scrollTop).toBe(0);
    expect(outside.scrollTop).toBe(0);
  });
});
