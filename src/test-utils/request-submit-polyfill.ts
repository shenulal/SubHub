/**
 * JSDOM does not implement HTMLFormElement.requestSubmit, so this polyfill
 * prevents errors when tests/Storybook submit a form.
 */
export function applyRequestSubmitPolyfill() {
  if (typeof HTMLFormElement === "undefined") return;

  Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
    value: function submitPolyfill(this: HTMLFormElement) {
      this.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true })
      );
    },
    writable: true,
    configurable: true,
  });
}
