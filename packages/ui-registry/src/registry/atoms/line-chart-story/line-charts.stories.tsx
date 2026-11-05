import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { ChartContainer } from "@/components/ui/chart";

// Import all line chart components
import { ChartLineDefault } from "./line-chart-default";
import { ChartLineDots } from "./line-chart-dots";
import { ChartLineDotsColors } from "./line-chart-dots-colors";
import { ChartLineDotsCustom } from "./line-chart-dots-custom";
import { ChartLineInteractive } from "./line-chart-interactive";
import { ChartLineLabel } from "./line-chart-label";
import { ChartLineLabelCustom } from "./line-chart-label-custom";
import { ChartLineLinear } from "./line-chart-linear";
import { ChartLineMultiple } from "./line-chart-multiple";
import { ChartLineStep } from "./line-chart-step";

const meta = {
  title: "ui/Chart/Line Charts",
  component: ChartContainer,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default Line Chart. It connects data changes over time with a line,
 * making trends and patterns easy to read. Best suited to time-series analysis.
 */
export const Default: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineDefault />,
};

/**
 * An interactive Line Chart. It shows detailed values in a tooltip on hover
 * and responds to interactions such as clicks. Suited to dashboards that need dynamic data exploration.
 */
export const Interactive: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineInteractive />,
};

/**
 * A Line Chart with linear interpolation. Connecting data points with straight lines
 * gives a clear, simple visualization. Use it to show exact changes in value.
 */
export const Linear: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineLinear />,
};

/**
 * A step Line Chart. Connecting data points in steps
 * represents data that holds a constant value per interval. Suited to state changes and event-based data.
 */
export const Step: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineStep />,
};

/**
 * A Line Chart with multiple data series. It compares several trends at once,
 * distinguishing each line by color. Effective for competitive analysis or monitoring multiple metrics.
 */
export const Multiple: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineMultiple />,
};

/**
 * A Line Chart with dots on the data points. Highlighting each point with a dot
 * shows exactly where each measurement sits. Suited to analysis where individual points matter.
 */
export const Dots: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineDots />,
};

/**
 * A Line Chart with custom-styled dots. Customizing dot size, color and shape
 * can highlight specific points or match a brand style. Used for tailored visualizations.
 */
export const DotsCustom: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineDotsCustom />,
};

/**
 * A Line Chart with multi-colored dots. Coloring each data point by condition
 * visually separates thresholds or categories. Effective for conditional data analysis.
 */
export const DotsColors: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineDotsColors />,
};

/**
 * A Line Chart with labels. Adding value labels to key data points
 * lets users read exact figures directly. Useful for highlighting key metrics or outliers.
 */
export const Label: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineLabel />,
};

/**
 * A Line Chart with custom labels. Customizing label format, position and style
 * can match brand requirements or special notation. Suited to tailored presentations.
 */
export const LabelCustom: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineLabelCustom />,
};

export const ShouldRenderChart: Story = {
  name: "when chart is rendered, should display chart container and content",
  tags: ["!dev", "!autodocs"],
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartLineDefault />,
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Verify the Line chart renders correctly and the Chart container exists

    // Verify ChartContainer has rendered
    const chartContainer = canvasElement.querySelector("[data-chart]");
    await expect(chartContainer).toBeInTheDocument();
  },
};
