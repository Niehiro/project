import {
  ObjectCategory,
  ObjectDefinition,
} from "./ObjectDefinition";

export interface ObjectPaletteStatus {
  selectedObjectName: string;
  selectedDefinitionId: string;
  selectedPlacedObjectId: string;
  scaleLabel: string;
  placedCount: number;
  maxPlacedObjects: number;
  warning: string;
}

const CATEGORY_ORDER: ObjectCategory[] = [
  "Basic Shapes",
  "Structures",
  "Markers",
];

export class ObjectPaletteUI {
  private readonly panel: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly buttonsByDefinitionId = new Map<string, HTMLButtonElement>();
  private open = false;
  private activeDefinitionId?: string;

  constructor(
    root: HTMLElement,
    private readonly definitions: ObjectDefinition[],
    private readonly onSelectDefinition: (definitionId: string) => void,
  ) {
    this.panel = document.createElement("div");
    this.panel.className = "object-palette";
    this.panel.hidden = true;

    const title = document.createElement("div");
    title.className = "object-palette__title";
    title.textContent = "Object Palette";
    this.panel.appendChild(title);

    this.grid = document.createElement("div");
    this.grid.className = "object-palette__grid";
    this.panel.appendChild(this.grid);

    this.status = document.createElement("div");
    this.status.className = "object-palette__status";
    this.panel.appendChild(this.status);

    const help = document.createElement("div");
    help.className = "object-palette__help";
    help.textContent =
      "TAB/Esc close | click object to preview | click planet/Enter place | [ ] scale | R rotate | Delete remove";
    this.panel.appendChild(help);

    root.appendChild(this.panel);
    this.buildGrid();
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setActiveDefinition(definitionId?: string): void {
    this.activeDefinitionId = definitionId;

    for (const [id, button] of this.buttonsByDefinitionId) {
      button.classList.toggle("is-selected", id === this.activeDefinitionId);
    }
  }

  setStatus(status: ObjectPaletteStatus): void {
    const lines = [
      `Selected: ${status.selectedObjectName}`,
      `Definition: ${status.selectedDefinitionId}`,
      `Placed ID: ${status.selectedPlacedObjectId}`,
      `Scale: ${status.scaleLabel}`,
      `Objects: ${status.placedCount} / ${status.maxPlacedObjects}`,
    ];

    if (status.warning) {
      lines.push(status.warning);
    }

    this.status.textContent = lines.join("\n");
  }

  private buildGrid(): void {
    for (const category of CATEGORY_ORDER) {
      const categoryDefinitions = this.definitions.filter(
        (definition) => definition.category === category,
      );

      if (categoryDefinitions.length === 0) {
        continue;
      }

      const heading = document.createElement("div");
      heading.className = "object-palette__category";
      heading.textContent = category;
      this.grid.appendChild(heading);

      const list = document.createElement("div");
      list.className = "object-palette__items";
      this.grid.appendChild(list);

      for (const definition of categoryDefinitions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "object-palette__item";
        button.addEventListener("click", () => {
          this.onSelectDefinition(definition.definitionId);
        });

        const swatch = document.createElement("span");
        swatch.className = "object-palette__swatch";
        swatch.style.background = definition.color;
        button.appendChild(swatch);

        const text = document.createElement("span");
        text.className = "object-palette__item-text";
        button.appendChild(text);

        const name = document.createElement("strong");
        name.textContent = definition.name;
        text.appendChild(name);

        const description = document.createElement("small");
        description.textContent = `${definition.description} Default ${definition.defaultScale.toFixed(1)}`;
        text.appendChild(description);

        list.appendChild(button);
        this.buttonsByDefinitionId.set(definition.definitionId, button);
      }
    }
  }
}
