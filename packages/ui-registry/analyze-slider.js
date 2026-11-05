/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

async function analyzeSlider() {
  console.log("=== Starting Slider analysis ===\n");

  const browser = await chromium.launch({
    headless: false,
    devtools: true,
  });
  const page = await browser.newPage();

  try {
    // Navigate to the Storybook Slider docs page
    console.log("1. Loading the Storybook Slider page...");
    await page.goto("http://localhost:6006/?path=/docs/atoms-slider--docs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Find the Storybook iframe
    console.log("2. Searching for the iframe...");
    const iframe = page.frame({ url: /iframe\.html/ });

    if (!iframe) {
      throw new Error("Storybook iframe not found");
    }

    console.log("3. Analyzing Slider elements...\n");

    // Find the Slider container
    const sliderElements = await iframe.$$('[data-slot="slider"]');
    console.log(`   - Number of Slider elements: ${sliderElements.length}`);

    // Detailed analysis of the first Slider element
    if (sliderElements.length > 0) {
      const sliderInfo = await sliderElements[0].evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Inspect the Track element
        const track = el.querySelector('[data-slot="slider-track"]');
        const trackInfo = track
          ? {
              className: track.className,
              computedBg: window.getComputedStyle(track).backgroundColor,
              width: window.getComputedStyle(track).width,
              height: window.getComputedStyle(track).height,
              rect: track.getBoundingClientRect(),
            }
          : null;

        // Inspect the Range element
        const range = el.querySelector('[data-slot="slider-range"]');
        const rangeInfo = range
          ? {
              className: range.className,
              computedBg: window.getComputedStyle(range).backgroundColor,
              width: window.getComputedStyle(range).width,
              height: window.getComputedStyle(range).height,
              rect: range.getBoundingClientRect(),
            }
          : null;

        // Inspect the Thumb element
        const thumb = el.querySelector('[data-slot="slider-thumb"]');
        const thumbInfo = thumb
          ? {
              className: thumb.className,
              computedBg: window.getComputedStyle(thumb).backgroundColor,
              border: window.getComputedStyle(thumb).border,
              width: window.getComputedStyle(thumb).width,
              height: window.getComputedStyle(thumb).height,
            }
          : null;

        return {
          // Slider container info
          container: {
            className: el.className,
            width: computed.width,
            height: computed.height,
            display: computed.display,
            position: computed.position,
            actualDimensions: `${rect.width}x${rect.height}px`,
          },
          // Child element info
          track: trackInfo,
          range: rangeInfo,
          thumb: thumbInfo,
          // HTML structure
          innerHTML: el.innerHTML,
        };
      });

      console.log("=== Slider container info ===");
      console.log(JSON.stringify(sliderInfo.container, null, 2));
      console.log("\n=== Slider Track info ===");
      console.log(JSON.stringify(sliderInfo.track, null, 2));
      console.log("\n=== Slider Range info ===");
      console.log(JSON.stringify(sliderInfo.range, null, 2));
      console.log("\n=== Slider Thumb info ===");
      console.log(JSON.stringify(sliderInfo.thumb, null, 2));
    }

    // Tailwind class test
    console.log("\n4. Testing Tailwind CSS classes...");
    const tailwindTest = await iframe.evaluate(() => {
      const testColors = [
        "bg-gray-200",
        "bg-blue-600",
        "bg-primary",
        "bg-muted",
        "bg-background",
      ];
      const results = {};

      testColors.forEach((className) => {
        const div = document.createElement("div");
        div.className = className;
        document.body.appendChild(div);
        const color = window.getComputedStyle(div).backgroundColor;
        document.body.removeChild(div);
        results[className] = color;
      });

      return results;
    });

    console.log("=== Tailwind color class test results ===");
    console.log(JSON.stringify(tailwindTest, null, 2));

    // Save screenshots
    console.log("\n5. Saving screenshots...");
    await page.screenshot({
      path: "storybook-slider-full.png",
      fullPage: true,
    });

    // Capture only the iframe
    const sliderElement = await iframe.$('[data-slot="slider"]');
    if (sliderElement) {
      await sliderElement.screenshot({
        path: "storybook-slider-element.png",
      });
    }

    console.log("   - storybook-slider-full.png (full page)");
    console.log("   - storybook-slider-element.png (Slider element)");

    // Diagnose problems
    console.log("\n=== Diagnosis ===");

    const grayWorks = tailwindTest["bg-gray-200"] !== "rgba(0, 0, 0, 0)";
    const blueWorks = tailwindTest["bg-blue-600"] !== "rgba(0, 0, 0, 0)";

    if (grayWorks && blueWorks) {
      console.log("✅ Tailwind color classes work");
    } else {
      console.log("❌ Tailwind color classes do not work");
    }

    if (sliderElements.length === 0) {
      console.log("❌ Slider element not found");
    } else {
      console.log("✅ Slider element found");
    }

    console.log("\nAnalysis complete. The browser will close automatically in 10 seconds.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

// Run the script
console.log("Starting Slider analysis...\n");
analyzeSlider();
