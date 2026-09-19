<img src="assets/logo.svg" alt="" width="64" height="64" />

# resit

resit is a desktop app for studying with your notes and PDFs. Organise them by subject, take notes beside a textbook, and ask Claude about what you're reading.

Your workspace is a folder on your computer. Notes are saved as Markdown, alongside your imported files and conversations. You can use notes, PDFs, and search without AI.

## Start a workspace

1. Open resit and choose **Create workspace**.
2. Give it a name, choose a folder, and add your first subject.
3. Use **New note** beside a subject to start writing. To add PDFs, images, or other files, open **Subject actions** and choose **Import files**.

To return to an existing workspace, choose it under **Recent** or use **Open folder**.

## Read and take notes

Open files from the sidebar. Use **Split right** to keep a PDF beside your notes. Notes save automatically, and you can switch between the rich text editor and Markdown.

Press `Ctrl+K` to find files by title or search inside notes and PDFs. PDF results take you to the matching page.

You can also edit notes in another app. resit reloads those changes and asks which version to keep if you have unsaved edits.

## Ask Claude

AI chat requires Claude Code installed and signed in. Run `claude` in a terminal to sign in, then open resit's **Settings** and choose **Check again** under **Claude Code**.

Press `Ctrl+J` to open the AI panel. Ask for an explanation, a summary, or help working through a problem. Select text in a note or PDF to include it with your question.

The subjects and files listed at the top of the conversation control which notes and PDFs Claude can read. Opening another subject's file does not change that list. You can add the file or start a conversation for that subject.

Your messages, the open file's name, selected text, and content Claude reads are sent to Anthropic through Claude Code. Claude cannot edit your files. Use **Insert into note** to add a reply to an open note.

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
