import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { ChartContainer } from "@/components/ui/chart";
import { ChartRadarDefault } from "./radar-chart-default";
import { ChartRadarDots } from "./radar-chart-dots";
import { ChartRadarGridCircle } from "./radar-chart-grid-circle";
import { ChartRadarGridCircleFill } from "./radar-chart-grid-circle-fill";
import { ChartRadarGridCircleNoLines } from "./radar-chart-grid-circle-no-lines";
import { ChartRadarGridCustom } from "./radar-chart-grid-custom";
import { ChartRadarGridFill } from "./radar-chart-grid-fill";
import { ChartRadarGridNone } from "./radar-chart-grid-none";
import { ChartRadarLabelCustom } from "./radar-chart-label-custom";
import { ChartRadarLegend } from "./radar-chart-legend";
import { ChartRadarLinesOnly } from "./radar-chart-lines-only";
import { ChartRadarMultiple } from "./radar-chart-multiple";

const meta = {
  title: "ui/Chart/Radar Charts",
  component: ChartContainer,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default Radar Chart. It visualizes desktop visitor data as a polygon
 * and compares several metrics at once. Suited to performance analysis and multi-dimensional data.
 */
export const RadarDefault: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarDefault />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with dots on the data points. Highlighting each metric's exact position with a dot
 * makes values clearer. Use it when detailed analysis is needed.
 */
export const RadarDots: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarDots />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A lines-only Radar Chart. Showing outlines without fill
 * improves readability when overlaying several series. Suited to complex comparisons.
 */
export const RadarLinesOnly: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarLinesOnly />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with custom labels. Customizing the axis label format
 * presents the data more intuitively. Use it when special units or notation are needed.
 */
export const RadarLabelCustom: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarLabelCustom />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with a custom grid. Adjusting grid spacing, color and style
 * improves readability. Suited to customizing for a brand identity.
 */
export const RadarGridCustom: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridCustom />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart without a grid. Removing the background grid highlights only the data area
 * for a minimal design. Suited to presentations or wherever visual simplicity is needed.
 */
export const RadarGridNone: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridNone />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with a circular grid. Using concentric circles instead of the default polygon
 * shows distance from the center more intuitively. Suited to analyzing evenly distributed data.
 */
export const RadarGridCircle: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridCircle />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A circular-grid Radar Chart without radial lines. Showing only the concentric circles
 * gives a cleaner visualization. Useful for reducing visual noise when axis labels suffice.
 */
export const RadarGridCircleNoLines: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridCircleNoLines />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A filled circular-grid Radar Chart. Filling the data area alongside the concentric grid
 * visually emphasizes each metric's range. Effective for seeing the overall distribution.
 */
export const RadarGridCircleFill: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridCircleFill />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A filled Radar Chart. Filling the data area alongside the polygon grid
 * shows each axis's performance at a glance. Suited to overall performance comparison and reporting.
 */
export const RadarGridFill: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarGridFill />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with multiple data series. Overlaying two or more datasets
 * allows direct comparison. Effective for competitor analysis or time-series comparison.
 */
export const RadarMultiple: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarMultiple />,
  parameters: {
    layout: "fullscreen",
  },
};

/**
 * A Radar Chart with a legend. Adding a legend to distinguish the series
 * makes each dataset's meaning clear. Essential for complex multi-series comparisons.
 */
export const RadarLegend: Story = {
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarLegend />,
  parameters: {
    layout: "fullscreen",
  },
};

export const ShouldRenderChart: Story = {
  name: "when chart is rendered, should display chart container and content",
  tags: ["!dev", "!autodocs"],
  args: {
    config: {},
    children: <div />,
  },
  render: () => <ChartRadarDefault />,
  play: async ({ canvasElement }) => {
    // 🎯 Purpose: Verify the Radar chart renders correctly and the Chart container exists

    // Verify ChartContainer has rendered
    const chartContainer = canvasElement.querySelector("[data-chart]");
    await expect(chartContainer).toBeInTheDocument();
  },
  parameters: {
    layout: "fullscreen",
  },
};
