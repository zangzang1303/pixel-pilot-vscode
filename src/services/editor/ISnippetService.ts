// ISnippetService.ts - Interface contract for inserting image tags/snippets into active text editor
import * as vscode from 'vscode';
import { SnippetFormat } from '../security/ConfigManager';

export interface SnippetOptions {
  imagePath: string; // Absolute or relative path to image file
  altText?: string;
  format?: SnippetFormat;
  targetEditor?: vscode.TextEditor;
}

export interface ISnippetService {
  /**
   * Generates the appropriate snippet string based on the chosen format.
   */
  generateSnippet(options: SnippetOptions): string;

  /**
   * Inserts the image snippet directly at current cursor position in active editor.
   */
  insertIntoActiveEditor(options: SnippetOptions): Promise<boolean>;
}
