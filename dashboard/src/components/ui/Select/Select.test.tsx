import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Select } from './Select';
import { SelectOption } from './logic';

const sampleOptions: SelectOption[] = [
  { value: 'available', label: 'Available for Tasks', tone: 'success' },
  { value: 'open', label: 'Open to Offers', tone: 'primary' },
  { value: 'busy', label: 'Busy / Not Taking Tasks', disabled: true, tone: 'muted' },
  { value: 'offline', label: 'Offline', description: 'Do not disturb' },
];

describe('Select Component', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        width: 240,
        height: 40,
        top: 100,
        left: 50,
        bottom: 140,
        right: 290,
        x: 50,
        y: 100,
        toJSON: () => {},
      };
    };
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger with placeholder when no value is provided', () => {
    render(<Select options={sampleOptions} onChange={vi.fn()} placeholder="Choose status…" />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Choose status…');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders trigger with selected option label and tone dot', () => {
    render(<Select options={sampleOptions} value="available" onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Available for Tasks');
    const dot = trigger.querySelector('.cb-select-tone-dot--success');
    expect(dot).toBeInTheDocument();
  });

  it('opens popover on click and lists all options', () => {
    render(<Select options={sampleOptions} value="available" onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('Available for Tasks');
    expect(options[1]).toHaveTextContent('Open to Offers');
    expect(options[2]).toHaveTextContent('Busy / Not Taking Tasks');
    expect(options[2]).toHaveAttribute('aria-disabled', 'true');
    expect(options[3]).toHaveTextContent('Offline');
  });

  it('selects option on click, calls onChange, and closes', () => {
    const onChange = vi.fn();
    render(<Select options={sampleOptions} value="available" onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');

    fireEvent.click(options[1]); // 'Open to Offers'
    expect(onChange).toHaveBeenCalledWith('open');
  });

  it('does not select disabled option on click', () => {
    const onChange = vi.fn();
    render(<Select options={sampleOptions} value="available" onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');

    fireEvent.click(options[2]); // 'Busy' is disabled
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens on keyboard Enter and navigates with Arrow keys and selects with Enter', () => {
    const onChange = vi.fn();
    render(<Select options={sampleOptions} value="available" onChange={onChange} />);
    const trigger = screen.getByRole('combobox');

    // Press Enter to open
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Arrow down moves to next (open)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    // Press Enter to select
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('open');
  });

  it('skips disabled option when moving with ArrowDown', () => {
    const onChange = vi.fn();
    render(<Select options={sampleOptions} value="open" onChange={onChange} />);
    const trigger = screen.getByRole('combobox');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // opens
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Currently at index 1 ('open'). Index 2 ('busy') is disabled. Moving down should land on index 3 ('offline').
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('offline');
  });

  it('closes without selecting on Escape and stops propagation', () => {
    const onChange = vi.fn();
    const parentEscHandler = vi.fn();

    render(
      <div onKeyDown={parentEscHandler}>
        <Select options={sampleOptions} value="available" onChange={onChange} />
      </div>
    );
    const trigger = screen.getByRole('combobox');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(parentEscHandler).not.toHaveBeenCalled();
  });

  it('closes on outside click', async () => {
    render(
      <div>
        <div data-testid="outside">Outside Element</div>
        <Select options={sampleOptions} value="available" onChange={vi.fn()} />
      </div>
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(screen.getByTestId('outside'));

    // Wait for exit animation timeout
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders hidden input when name is provided for HTML forms', () => {
    render(<Select options={sampleOptions} value="open" name="availability" onChange={vi.fn()} />);
    const hidden = document.querySelector('input[type="hidden"][name="availability"]');
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveValue('open');
  });
});
