import {Plugin, Notice, Modal, App, MarkdownRenderer} from "obsidian";

interface Snippet {
	id: string;
	name: string;
	author: string;
	description: string;
	repo: string;
	folder: string;
}

export default class CssSnippetStore extends Plugin {

	private snippets: Snippet[] = [];

	observer: MutationObserver;

	async onload() {
		// Start the mutation observer when the plugin is loaded.
		this.injectBrowseButton();

		// fetching list of snippets
		const url = "https://raw.githubusercontent.com/xavwe/obsidian-css-snippet-store/main/snippets.json"
		try {
			if (await isOnline()) {
				const response = await fetchWithTimeout(url);
				if (!response.ok) {
					new Notice(`Network response was not ok: ${response.statusText}`);
					return;
				}
				/*
                if (!response.headers.get('content-type')?.includes('application/json')) {
                    throw new Error("Unexpected content type");
                }*/
				this.snippets = await response.json();
			} else {
				new Notice(`No Internet connection...`);
				return;
			}
		} catch (error) {
			console.error(error);
			new Notice(`Error: ${error.message}`);
		}
	}

	injectBrowseButton() {
		this.observer = new MutationObserver(() => {
			const settingItems = Array.from(document.querySelectorAll('.setting-item'));

			for (const item of settingItems) {
				const titleElement = item.querySelector('.setting-item-name');
				if (
					titleElement &&
					titleElement.textContent &&
					titleElement.textContent.trim().toLowerCase().includes("css snippets")
				) {
					const controlElement = item.querySelector('.setting-item-control');

					// Check if our button is already injected
					if (controlElement && !controlElement.querySelector('.my-custom-button')) {
						const customButton = document.createElement("button");
						customButton.style.marginLeft = "8px";

						customButton.onclick = () => {
							new CssSnippetStoreModal(this.app, this.snippets, this).open();
						};

						controlElement.appendChild(customButton);

						customButton.textContent = 'Browse';
						customButton.className = "mod-cta my-custom-button";
					}
				}
			}
		});

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	onunload() {
		// Clean up the mutation observer on plugin unload.
		if (this.observer) {
			this.observer.disconnect();
		}
	}
}

class CssSnippetStoreModal extends Modal {
	constructor(app: App, private snippets: Snippet[], private plugin: Plugin) {
		super(app);
		this.modalEl.addClass('mod-snippet-store');
	}

	async install(name: string, code: string) {
		const vault = this.app.vault;
		const adapter = vault.adapter;
		const snippetFolderPath = this.app.vault.configDir + '/snippets';
		const fileName = name + '.css';
		const fullPath = `${snippetFolderPath}/${fileName}`;

		try {
			// Ensure the folder exists
			if (!(await adapter.exists(snippetFolderPath))) {
				await adapter.mkdir(snippetFolderPath);
			}

			// Check if file already exists
			if (await adapter.exists(fullPath)) {
				new Notice(`Snippet with id "${fileName}" already exists.`);
				return;
			}

			// Write default content to the CSS snippet
			await vault.create(fullPath, code);

			new Notice(`Snippet "${fileName}" installed`);
		} catch (err) {
			console.error('Failed to create snippet:', err);
			new Notice('Failed to create snippet. See console for details.');
		}
	}

	async uninstall(name: string) {
		const vault = this.app.vault;
		const snippetFolderPath = this.app.vault.configDir + '/snippets';
		const fileName = name + '.css';
		const fullPath = `${snippetFolderPath}/${fileName}`;

		try {
			// Check if the file exists
			if (await vault.adapter.exists(fullPath)) {
				await vault.adapter.remove(fullPath);
				new Notice(`Snippet "${fileName}" deleted.`);
			} else {
				new Notice(`Snippet "${fileName}" does not exist.`);
			}
		} catch (err) {
			console.error('Failed to delete snippet:', err);
			new Notice('Failed to delete snippet. See console for details.');
		}
	}

