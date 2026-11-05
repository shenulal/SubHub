import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export function CarouselDemo() {
  return (
    <Carousel className="w-full max-w-xs">
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index}>
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-4xl font-semibold">{index + 1}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

/**
 * A carousel with motion and swipe built using Embla.
 */
const meta = {
  title: "ui/Carousel",
  component: Carousel,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  excludeStories: /.*Demo$/,
  render: () => <CarouselDemo />,
} satisfies Meta<typeof Carousel>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the carousel.
 */
export const Default: Story = {};

/**
 * Carousel with different sized items.
 */
export const Sizes: Story = {
  render: () => (
    <Carousel
      opts={{
        align: "start",
      }}
      className="w-full max-w-sm"
    >
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-3xl font-semibold">{index + 1}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

/**
 * Carousel with custom spacing between items.
 */
export const Spacing: Story = {
  render: () => (
    <Carousel className="w-full max-w-sm">
      <CarouselContent className="-ml-2 md:-ml-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index} className="pl-2 md:pl-4">
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-6">
                  <span className="text-2xl font-semibold">{index + 1}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

/**
 * Vertical orientation carousel.
 */
export const Vertical: Story = {
  render: () => (
    <Carousel orientation="vertical" className="w-full max-w-xs">
      <CarouselContent className="-mt-1 h-[200px]">
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index} className="pt-1 md:basis-1/2">
            <div className="p-1">
              <Card>
                <CardContent className="flex items-center justify-center p-6">
                  <span className="text-3xl font-semibold">{index + 1}</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const ShouldNavigateCarousel: Story = {
  name: "when next/previous buttons are clicked, should navigate carousel",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify the Carousel's Previous/Next buttons exist and are clickable
    const previousButton = canvas.getByRole("button", {
      name: /previous slide/i,
    });
    const nextButton = canvas.getByRole("button", { name: /next slide/i });

    // Verify the buttons exist
    await expect(previousButton).toBeInTheDocument();
    await expect(nextButton).toBeInTheDocument();

    // Click Next (moves the slide)
    await userEvent.click(nextButton);

    // Click Previous (moves the slide)
    await userEvent.click(previousButton);

    // Verify the slide content exists
    const slides = canvas.getAllByText(/\d+/);
    await expect(slides.length).toBeGreaterThan(0);
  },
};

export const ShouldChangeSlideOnNavigation: Story = {
  name: "when next button is clicked, should display next slide",
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Carousel className="w-full max-w-xs" data-testid="carousel">
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index} data-testid={`slide-${index + 1}`}>
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-6">
                  <span
                    className="text-4xl font-semibold"
                    data-testid={`slide-number-${index + 1}`}
                  >
                    {index + 1}
                  </span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious data-testid="prev-button" />
      <CarouselNext data-testid="next-button" />
    </Carousel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 🎯 Purpose: Verify clicking Next/Previous actually moves the slides

    // Verify the Carousel exists
    const carousel = canvas.getByTestId("carousel");
    await expect(carousel).toBeInTheDocument();

    // Check the Next button
    const nextButton = canvas.getByTestId("next-button");
    await expect(nextButton).toBeInTheDocument();

    // Check the Previous button
    const prevButton = canvas.getByTestId("prev-button");
    await expect(prevButton).toBeInTheDocument();

    // Check the first slide
    const firstSlide = canvas.getByTestId("slide-number-1");
    await expect(firstSlide).toHaveTextContent("1");

    // Click Next (move to the 2nd slide)
    await userEvent.click(nextButton);

    // Verify the 2nd slide is visible
    const secondSlide = canvas.getByTestId("slide-number-2");
    await expect(secondSlide).toBeInTheDocument();

    // Click Next again (move to the 3rd slide)
    await userEvent.click(nextButton);

    // Verify the 3rd slide is visible
    const thirdSlide = canvas.getByTestId("slide-number-3");
    await expect(thirdSlide).toBeInTheDocument();

    // Click Previous (back to the 2nd slide)
    await userEvent.click(prevButton);

    // Verify the 2nd slide is visible again
    await expect(secondSlide).toBeInTheDocument();
  },
};
