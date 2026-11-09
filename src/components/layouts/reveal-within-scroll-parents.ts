/**
 * Scrolls every scrollable ancestor of `element`, up to and including `root`,
 * just enough to make `element` fully visible ("nearest"). Unlike
 * `Element.scrollIntoView` it never scrolls the window or anything above `root`.
 */
export function revealWithinScrollParents(
  element: HTMLElement,
  root: HTMLElement
): void {
  let parent = element.parentElement;
  while (parent) {
    revealInside(element, parent);
    if (parent === root) return;
    parent = parent.parentElement;
  }
}

function isScrollable(overflow: string): boolean {
  return overflow === "auto" || overflow === "scroll";
}

function revealInside(element: HTMLElement, container: HTMLElement): void {
  const style = getComputedStyle(container);
  const target = element.getBoundingClientRect();
  const box = container.getBoundingClientRect();

  if (
    isScrollable(style.overflowY) &&
    container.scrollHeight > container.clientHeight
  ) {
    if (target.top < box.top) container.scrollTop -= box.top - target.top;
    else if (target.bottom > box.bottom)
      container.scrollTop += target.bottom - box.bottom;
  }
  if (
    isScrollable(style.overflowX) &&
    container.scrollWidth > container.clientWidth
  ) {
    if (target.left < box.left) container.scrollLeft -= box.left - target.left;
    else if (target.right > box.right)
      container.scrollLeft += target.right - box.right;
  }
}
