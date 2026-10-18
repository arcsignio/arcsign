/**
 * App-level authentication component
 * Feature: App-level password protection (方案 A)
 *
 * Handles:
 * - First-time setup: Create app password and initialize app_config.enc
 * - Unlock: Verify password and load app configuration
 */

import { useState, useEffect } from "react";
import styles from "./AppUnlock.module.css";
import { useTranslation } from "react-i18next";
import tauriApi, { type AppError, type AppConfig } from "@/services/tauri-api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PasswordInput } from "@/components/PasswordInput";

interface AppUnlockProps {
  usbPath: string;
  onUnlockSuccess: (appConfig: AppConfig, password: string) => void;
}

export function AppUnlock({ usbPath, onUnlockSuccess }: AppUnlockProps) {
  const { t } = useTranslation();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if this is first-time setup
  useEffect(() => {
    const checkFirstTime = async () => {
      console.log("[AppUnlock] Checking first-time setup for USB:", usbPath);
      setCheckingSetup(true);
      try {
        console.log("[AppUnlock] Calling tauriApi.isFirstTimeSetup...");
        const result = await tauriApi.isFirstTimeSetup(usbPath);
        console.log("[AppUnlock] isFirstTimeSetup result:", result);
        setIsFirstTime(result);
      } catch (err) {
        const error = err as AppError;
        console.error("[AppUnlock] isFirstTimeSetup error:", error);
        setError(`${t("appUnlock.failedToCheckSetup")}: ${error.message}`);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkFirstTime();
  }, [usbPath]);

  const handleInitialize = async () => {
    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t("appUnlock.passwordsNotMatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("appUnlock.passwordTooShort"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await tauriApi.initializeApp(password, usbPath);

      // After initialization, unlock with the same password
      const appConfig = await tauriApi.unlockApp(password, usbPath);
      onUnlockSuccess(appConfig, password);
    } catch (err) {
      const error = err as AppError;
      setError(`${t("appUnlock.failedToInitialize")}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError(t("appUnlock.enterPassword"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const appConfig = await tauriApi.unlockApp(password, usbPath);
      onUnlockSuccess(appConfig, password);
    } catch (err) {
      const error = err as AppError;
      setError(`${t("appUnlock.failedToUnlock")}: ${error.message}`);
      setPassword(""); // Clear password on failure
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className={styles.appUnlock}>
        <div className={styles.unlockContainer}>
          <LoadingSpinner size="lg" message={t("appUnlock.checkingStatus")} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appUnlock}>
      {/* Language Switcher - top left */}
      <div className={styles.topLeft}>
        <LanguageSwitcher variant="toggle" />
      </div>

      <div className={styles.unlockContainer}>
        <div className={styles.unlockHeader}>
          <img src="/logo.png" alt="ArcSign" className={styles.unlockLogo} />
          <h1>ArcSign</h1>
          <p className={styles.subtitle}>{t('appUnlock.tagline')}</p>
        </div>

        {isFirstTime ? (
          // First-time setup
          <div className={styles.setupForm}>
            <h2 className={styles.formTitle}>{t("appUnlock.welcomeTitle")}</h2>
            <p className={styles.description}>{t("appUnlock.welcomeDescription")}</p>

            <div className={styles.securityNote}>
              <strong>{t("appUnlock.securityNote")}</strong>
              <ul>
                <li>{t("appUnlock.securityNote1")}</li>
                <li>{t("appUnlock.securityNote2")}</li>
                <li>{t("appUnlock.securityNote3")}</li>
              </ul>
            </div>

            {error && <div className={`${styles.alertError} ${styles.alert} `.trim()}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="password">{t("appUnlock.masterPassword")}</label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("appUnlock.enterMasterPassword")}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirm-password">
                {t("appUnlock.confirmPassword")}
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password && confirmPassword) {
                    handleInitialize();
                  }
                }}
                placeholder={t("appUnlock.reenterPassword")}
                disabled={loading}
              />
            </div>

            <button
              onClick={handleInitialize}
              className={`${styles.btnPrimary} ${styles.btnLarge}`.trim()}
              disabled={loading || !password || !confirmPassword}
            >
              {loading
                ? t("appUnlock.initializing")
                : t("appUnlock.createMasterPassword")}
            </button>
          </div>
        ) : (
          // Unlock existing app
          <div className={styles.unlockForm}>
            <h2 className={styles.formTitle}>{t("appUnlock.unlockTitle")}</h2>
            <p className={styles.description}>{t("appUnlock.unlockDescription")}</p>

            {error && <div className={`${styles.alertError} ${styles.alert} `.trim()}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="unlock-password">
                {t("appUnlock.masterPassword")}
              </label>
              <PasswordInput
                id="unlock-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password) {
                    handleUnlock();
                  }
                }}
                placeholder={t("appUnlock.enterYourPassword")}
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              onClick={handleUnlock}
              className={`${styles.btnPrimary} ${styles.btnLarge}`.trim()}
              disabled={loading || !password}
            >
              {loading ? t("appUnlock.unlocking") : t("appUnlock.unlock")}
            </button>
          </div>
        )}

        <div className={styles.usbInfo}>
          <small>
            {t("appUnlock.usbDrive")}: {usbPath}
          </small>
        </div>
      </div>
    </div>
  );
}
