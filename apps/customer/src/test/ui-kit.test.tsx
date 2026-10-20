import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, ThemeToggle, Badge, Button } from '@bmw/ui';

describe('@bmw/ui kit', () => {
  it('renders primitives', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('cycles and persists the theme preference', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole('button', { name: /click to switch/ });
    expect(document.documentElement.dataset.theme).toBe('light'); // system stub => light
    await user.click(toggle);
    expect(localStorage.getItem('bmw-theme')).toBe('light');
    await user.click(toggle);
    expect(localStorage.getItem('bmw-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
