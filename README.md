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

resit keeps earlier versions of a note. Open **Version history** in the editor toolbar to compare one with the note as it stands and put it back. Restoring keeps the text it replaced, so you can undo that too.

## Ask about your material

AI chat runs through a coding assistant you already have: Claude Code or Codex. Sign in with `claude` or `codex login` in a terminal, then open resit's **Settings** and choose **Check again** under that provider.

Press `Ctrl+J` to open the AI panel, and pick the provider and model at the bottom of it. Ask for an explanation, a summary, or help working through a problem. Select text in a note or PDF to send it with your question, or choose **Ask about this** on a highlight to ask about that passage.

The subjects and files listed at the top of the conversation are what it can read, along with the file you have open when you write. Add more with the **+** beside them.

Ask it to write something down and it edits the note itself. Ask it to mark a passage and the highlight appears in the PDF, in the same colours you use, with its comment on it. Every change it makes to a note goes into that note's history, so **Version history** undoes anything you did not want. You can still use **Insert into note** to add a reply yourself.

Claude can also look at a page instead of reading its text, which is how it handles diagrams, handwriting, and scans. Codex reads text only.

Your messages, the open file's name, selected text, and whatever the assistant reads go to the provider you picked. It cannot run commands or reach anything outside your workspace.

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
