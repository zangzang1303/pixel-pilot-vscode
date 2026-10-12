/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: 'var(--vscode-editor-background, #1e1e1e)',
          fg: 'var(--vscode-editor-foreground, #d4d4d4)',
          border: 'var(--vscode-panel-border, #333333)',
          sidebar: 'var(--vscode-sideBar-background, #252526)',
          input: 'var(--vscode-input-background, #3c3c3c)',
          inputBorder: 'var(--vscode-input-border, #3c3c3c)',
          button: 'var(--vscode-button-background, #007acc)',
          buttonHover: 'var(--vscode-button-hoverBackground, #0062a3)',
          badge: 'var(--vscode-badge-background, #4d4d4d)'
        }
      }
    },
  },
  plugins: [],
}
