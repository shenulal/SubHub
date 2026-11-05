import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { ChartContainer } from "@/components/ui/chart";

// Import all pie chart components
import { ChartPieDonut } from "./pie-chart-donut";
import { ChartPieDonutActive } from "./pie-chart-donut-active";
import { ChartPieDonutText } from "./pie-chart-donut-text";
import { ChartPieInteractive } from "./pie-chart-interactive";
import { ChartPieLabel } from "./pie-chart-label";
import { ChartPieLabelCustom } from "./pie-chart-label-custom";
import { ChartPieLabelList } from "./pie-chart-label-list";
import { ChartPieLegend } from "./pie-chart-legend";
import { ChartPieSeparatorNone } from "./pie-chart-separator-none";
import { ChartPieSimple } from "./pie-chart-simple";
import { ChartPieStacked } from "./pie-chart-stacked";

const meta = {
  title: "ui/Chart/Pie Charts",
  component: ChartContainer,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default Pie Chart. It shows each item's share of the whole as a circle,
 * making the composition of the data easy to read. Suited to analyzing distribution by category.
 */
export const Simple: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieSimple />,
};

/**
 * A Pie Chart without separators. Removing the borders between slices
 * gives a softer, more minimal design. Suited to dashboards that need visual simplicity.
 */
export const SeparatorNone: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieSeparatorNone />,
};

/**
 * A Pie Chart with labels. Adding a data label to each slice
 * shows exact values or percentages directly. Use it when detailed figures matter.
 */
export const Label: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieLabel />,
};

/**
 * A Pie Chart with custom labels. Customizing label format, position and style
 * adapts it to a brand or purpose. Use it when special notation or design is required.
 */
export const LabelCustom: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieLabelCustom />,
};

/**
 * A Pie Chart with a label list. Showing every item's label at once
 * makes the overall composition quick to grasp. Useful for data with many categories.
 */
export const LabelList: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieLabelList />,
};

/**
 * A Pie Chart with a legend. Placing the legend outside the chart
 * makes clear which category each color represents. Suited to standard chart layouts.
 */
export const Legend: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieLegend />,
};

/**
 * A Donut Chart. A circular chart with a hollow center that shows proportions;
 * the center can hold a total or extra information. Suited to modern designs.
 */
export const Donut: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieDonut />,
};

/**
 * A Donut Chart with an active state. It can highlight a slice or show a selection,
 * giving visual feedback in response to user interaction. Suited to interactive dashboards.
 */
export const DonutActive: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieDonutActive />,
};

/**
 * A Donut Chart with text in the center. Placing a total, average or title in the hollow center
 * conveys extra information effectively. Used for KPIs and summary dashboards.
 */
export const DonutText: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieDonutText />,
};

/**
 * A nested Pie Chart. Showing several levels of data as concentric rings
 * visualizes parent-child category relationships. Effective for hierarchical data.
 */
export const Stacked: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieStacked />,
};

/**
 * An interactive Pie Chart. It responds to user interactions such as hover and click,
 * offering dynamic data exploration. Suited to analysis tools that need drill-down.
 */
export const Interactive: Story = {
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieInteractive />,
};

export const ShouldRenderChart: Story = {
  name: "when chart is rendered, should display chart container and content",
  tags: ["!dev", "!autodocs"],
  // @ts-expect-error - The Storybook type system does not correctly handle the combination of component: ChartContainer and a render function
  args: {},
  render: () => <ChartPieSimple />,
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Verify the Pie chart renders correctly and the Chart container exists

    // Verify ChartContainer has rendered
    const chartContainer = canvasElement.querySelector("[data-chart]");
    await expect(chartContainer).toBeInTheDocument();
  },
};
