/**
 * PasswordInput — a password field with a show/hide toggle.
 *
 * Typing a password blind is where wallet creation goes wrong: a typo in the
 * password you are *setting* is unrecoverable, and the confirm field only tells
 * you the two differ, not which one is wrong. The eye toggle lets the user
 * verify what they typed.
 *
 * Drop-in for `<input type="password">`. Accepts every native input prop, so
 * both call styles in this codebase work unchanged:
 *
 *   // controlled
 *   <PasswordInput value={pw} onChange={e => setPw(e.target.value)} />
 *
 *   // react-hook-form
 *   <PasswordInput {...register('password')} />
 *
 * Visibility is local state and always starts hidden — it never persists across
 * mounts, so a revealed field cannot leak into a later session.
 */

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, style, disabled, ...rest }, ref) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);

    return (
      <span className="pw-field">
        <input
          {...rest}
          ref={ref}
          disabled={disabled}
          type={revealed ? "text" : "password"}
          className={className}
          style={{ ...style, paddingRight: "2.75rem" }}
        />
        <button
          type="button"
          className="pw-field__toggle"
          onClick={() => setRevealed((v) => !v)}
          disabled={disabled}
          aria-label={
            revealed
              ? t("security.hidePassword", "Hide password")
              : t("security.showPassword", "Show password")
          }
          aria-pressed={revealed}
          // Keep focus on the field: toggling must not blur what you are typing.
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          {revealed ? (
            // eye-off
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // eye
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>

        <style>{`
          .pw-field {
            position: relative;
            display: block;
            width: 100%;
          }
          .pw-field > input {
            width: 100%;
          }
          .pw-field__toggle {
            position: absolute;
            top: 50%;
            right: 0.5rem;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            padding: 0;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: #6b7280;
            cursor: pointer;
            transition: color 0.15s ease, background 0.15s ease;
          }
          .pw-field__toggle:hover:not(:disabled) {
            color: #0d9488;
            background: rgba(13, 148, 136, 0.08);
          }
          .pw-field__toggle:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
        `}</style>
      </span>
    );
  }
);

export default PasswordInput;
