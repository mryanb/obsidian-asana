import { App, FuzzySuggestModal } from 'obsidian';

/**
 * A modal for selecting items with fuzzy search support.
 */
export class FuzzySelectModal extends FuzzySuggestModal<{ name: string; gid: string; isPinned?: boolean }> {
  private resolve: (value: { name: string; gid: string } | null) => void;
  private items: Array<{ name: string; gid: string; isPinned?: boolean }>;
  private title: string;
  private selectedItem: { name: string; gid: string } | null = null;
  private resolved: boolean = false; // Prevents resolving multiple times

  constructor(
    app: App,
    title: string,
    items: Array<{ name: string; gid: string; isPinned?: boolean }>,
    resolve: (value: { name: string; gid: string } | null) => void
  ) {
    super(app);
    this.title = title;
    this.items = items;
    this.resolve = resolve;
  }

  onOpen() {
    super.onOpen();
    this.setTitle(this.title);
    this.setPlaceholder(this.title);
  }

  getItems(): Array<{ name: string; gid: string; isPinned?: boolean }> {
    return this.items;
  }

  getItemText(item: { name: string; gid: string; isPinned?: boolean }): string {
    return item.isPinned ? `📌 ${item.name.replace(/^📌 /, '')}` : item.name;
  }

  onChooseItem(item: { name: string; gid: string }, evt: MouseEvent | KeyboardEvent) {
    if (!this.resolved) {
      // console.log(`ITEM CHOSEN - ${item.name} (gid: ${item.gid})`);
      this.selectedItem = item;
      this.resolved = true; // Prevents multiple selections
      this.resolve(item);
    } else {
      // console.warn(`ITEM CHOSEN MULTIPLE TIMES - Ignoring extra selection: ${item.name}`);
    }
  }
}