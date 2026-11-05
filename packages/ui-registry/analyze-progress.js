/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");

async function analyzeProgressBar() {
  console.log("=== Starting Progress Bar analysis ===\n");

  const browser = await chromium.launch({
    headless: false,
    devtools: true,
  });
  const page = await browser.newPage();

  try {
    // Navigate to the Storybook Progress docs page
    console.log("1. Loading the Storybook page...");
    await page.goto("http://localhost:6006/?path=/docs/atoms-progress--docs");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Find the Storybook iframe
    console.log("2. Searching for the iframe...");
    const iframe = page.frame({ url: /iframe\.html/ });

    if (!iframe) {
      throw new Error("Storybook iframe not found");
    }

    console.log("3. Analyzing Progress elements...\n");

    // Find the Progress container
    const progressElements = await iframe.$$('[data-slot="progress"]');
    console.log(`   - Number of Progress elements: ${progressElements.length}`);

    // Detailed analysis of the first Progress element
    if (progressElements.length > 0) {
      const progressInfo = await progressElements[0].evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Inspect the child elements
        const indicator = el.querySelector('[data-slot="progress-indicator"]');
        const indicatorInfo = indicator
          ? {
              className: indicator.className,
              style: indicator.getAttribute("style"),
              computedBg: window.getComputedStyle(indicator).backgroundColor,
              transform: window.getComputedStyle(indicator).transform,
              width: window.getComputedStyle(indicator).width,
              height: window.getComputedStyle(indicator).height,
            }
          : null;

        return {
          // Progress container info
          container: {
            className: el.className,
            width: computed.width,
            height: computed.height,
            backgroundColor: computed.backgroundColor,
            display: computed.display,
            position: computed.position,
            overflow: computed.overflow,
            actualDimensions: `${rect.width}x${rect.height}px`,
          },
          // Progress indicator info
          indicator: indicatorInfo,
          // HTML structure
          innerHTML: el.innerHTML,
          outerHTML: el.outerHTML,
        };
      });

      console.log("=== Progress container info ===");
      console.log(JSON.stringify(progressInfo.container, null, 2));
      console.log("\n=== Progress indicator info ===");
      console.log(JSON.stringify(progressInfo.indicator, null, 2));
    }

    // Tailwind class test
    console.log("\n4. Testing Tailwind CSS classes...");
    const tailwindTest = await iframe.evaluate(() => {
      const testColors = [
        "bg-gray-200",
        "bg-blue-600",
        "bg-primary",
        "bg-muted",
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

    // Check CSS variables
    console.log("\n5. Checking CSS variables...");
    const cssVars = await iframe.evaluate(() => {
      const root = document.documentElement;
      const computed = window.getComputedStyle(root);
      return {
        "--primary": computed.getPropertyValue("--primary"),
        "--muted": computed.getPropertyValue("--muted"),
        "--color-primary": computed.getPropertyValue("--color-primary"),
        "--color-muted": computed.getPropertyValue("--color-muted"),
        "--background": computed.getPropertyValue("--background"),
        "--foreground": computed.getPropertyValue("--foreground"),
      };
    });

    console.log("=== CSS variable values ===");
    console.log(JSON.stringify(cssVars, null, 2));

    // Save screenshots
    console.log("\n6. Saving screenshots...");
    await page.screenshot({
      path: "storybook-progress-full.png",
      fullPage: true,
    });
    await iframe.screenshot({
      path: "storybook-progress-iframe.png",
    });

    console.log("   - storybook-progress-full.png (full page)");
    console.log("   - storybook-progress-iframe.png (iframe content)");

    // Diagnose problems
    console.log("\n=== Diagnosis ===");

    // Whether Tailwind classes work
    const grayWorks = tailwindTest["bg-gray-200"] !== "rgba(0, 0, 0, 0)";
    const blueWorks = tailwindTest["bg-blue-600"] !== "rgba(0, 0, 0, 0)";

    if (grayWorks && blueWorks) {
      console.log("✅ Tailwind default color classes work");
    } else {
      console.log("❌ Tailwind color classes do not work");
    }

    if (progressElements.length === 0) {
      console.log("❌ Progress element not found");
    } else {
      console.log("✅ Progress element found");
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
console.log("Starting Progress bar analysis...\n");
analyzeProgressBar();
