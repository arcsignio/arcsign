import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/PasswordInput';

describe('PasswordInput', () => {
  it('masks the value by default', () => {
    render(<PasswordInput aria-label="pw" defaultValue="hunter2" />);
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password');
  });

  it('reveals the value when the toggle is clicked, and re-masks on a second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="pw" defaultValue="hunter2" />);

    const field = screen.getByLabelText('pw');
    const toggle = screen.getByRole('button');

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'text');

    await user.click(toggle);
    expect(field).toHaveAttribute('type', 'password');
  });

  it('starts masked on every mount so a revealed field never leaks across sessions', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PasswordInput aria-label="pw" />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'text');
    unmount();

    render(<PasswordInput aria-label="pw" />);
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password');
  });

  it('forwards typing to onChange (controlled usage)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordInput aria-label="pw" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText('pw'), 'abc');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('registers with react-hook-form via the forwarded ref', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    function Form() {
      const { register, handleSubmit } = useForm<{ password: string }>();
      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <PasswordInput aria-label="pw" {...register('password')} />
          <button type="submit">go</button>
        </form>
      );
    }

    render(<Form />);
    await user.type(screen.getByLabelText('pw'), 'secret');
    await user.click(screen.getByRole('button', { name: 'go' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'secret' }),
      expect.anything()
    );
  });

  it('disables the toggle when the field is disabled', () => {
    render(<PasswordInput aria-label="pw" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('keeps caller-supplied props, including className', () => {
    render(<PasswordInput aria-label="pw" className="password-input" placeholder="enter" />);
    const field = screen.getByLabelText('pw');
    expect(field).toHaveClass('password-input');
    expect(field).toHaveAttribute('placeholder', 'enter');
  });
});
