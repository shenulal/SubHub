import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 🎯 Purpose: Script that automatically adds Figma URLs to Storybook story files
 *
 * It reads Figma URL information from figma-mapping.json
 * and adds a design parameter to each story file's meta object.
 */

interface FigmaData {
  url: string;
  nodeId: string;
  componentSetName: string;
}

interface FigmaMapping {
  [key: string]: FigmaData;
}

// Load the Figma URL mapping data
const figmaMapping = JSON.parse(
  readFileSync("scripts/figma-mapping.json", "utf-8"),
) as FigmaMapping;

// Add the Figma URL to each story file
Object.entries(figmaMapping).forEach(
  ([storyName, figmaData]: [string, FigmaData]) => {
    // Resolve the story file path
    let storyPath: string;
    const componentName = storyName.replace("-story", "");

    // Path mapping rules
    if (storyName.includes("chart")) {
      // Chart stories live in the chart-story folder
      storyPath = `src/registry/atoms/chart-story/${componentName}.stories.tsx`;
    } else if (
      ["color", "typography", "spacing", "shadow", "radius"].includes(
        componentName,
      )
    ) {
      // Token stories
      storyPath = `src/registry/tokens/${storyName}/${componentName}.stories.tsx`;
    } else if (storyName === "typography-components-story") {
      // Foundation stories
      storyPath =
        "src/registry/foundation/typography-components-story/typography-components.stories.tsx";
    } else if (storyName === "dashboard-template-story") {
      // Template stories
      storyPath =
        "src/registry/templates/dashboard-template-story/dashboard-template.stories.tsx";
    } else {
      // Regular atoms
      storyPath = `src/registry/atoms/${storyName}/${componentName}.stories.tsx`;
    }

    try {
      const fullPath = join(process.cwd(), storyPath);
      let content = readFileSync(fullPath, "utf-8");

      // Check whether a Figma URL already exists
      if (content.includes("design:")) {
        console.log(`⏭️  Skipped: ${storyName} (Figma URL already present)`);
        return;
      }

      // Add the design parameter to the meta object
      // Handle the case where parameters already exist
      const parametersMatch = content.match(/parameters:\s*{([^}]*)}/);

      if (parametersMatch) {
        // parameters already exist - add the design field
        const oldParameters = parametersMatch[0];
        const newParameters = oldParameters.replace(
          /parameters:\s*{/,
          `parameters: {\n    design: {\n      type: "figma",\n      url: "${figmaData.url}",\n    },`,
        );
        content = content.replace(oldParameters, newParameters);
      } else {
        // No parameters - add the parameters object itself
        const metaRegex = /(const meta.*?=\s*{[\s\S]*?)(tags:\s*\[.*?\],)/;
        content = content.replace(
          metaRegex,
          `$1$2\n  parameters: {\n    design: {\n      type: "figma",\n      url: "${figmaData.url}",\n    },\n  },`,
        );
      }

      writeFileSync(fullPath, content);
      console.log(`✅ Success: ${storyName}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Error: ${storyName} - ${errorMessage}`);
    }
  },
);

console.log("\n🎉 Finished adding Figma URLs!");
console.log("⚠️  Note: node-id must be updated to the real values.");