	async checkSnippetExists(name: string): Promise<boolean> {
		const vault = this.app.vault;
		const snippetFolderPath = this.app.vault.configDir + '/snippets';
		const fileName = name + '.css';
		const fullPath = `${snippetFolderPath}/${fileName}`;
		return await vault.adapter.exists(fullPath);
	}

	private updateSnippetCard(snippet: Snippet) {
		const card = this.contentEl.querySelector(`.community-item[data-snippet-id="${snippet.id}"]`) as HTMLDivElement;
		if (!card) return;

		const buttonWrapper = card.querySelector('.snippet-store-button-wrapper') as HTMLDivElement;
		if (!buttonWrapper) return;

		// Clear any existing button
		buttonWrapper.empty();

		const button = buttonWrapper.createEl('button');
		button.classList.add('mod-cta'); // default, will be overridden

		this.checkSnippetExists(snippet.id).then((exists) => {
			if (exists) {
				button.textContent = 'Delete';
				button.className = 'mod-danger';
				button.addEventListener('click', async () => {
					await this.uninstall(snippet.id);
					this.updateSnippetCard(snippet);
				});
			} else {
				button.textContent = 'Install';
				button.className = 'mod-cta';
				button.addEventListener('click', async () => {
					const url = `https://raw.githubusercontent.com/${snippet.repo}/refs/heads/main/${snippet.folder}/snippet.css`;
					try {
						if (await isOnline()) {
							const response = await fetchWithTimeout(url);
							if (!response.ok) {
								new Notice(`Network response was not ok: ${response.statusText}`);
								return;
							}
							const code = await response.text();
							await this.install(snippet.id, code);
							this.updateSnippetCard(snippet);
						} else {
							new Notice(`No Internet connection...`);
						}
					} catch (error) {
						console.error(error);
						new Notice(`Error: ${error.message}`);
					}
				});
			}
		});
	}

