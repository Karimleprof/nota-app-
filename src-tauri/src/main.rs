#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use dirs;

fn nota_dir() -> PathBuf {
    let home = dirs::home_dir().expect("No home dir");
    home.join("Desktop").join("nota")
}

#[tauri::command]
fn get_folders() -> Vec<String> {
    let dir = nota_dir();
    fs::create_dir_all(&dir).ok();
    let mut folders: Vec<String> = fs::read_dir(&dir)
        .unwrap_or_else(|_| fs::read_dir(".").unwrap())
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    folders.sort();
    folders
}

#[tauri::command]
fn create_folder(name: String) -> bool {
    let path = nota_dir().join(&name);
    fs::create_dir_all(&path).is_ok()
}

#[tauri::command]
fn delete_folder(name: String) -> bool {
    let path = nota_dir().join(&name);
    if path.is_dir() {
        let empty = fs::read_dir(&path).map(|mut d| d.next().is_none()).unwrap_or(false);
        if empty { return fs::remove_dir(&path).is_ok(); }
    }
    false
}

#[tauri::command]
fn get_notes(folder: String) -> Vec<String> {
    let path = nota_dir().join(&folder);
    fs::create_dir_all(&path).ok();
    let mut notes: Vec<String> = fs::read_dir(&path)
        .unwrap_or_else(|_| fs::read_dir(".").unwrap())
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "md").unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .map(|n| n.trim_end_matches(".md").to_string())
        .collect();
    notes.sort();
    notes
}

#[tauri::command]
fn read_note(folder: String, name: String) -> String {
    let path = nota_dir().join(&folder).join(format!("{}.md", name));
    fs::read_to_string(&path).unwrap_or_default()
}

#[tauri::command]
fn save_note(folder: String, name: String, content: String) -> bool {
    let dir = nota_dir().join(&folder);
    fs::create_dir_all(&dir).ok();
    let path = dir.join(format!("{}.md", name));
    fs::write(&path, &content).is_ok()
}

#[tauri::command]
fn delete_note(folder: String, name: String) -> bool {
    let path = nota_dir().join(&folder).join(format!("{}.md", name));
    fs::remove_file(&path).is_ok()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_folders,
            create_folder,
            delete_folder,
            get_notes,
            read_note,
            save_note,
            delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
