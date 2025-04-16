import {Plugin, Notice, Modal, App} from "obsidian";

interface Snippet {
	id: string;
	name: string;
	author: string;
	description: string;
	repo: string;
	folder: string;
	source?: string;
}

export default class CssSnippetStore extends Plugin {

	private snippets: Snippet[] = [];

	observer: MutationObserver;

	async onload() {
		// Start the mutation observer when the plugin is loaded.
		this.injectWhenSettingsLoaded();


		// fetching list of snippets
		const url = "https://raw.githubusercontent.com/xavwe/obsidian-css-snippet-store/refs/heads/main/snippets.json"
		try {
			if (navigator.onLine) {
				const response = await fetch(url);
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

	injectWhenSettingsLoaded() {
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

						// Function to update the button text based on connectivity


						// Initial check
						updateButtonLabel(customButton);

						// Update on connectivity change
						window.addEventListener('online', () => updateButtonLabel(customButton));
						window.addEventListener('offline', () => updateButtonLabel(customButton));
					}
				}
			}
		});

		function updateButtonLabel(button: HTMLButtonElement) {
			if (navigator.onLine) {
				button.textContent = 'Browse';
				button.className = "mod-cta my-custom-button";
			} else {
				button.textContent = 'No Internet';
				button.className = "";
			}
		}

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
		//		this.modalEl.addClass('mod-css-snippet-store'); // Custom class for styling
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
				new Notice(`Snippet "${fileName}" already exists.`);
				return;
			}

			// Write default content to the CSS snippet
			await vault.create(fullPath, code);

			new Notice(`Snippet "${fileName}" created in .obsidian/snippets.`);
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

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h1', { text: 'CSS Snippet Store' });
		const grid = contentEl.createEl('div', { cls: 'snippet-store-grid'});

		this.snippets.forEach(snippet => {
			const card = grid.createDiv({ cls: 'community-item' });

			card.createEl('div', { text: snippet.name, cls: 'community-item-name' });
			card.createEl('div', { text: `By ${snippet.author}`, cls: 'community-item-author' });
			card.createEl('div', { text: snippet.description, cls: 'community-desc' });

			const buttonWrapper = card.createEl('div', { cls: 'snippet-store-button-wrapper' });

			const button = buttonWrapper.createEl('button', { cls: 'mod-cta' });

			// Check if snippet already exists before updating the button text
			this.checkSnippetExists(snippet.id).then((exists) => {
				if (exists) {
					button.textContent = 'Delete';
					button.className = 'mod-danger';  // Optionally change the class to indicate danger

					// Delete snippet logic
					button.addEventListener('click', async () => {
						await this.uninstall(snippet.id);
						// Optionally, reload the modal to update the button text after deletion
						this.close();
						this.open();
					});
				} else {
					button.textContent = 'Install';
					button.className = 'mod-cta';

					// Install snippet logic
					button.addEventListener('click', async () => {
						const url = "https://raw.githubusercontent.com/" + snippet.repo + "/refs/heads/main/" + snippet.folder + "/snippet.css"
						try {
							if (navigator.onLine) {
								const response = await fetch(url);
								const code = await response.text();
								await this.install(snippet.id, code);
								// Optionally, reload the modal to update the button text after installation
								this.close();
								this.open();
							} else {
								new Notice(`No Internet connection...`);
								return;
							}
						} catch (error) {
							console.error(error);
							new Notice(`Error: ${error.message}`);
						}
					});
				}
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}