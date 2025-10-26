// Build script for Tauri application with Go shared library integration
// Feature: 005-go-cli-shared
// Task: T020, T047-T048
// Updated: 2025-10-25 - Added comprehensive platform-specific search paths
// Created: 2025-10-25

fn main() {
    // Tell Cargo to re-run this build script if library files change
    println!("cargo:rerun-if-changed=../../internal/lib");
    println!("cargo:rerun-if-changed=libarcsign.dll");
    println!("cargo:rerun-if-changed=libarcsign.dylib");
    println!("cargo:rerun-if-changed=libarcsign.so");

    // T047: Platform-specific library search paths for Windows
    #[cfg(target_os = "windows")]
    {
        // Search in current directory (where executable is located)
        println!("cargo:rustc-link-search=native=.");

        // Search in dashboard/src-tauri (development builds)
        println!("cargo:rustc-link-search=native=./dashboard/src-tauri");

        // Search in target directory (build artifacts)
        println!("cargo:rustc-link-search=native=./target/debug");
        println!("cargo:rustc-link-search=native=./target/release");

        // Search in common Windows library locations
        println!("cargo:rustc-link-search=native=C:/Program Files/arcSign/lib");
        println!("cargo:rustc-link-search=native=C:/Program Files (x86)/arcSign/lib");

        // Add executable directory to PATH at runtime
        println!("cargo:rustc-env=PATH=%PATH%;.");
    }

    // T048: Platform-specific library search paths for macOS
    #[cfg(target_os = "macos")]
    {
        // Search in current directory
        println!("cargo:rustc-link-search=native=.");

        // Search in dashboard/src-tauri (development builds)
        println!("cargo:rustc-link-search=native=./dashboard/src-tauri");

        // Search in target directory (build artifacts)
        println!("cargo:rustc-link-search=native=./target/debug");
        println!("cargo:rustc-link-search=native=./target/release");

        // Search in macOS application bundle Resources directory
        println!("cargo:rustc-link-search=native=../Resources");
        println!("cargo:rustc-link-search=native=../../Resources");

        // Search in common macOS library locations
        println!("cargo:rustc-link-search=native=/usr/local/lib");
        println!("cargo:rustc-link-search=native=/Applications/arcSign.app/Contents/MacOS");
        println!("cargo:rustc-link-search=native=/Applications/arcSign.app/Contents/Resources");

        // Set RPATH for runtime library discovery
        // @executable_path: relative to the executable
        println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path");
        println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources");
        println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../../Resources");

        // @loader_path: relative to the loading library
        println!("cargo:rustc-link-arg=-Wl,-rpath,@loader_path");
    }

    // T048: Platform-specific library search paths for Linux
    #[cfg(target_os = "linux")]
    {
        // Search in current directory
        println!("cargo:rustc-link-search=native=.");

        // Search in dashboard/src-tauri (development builds)
        println!("cargo:rustc-link-search=native=./dashboard/src-tauri");

        // Search in target directory (build artifacts)
        println!("cargo:rustc-link-search=native=./target/debug");
        println!("cargo:rustc-link-search=native=./target/release");

        // Search in common Linux library locations
        println!("cargo:rustc-link-search=native=/usr/local/lib");
        println!("cargo:rustc-link-search=native=/usr/lib");
        println!("cargo:rustc-link-search=native=/opt/arcsign/lib");

        // Set RPATH for runtime library discovery
        // $ORIGIN: relative to the executable
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN");
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/lib");
        println!("cargo:rustc-link-arg=-Wl,-rpath,$ORIGIN/../lib");

        // Enable new dtags for RUNPATH (more flexible than RPATH)
        println!("cargo:rustc-link-arg=-Wl,--enable-new-dtags");
    }

    // Run Tauri build
    tauri_build::build()
}
