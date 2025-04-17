# Obsidian CSS Snippet Store

> [!WARNING]
> This Plugin is currently under development!

## Roadmap

- [x] Install Snippet
- [x] Uninstall Snippet
- [x] Style Store
- [x] Search

## Submit your snippet
To add your plugin to the list, make a pull request to the `snippets.json` file. Please add your snippet to the end of the list.

- `id`: A unique ID for your snippet.
- `name`: The name of your snippet.
- `author`: The author's name.
- `description`: A short description of what your snippet does.
- `repo`: The GitHub repository identifier, in the form of user-name/repo-name, if your GitHub repo is located at https://github.com/user-name/repo-name.
- `folder`: The folder name where your snippet is located. This is the folder name inside the repository, not the full path.

Your Repo has to be public, otherwise the snippet will not be installed and has to be in the following structure:

```
├── folder1
│   ├── snippet.css
│   ├── README.md
└──folder2
    ├── snippet.css
    ├── README.md

```
*Notice that every snippet consists of a `snippet.css` and `README.md` file. The `README.md` file is optional, but it is recommended to add it to provide more information about your snippet. The `snippet.css` file is the actual CSS code that will be applied to your Obsidian vault.*

