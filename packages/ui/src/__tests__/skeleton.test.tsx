import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton, CardSkeleton, ListSkeleton } from '../components/skeleton.js';

describe('Skeleton', () => {
  it('renders without throwing and applies base + passed classes', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('h-4');
  });

  it('CardSkeleton renders', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('ListSkeleton renders the requested number of cards', () => {
    const { container } = render(<ListSkeleton count={4} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.childElementCount).toBe(4);
  });
});