	private renderSnippetsUI(filter: string = "") {
		const { contentEl } = this;
		const grid = contentEl.querySelector('.community-items-container') as HTMLDivElement;
		const messageEl = contentEl.querySelector('.snippet-status-message') as HTMLDivElement;

		if (!grid || !messageEl) return;

		grid.empty();
		messageEl.empty();

		const lowerFilter = filter.toLowerCase();

		const filteredSnippets = this.snippets.filter(snippet =>
			!filter ||
			snippet.name.toLowerCase().includes(lowerFilter) ||
			snippet.author.toLowerCase().includes(lowerFilter) ||
			snippet.description.toLowerCase().includes(lowerFilter)
		);

		if (filteredSnippets.length === 0) {
			messageEl.setText(
				this.snippets.length === 0
					? "No Internet connection"
					: "No snippets match your search."
			);
			return;
		}

		filteredSnippets.forEach(snippet => {
			const card = grid.createDiv({ cls: 'community-item' });
			card.setAttr("data-snippet-id", snippet.id);

			card.createEl('div', { text: snippet.name, cls: 'community-item-name' });
			card.createEl('div', { text: `By ${snippet.author}`, cls: 'community-item-author' });
			card.createEl('div', { text: snippet.description, cls: 'community-desc' });

			card.createDiv({ cls: 'snippet-store-button-wrapper' });

			card.addEventListener('click', async (event) => {
				// Prevent click events on buttons inside the card from triggering README modal
				if ((event.target as HTMLElement).tagName.toLowerCase() === 'button') return;

				// Create and open modal first with loading indicator
				const readmeModal = new SnippetReadmeModal(this.app, snippet, "", this.plugin);
				readmeModal.open();

				const readmeUrl = `https://raw.githubusercontent.com/${snippet.repo}/refs/heads/main/${snippet.folder}/README.md`;
				try {
					if (await isOnline()) {
						const response = await fetchWithTimeout(readmeUrl);
						if (!response.ok) {
							new Notice(`Could not fetch README: ${response.statusText}`);
							readmeModal.close();
							return;
						}
						const readme = await response.text();
						// Update the modal with content
						readmeModal.updateReadmeContent(readme);
					} else {
						new Notice("No Internet connection...");
						readmeModal.close();
					}
				} catch (error) {
					console.error(error);
					new Notice(`Error fetching README: ${error.message}`);
					readmeModal.close();
				}
			});

			// Now update just the button based on snippet state
			this.updateSnippetCard(snippet);
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('snippet-store-modal');
		this.modalEl.addClass('snippet-store-modal-element');

		contentEl.createEl('h1', { text: 'CSS Snippet Store' });

		const topContainer = contentEl.createDiv();
		topContainer.addClass('snippet-store-top-container');

		const searchInput = topContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search snippets...',
		});
		searchInput.classList.add('snippet-search-input');

		// Message container
		const messageEl = topContainer.createEl('div');
		messageEl.classList.add('snippet-status-message');

		// Snippet container
		contentEl.createEl('div', { cls: 'community-items-container' });

		// Initial rendering
		this.renderSnippetsUI();

		// Live search
		searchInput.addEventListener('input', () => {
			const value = searchInput.value.trim();
			this.renderSnippetsUI(value);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

function fetchWithTimeout(resource: RequestInfo, timeout = 10000): Promise<Response> {
	return Promise.race([
		this.app.request.requestUrl(resource),
		new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout))
	]);
}

export async function isOnline(timeout = 3000): Promise<boolean> {
	try {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeout);

		await this.app.request.requestUrl({
			url: "https://ping.archlinux.org",
			method: "GET",
			cache: "no-cache"
		});
		clearTimeout(id);
		return true;
	} catch (e) {
		return false;
	}
}

class SnippetReadmeModal extends Modal {
	constructor(
		app: App,
		private snippet: Snippet,
		private readmeContent: string,
		private plugin: Plugin
	) {
		super(app);
	}

	updateReadmeContent(content: string) {
		this.readmeContent = content;
		this.renderContent();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("snippet-readme-modal");
		this.modalEl.addClass("snippet-readme-modal-element");

		// Show loading indicator if no content yet
		if (!this.readmeContent) {
			contentEl.createEl('div', {
				text: 'Loading README...',
				cls: 'snippet-readme-loading'
			});
			return;
		}

		await this.renderContent();
	}

	async renderContent() {
		if (!this.readmeContent) return;

		const { contentEl } = this;
		contentEl.empty();

		try {
			// Rewrite relative image paths to absolute GitHub raw URLs
			const adjustedContent = this.rewriteRelativeMediaPaths(this.readmeContent);

			// Markdown container
			const markdownContainer = contentEl.createDiv();

			// Render Markdown using Obsidian's renderer
			await MarkdownRenderer.render(
				this.app,
				adjustedContent,
				markdownContainer,
				"",
				this.plugin
			);

			// Optimize image loading
			markdownContainer.querySelectorAll("img").forEach((img) => {
				img.setAttribute("loading", "lazy");
				img.addClass("snippet-readme-image");
			});
		} catch (error) {
			console.error("Error rendering README:", error);
			contentEl.empty();
			contentEl.createEl('div', {
				text: `Error rendering README: ${error.message}`,
				cls: 'snippet-readme-error'
			});
		}
	}

	onClose() {
		this.contentEl.empty();
	}

	private rewriteRelativeMediaPaths(content: string): string {
		const base = `https://raw.githubusercontent.com/${this.snippet.repo}/refs/heads/main/${this.snippet.folder}/`;

		// Regex to match image/video markdown with relative path
		return content.replace(/!\[([^\]]*)]\((\.\/[^)]+)\)/g, (match, alt, relPath) => {
			const url = base + relPath.replace("./", "");
			return `![${alt}](${url})`;
		});
	}
}