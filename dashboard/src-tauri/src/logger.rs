/**
 * Development logging configuration
 * Feature: Debug logging to file for development
 */

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logger() -> Result<(), Box<dyn std::error::Error>> {
    // Get log directory
    let log_dir = get_log_dir()?;
    std::fs::create_dir_all(&log_dir)?;

    // Create log file path
    let log_file = log_dir.join(format!(
        "arcsign-{}.log",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));

    // Create file appender
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_file)?;

    // Configure tracing subscriber with both file and stdout
    let file_layer = fmt::layer()
        .with_writer(move || {
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
                .expect("Failed to open log file")
        })
        .with_ansi(false); // No ANSI codes in file

    let stdout_layer = fmt::layer()
        .with_ansi(true); // ANSI codes for terminal

    // Combine layers
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .with(file_layer)
        .with(stdout_layer)
        .init();

    tracing::info!("=== Logging initialized ===");
    tracing::info!("Log file: {:?}", log_file);

    Ok(())
}

fn get_log_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")?;
        Ok(PathBuf::from(home).join("Library/Logs/ArcSign"))
    }

    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")?;
        Ok(PathBuf::from(appdata).join("ArcSign\\Logs"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")?;
        Ok(PathBuf::from(home).join(".local/share/arcsign/logs"))
    }
}

/// Get the latest log file path
pub fn get_latest_log_file() -> Option<PathBuf> {
    let log_dir = get_log_dir().ok()?;

    let mut log_files: Vec<_> = std::fs::read_dir(&log_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path()
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("arcsign-") && n.ends_with(".log"))
                .unwrap_or(false)
        })
        .collect();

    log_files.sort_by_key(|entry| entry.metadata().ok()?.modified().ok()?);
    log_files.last().map(|entry| entry.path())
}
