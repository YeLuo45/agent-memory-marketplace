// Zero-dep React-like runtime — 50 LOC. Avoids React + plugin-react entirely.
// Renders a vnode tree into a real DOM node using a global signal-driven model.
// All state is hoisted into closures; render() is called on every state change.

export type VNode = string | number | VNode[] | VElement | null | undefined | false;
export interface VElement {
  tag: string;
  attrs?: Record<string, unknown>;
  children?: VNode[];
  on?: Record<string, EventListener>;
}

export const h = (tag: string, attrs: Record<string, unknown> = {}, ...children: VNode[]): VElement => ({
  tag, attrs, children,
});

export const isElement = (v: VNode): v is VElement => typeof v === 'object' && v !== null && 'tag' in (v as object);

const setAttr = (el: HTMLElement, key: string, value: unknown): void => {
  if (key === 'class' || key === 'className') {
    el.className = String(value);
  } else if (key === 'style' && typeof value === 'object' && value !== null) {
    Object.assign(el.style, value);
  } else if (key === 'checked' || key === 'disabled' || key === 'selected') {
    (el as unknown as Record<string, unknown>)[key] = value;
  } else if (key === 'value' && el instanceof HTMLInputElement) {
    el.value = String(value);
  } else if (key.startsWith('on') && typeof value === 'function') {
    (el as unknown as Record<string, EventListener>)[key.toLowerCase()] = value as EventListener;
  } else if (key === 'html') {
    el.innerHTML = String(value);
  } else if (value !== null && value !== undefined && value !== false) {
    el.setAttribute(key, String(value));
  }
};

const renderNode = (parent: HTMLElement, node: VNode): void => {
  if (node === null || node === undefined || node === false) return;
  if (typeof node === 'string' || typeof node === 'number') {
    parent.appendChild(document.createTextNode(String(node)));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach(n => renderNode(parent, n));
    return;
  }
  if (!isElement(node)) return;
  const el = document.createElement(node.tag);
  Object.entries(node.attrs ?? {}).forEach(([k, v]) => setAttr(el, k, v));
  Object.entries(node.on ?? {}).forEach(([k, v]) => el.addEventListener(k.toLowerCase().slice(2), v));
  renderNode(el, node.children ?? []);
  parent.appendChild(el);
};

export const render = (mount: HTMLElement, node: VNode): void => {
  mount.innerHTML = '';
  renderNode(mount, node);
};

export const createApp = (root: { mount: () => VElement }) => ({
  mount(container: HTMLElement): void {
    render(container, root.mount());
  },
});
