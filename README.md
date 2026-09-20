<p align="center">
  <img src="assets/logo.svg" alt="resit logo" width="96" height="96" />
</p>

<h1 align="center">resit</h1>

<p align="center">Your notes, PDFs, and study conversations in one desktop app.</p>

<p align="center">
  <a href="#start-a-workspace">Get started</a> ·
  <a href="#ask-about-your-material">Ask about your material</a> ·
  <a href="#shortcuts">Shortcuts</a>
</p>

Organise your materials by subject, take notes beside a textbook, and ask about what you're reading. Notes save as Markdown in a folder you choose, alongside your imported files and conversations.

Notes, PDFs, and search work without AI.

## Start a workspace

1. Open resit and choose **Create workspace**.
2. Give it a name, choose a folder, and add your first subject.
3. Use **New note** beside a subject to start writing. To add PDFs, images, or other files, open **Subject actions** and choose **Import files**.

To return to an existing workspace, choose it under **Recent** or use **Open folder**.

## Read and take notes

Open files from the sidebar. Use **Split right** to keep a PDF beside your notes. Notes save automatically, and you can switch between the rich text editor and Markdown.

Press `Ctrl+K` to find files by title or search inside notes and PDFs. PDF results take you to the matching page.

Select text in a PDF to highlight it. Highlights are saved beside the file, so the PDF itself never changes. **Quote in note** puts the passage in the note you are writing in, with a link back to the page it came from.

You can also edit notes in another app. resit reloads those changes and asks which version to keep if you have unsaved edits.

## Ask about your material

AI chat runs through a coding assistant you already have: Claude Code or Codex. Sign in with `claude` or `codex login` in a terminal, then open resit's **Settings** and choose **Check again** under that provider.

Press `Ctrl+J` to open the AI panel, and pick the provider and model at the bottom of it. Ask for an explanation, a summary, or help working through a problem. Select text in a note or PDF to send it with your question, or choose **Ask about this** on a highlight to ask about that passage.

The subjects and files listed at the top of the conversation are all it can read. Add more with the **+** beside them. Opening another subject's file does not change that list.

Your messages, the open file's name, selected text, and whatever the assistant reads go to the provider you picked. It cannot edit your files or run commands. Use **Insert into note** to add a reply to an open note.

## Keep your files

Back up the whole workspace folder to keep your notes, imported files, and conversations together. Deleted subjects and files go to `.resit/trash` inside that folder.

## Shortcuts

| Shortcut | Action                               |
| -------- | ------------------------------------ |
| `Ctrl+K` | Find files and search notes and PDFs |
| `Ctrl+J` | Show or hide the AI panel            |
| `Ctrl+N` | New note in the current subject      |
| `Ctrl+\` | Split the editor into two panes      |
| `Ctrl+W` | Close the current tab                |

On macOS, use Cmd instead of Ctrl.

## License

[MIT](LICENSE). Copyright 2026 Tiago Mouta.
