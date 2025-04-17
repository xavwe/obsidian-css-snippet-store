import {Plugin, Notice, Modal, App} from "obsidian";

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
					throw new Error(`Network response was not ok: ${response.statusText}`);
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
							new CssSnippetStoreModal(this.app, this.snippets).open();
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
	constructor(app: App, private snippets: Snippet[]) {
		super(app);
		this.modalEl.addClass('mod-snippet-store');
	}

	async install(name: string, code: string) {
		const vault = this.app.vault;
		const adapter = vault.adapter;
		const snippetFolderPath = '.obsidian/snippets';
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
		const snippetFolderPath = '.obsidian/snippets';
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
		const snippetFolderPath = '.obsidian/snippets';
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
							if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
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

			// Now update just the button based on snippet state
			this.updateSnippetCard(snippet);
		});
	}


	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('snippet-store-modal');

		this.modalEl.style.width = '90vw';
		this.modalEl.style.maxWidth = '1098px';
		this.modalEl.style.height = '90vh';

		contentEl.createEl('h1', { text: 'CSS Snippet Store' });

		const topContainer = contentEl.createDiv();
		topContainer.style.marginBottom = '1rem';

		const searchInput = topContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search snippets...',
		});
		searchInput.classList.add('snippet-search-input');
		searchInput.style.marginBottom = '1rem';
		searchInput.style.width = '100%';
		searchInput.style.padding = '0.5rem';

		// Message container
		const messageEl = topContainer.createEl('div');
		messageEl.classList.add('snippet-status-message');
		messageEl.style.marginTop = '0.5rem';
		messageEl.style.textAlign = 'center';
		messageEl.style.color = 'var(--text-muted)';
		messageEl.style.fontStyle = 'italic';

		// Snippet container
		const grid = contentEl.createEl('div', { cls: 'community-items-container' });

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

function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 10000): Promise<Response> {
	return Promise.race([
		fetch(resource, options),
		new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeout))
	]);
}


export async function isOnline(timeout = 3000): Promise<boolean> {
	try {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeout);

		await fetch("https://ping.archlinux.org", {
			method: "GET",
			mode: "no-cors",
			signal: controller.signal,
			cache: "no-store"
		});
		clearTimeout(id);
		return true;
	} catch (e) {
		return false;
	}
}