"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SpeakerQueueItem } from "../lib/session-state";

function SortableSpeaker({ item, index, total, onMove, onRemove }: {
  item: SpeakerQueueItem;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "is-dragging" : ""}>
      <button className="drag-handle" aria-label={`Reordenar a ${item.name}`} {...attributes} {...listeners}>⠿</button>
      <span className="queue-position">{index + 1}</span>
      <strong>{item.name}</strong>
      <div className="queue-actions">
        <button disabled={index === 0} aria-label={`Subir a ${item.name}`} onClick={() => onMove(index, index - 1)}>↑</button>
        <button disabled={index === total - 1} aria-label={`Bajar a ${item.name}`} onClick={() => onMove(index, index + 1)}>↓</button>
        <button aria-label={`Quitar a ${item.name}`} onClick={() => onRemove(item.id)}>Quitar</button>
      </div>
    </li>
  );
}

export function SpeakerQueue({ items, onChange }: {
  items: SpeakerQueueItem[];
  onChange: (items: SpeakerQueueItem[], event: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = arrayMove(items, from, to);
    onChange(next, `${items[from].name} cambió a la posición ${to + 1}`);
  }

  function dragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = items.findIndex((item) => item.id === event.active.id);
    const to = items.findIndex((item) => item.id === event.over?.id);
    if (from >= 0 && to >= 0) move(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ol className="speaker-queue">
          {items.length === 0 && <li className="empty-state">La lista está vacía. Agrega cualquier orador.</li>}
          {items.map((item, index) => (
            <SortableSpeaker
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              onMove={move}
              onRemove={(id) => onChange(items.filter((entry) => entry.id !== id), `${item.name} se quitó de la lista`)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
